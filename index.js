/**
 * 清爽搜索 · Host 半。
 *
 * 注册 `/dsh-clean-search/api/*` 路由，为浏览器半提供：
 *  - 首页数据：天气（Open-Meteo）、国内外要闻（DeepSeek Search API，失败降级 RSS）、指数快照
 *  - 搜索：DeepSeek Search API（`/v1/tools/search`，保留 authority / rerank_score 做官网优先排序），
 *    不可用时降级到 DSH 的 `ctx.web` 服务
 *  - 行情：腾讯 / 新浪公开行情接口（报价、日 K、分时）
 *  - 图搜图：DeepSeek 联网工具（`deepseek_web_search` 的 image_search）为主，多引擎搜索链接兜底
 *
 * 搜索与图搜的凭据都取自 DSH 的 credentials 服务（`ctx.credentials.resolve`），不落盘、不进配置。
 */

import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { lookup } from 'node:dns/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const name = 'clean-search'

/** webServer 不存在时不激活（Host-only 的 web profile 才有）。 */
export const inject = ['webServer']

const API = '/dsh-clean-search/api'
const DEFAULTS = Object.freeze({ city: '上海', count: 10, cacheSeconds: 21600 })

const WEATHER_TEXT = {
  0: '晴', 1: '多云', 2: '多云', 3: '阴', 45: '雾', 48: '雾凇',
  51: '毛毛雨', 53: '毛毛雨', 55: '毛毛雨', 56: '冻毛毛雨', 57: '冻毛毛雨',
  61: '小雨', 63: '中雨', 65: '大雨', 66: '冻雨', 67: '冻雨',
  71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒',
  80: '阵雨', 81: '阵雨', 82: '强阵雨', 85: '阵雪', 86: '阵雪',
  95: '雷雨', 96: '雷雨冰雹', 99: '雷雨冰雹',
}

/** 指数 / 外汇 / 期货的别名表（内部符号沿用腾讯与新浪的代码）。 */
const MARKET_ALIASES = [
  ['sh000001', 'index', '上证指数', ['上证指数', '上证综指', '沪指', '上证', '大盘']],
  ['sz399001', 'index', '深证成指', ['深证成指', '深成指', '深证']],
  ['sz399006', 'index', '创业板指', ['创业板指', '创业板']],
  ['sh000688', 'index', '科创50', ['科创50', '科创板50', '科创']],
  ['hkHSI', 'index', '恒生指数', ['恒生指数', '恒指', '港股大盘']],
  ['usDJI', 'index', '道琼斯', ['道琼斯', '道指']],
  ['usIXIC', 'index', '纳斯达克', ['纳斯达克', '纳指']],
  ['usINX', 'index', '标普500', ['标普500', '标普']],
  ['fx_susdcny', 'fx', '美元/人民币', ['美元人民币', '美元兑人民币', 'usdcny', '美元汇率', '人民币汇率']],
  ['fx_seurcny', 'fx', '欧元/人民币', ['欧元人民币', '欧元兑人民币', 'eurcny']],
  ['fx_sjpycny', 'fx', '日元/人民币', ['日元人民币', '日元兑人民币', 'jpycny']],
  ['fx_shkdcny', 'fx', '港币/人民币', ['港币人民币', '港币兑人民币', 'hkdcny']],
  ['rb0', 'futures', '螺纹钢主力', ['螺纹钢', '螺纹']],
  ['au0', 'futures', '沪金主力', ['黄金', '沪金', '黄金期货']],
  ['ag0', 'futures', '沪银主力', ['白银', '沪银']],
  ['sc0', 'futures', '原油主力', ['原油', '原油期货']],
  ['cu0', 'futures', '沪铜主力', ['沪铜', '铜价']],
  ['i0', 'futures', '铁矿石主力', ['铁矿石', '铁矿']],
]

/** 权威域名：政府、交易所、央行、监管机构。 */
const AUTHORITY_HOSTS = [
  'gov.cn', 'gov', 'sse.com.cn', 'szse.cn', 'bse.cn', 'hkex.com.hk', 'hkexnews.hk',
  'nasdaq.com', 'nyse.com', 'cmegroup.com', 'shfe.com.cn', 'dce.com.cn', 'czce.com.cn',
  'gfex.com.cn', 'ine.cn', 'pbc.gov.cn', 'csrc.gov.cn', 'safe.gov.cn', 'stats.gov.cn',
  'nbs.gov.cn', 'mof.gov.cn', 'ndrc.gov.cn', 'miit.gov.cn', 'mofcom.gov.cn',
]

function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase() } catch { return '' }
}

function isAuthorityHost(host) {
  return AUTHORITY_HOSTS.some(suffix => host === suffix || host.endsWith('.' + suffix))
}

/** host 等于域名或在它下面（www./kzp. 这类子域都算）。 */
function hostMatches(host, domain) {
  return host === domain || host.endsWith('.' + domain)
}

/**
 * 资格考试规则：查询命中关键词时，
 *  - 对应官方报名/管理站点在结果里置顶并打「官网」标；
 *  - 结果页顶部给出官方入口条（不依赖搜索引擎是否召回）；
 *  - 搜索时在 query 后追加官方导向词，提高官方站点召回率。
 */
const EXAM_RULES = [
  {
    label: '会计专业技术资格',
    keywords: ['中级会计', '初级会计', '高级会计', '会计职称', '会计专业技术资格', '会计资格'],
    hints: '报名 官网 财政部 全国会计人员统一服务管理平台',
    official: [
      { host: 'ausm.mof.gov.cn', name: '全国会计人员统一服务管理平台' },
      { host: 'kzp.mof.gov.cn', name: '全国会计资格评价网' },
      { host: 'mof.gov.cn', name: '财政部' },
    ],
  },
  {
    label: '注册会计师',
    keywords: ['注册会计师', 'cpa', '注会'],
    hints: '报名 官网 中注协 网报系统',
    official: [
      { host: 'cpaexam.cicpa.org.cn', name: 'CPA 网报系统' },
      { host: 'cicpa.org.cn', name: '中国注册会计师协会' },
    ],
  },
  {
    label: '法律职业资格',
    keywords: ['法律职业资格', '法考', '司法考试'],
    hints: '报名 官网 司法部',
    official: [{ host: 'moj.gov.cn', name: '司法部' }],
  },
  {
    label: '教师资格',
    keywords: ['教师资格', '教资'],
    hints: '报名 官网 中小学教师资格考试网',
    official: [
      { host: 'ntce.neea.edu.cn', name: '中小学教师资格考试网' },
      { host: 'neea.edu.cn', name: '教育部教育考试院' },
    ],
  },
  {
    label: '公务员考试',
    keywords: ['公务员', '国考', '省考', '考公', '选调'],
    hints: '报名 官网 国家公务员局',
    official: [{ host: 'scs.gov.cn', name: '国家公务员局' }],
  },
  {
    label: '全国专业技术人员资格考试',
    keywords: [
      '一级建造师', '二级建造师', '建造师', '造价工程师', '监理工程师', '消防工程师',
      '注册安全工程师', '执业药师', '经济师', '统计师', '审计师', '软考', '计算机技术与软件', '翻译资格', 'catti',
    ],
    hints: '报名 官网 中国人事考试网',
    official: [{ host: 'cpta.com.cn', name: '中国人事考试网' }],
  },
  {
    label: '医师资格',
    keywords: ['医师资格', '执业医师', '医师考试'],
    hints: '报名 官网 国家医学考试网',
    official: [
      { host: 'nmec.org.cn', name: '国家医学考试网' },
      { host: 'nhc.gov.cn', name: '国家卫生健康委' },
    ],
  },
  {
    label: '护士执业资格',
    keywords: ['护士资格', '护士执业', '护考'],
    hints: '报名 官网 中国卫生人才网',
    official: [
      { host: '21wecan.com', name: '中国卫生人才网' },
      { host: 'nhc.gov.cn', name: '国家卫生健康委' },
    ],
  },
  {
    label: '研究生招生考试',
    keywords: ['考研', '研究生考试', '研招', '硕士招生'],
    hints: '报名 官网 研招网',
    official: [
      { host: 'yz.chsi.com.cn', name: '研招网' },
      { host: 'chsi.com.cn', name: '学信网' },
    ],
  },
  {
    label: '四六级考试',
    keywords: ['四六级', 'cet', '英语四级', '英语六级'],
    hints: '报名 官网 全国大学英语四六级考试',
    official: [
      { host: 'neea.edu.cn', name: '教育部教育考试院' },
      { host: 'cet.neea.edu.cn', name: '全国大学英语四六级考试' },
    ],
  },
  {
    label: '雅思/托福',
    keywords: ['雅思', '托福', 'ielts', 'toefl'],
    hints: '报名 官网 教育部教育考试院',
    official: [{ host: 'neea.edu.cn', name: '教育部教育考试院' }],
  },
  {
    label: '证券/基金/银行/期货从业',
    keywords: ['证券从业', '基金从业', '银行从业', '期货从业'],
    hints: '报名 官网 从业资格考试',
    official: [
      { host: 'sac.net.cn', name: '中国证券业协会' },
      { host: 'amac.org.cn', name: '中国证券投资基金业协会' },
      { host: 'china-cba.net', name: '中国银行业协会' },
      { host: 'cfachina.org', name: '中国期货业协会' },
    ],
  },
  {
    label: '税务师',
    keywords: ['税务师'],
    hints: '报名 官网 中国注册税务师协会',
    official: [{ host: 'cctaa.cn', name: '中国注册税务师协会' }],
  },
]

/** 竞价广告 / 培训机构 / 商业平台域名（按类别），命中即降权并打标签。 */
const AD_HOSTS = {
  training: [
    'dongao.com', 'chinaacc.com', 'hqwx.com', 'hqwx100.com', 'offcn.com', 'gaodun.com',
    '233.com', 'youlu.net', 'huatu.com', 'fenbi.com', 'xdf.cn', 'koolearn.com',
    'chinalawedu.com', 'jianshe99.com', 'eol.cn', 'kaosheng.com', 'hxacc.com',
    'xueersi.com', 'gaotu.cn', 'zuoyebang.com', 'yuanfudao.com', 'zhangmen.com',
    'tedu.cn', 'itcast.cn', 'qianfeng.com', 'atguigu.com', 'itheima.com', 'bdqn.com',
    'hxsd.com', 'ujiuye.com', 'eic.org.cn', 'jjl.cn', 'xintong.com', 'longre.com',
    'ef.com.cn', 'wsi.com.cn',
  ],
  medical: [
    'soyoung.com', 'mylike.com', 'yestar.com',
  ],
  other: [
    'fang.com', 'anjuke.com', 'ke.com', 'lianjia.com', 'jiameng.com', 'canyin.com',
    '64365.com', '66law.cn', 'lawtime.cn',
  ],
}

/** 强营销动作词：标题/站点名命中即视为广告（高置信，会打标）。 */
const STRONG_AD_PHRASES = [
  '免费咨询', '在线咨询', '立即咨询', '点击咨询', '电话咨询', '预约咨询', '报名咨询',
  '免费领取', '免费试听', '限时优惠', '限时特惠', '抢先报名', '名额有限', '点击领取',
  '加微信', '扫码咨询', '包过', '保过', '包就业', '包毕业', '代报名', '内部通道', '绿色通道',
  '专家会诊', '名医亲诊', '一对一定制', '0元购', '0元领取', '0元预约',
]

/** 领域营销词：标题命中且不是用户查询本身时降权（置信度中，不打标）。 */
const DOMAIN_AD_PHRASES = [
  '哪家好', '多少钱', '专科医院', '男科医院', '妇科医院', '不孕不育', '整形医院', '医美机构',
  '种植牙价格', '近视手术价格', '皮肤病医院', '白癜风治疗', '癫痫治疗', '鼻炎治疗', '肛肠医院',
  '人流医院', '增高药', '减肥药', '祛斑霜', '在线问诊',
  '学历提升报名', '自考本科包过', '成人高考报名', '免考包过', '招生简章', '试听课',
  '低息贷款', '贷款秒批', '无抵押贷款', '额度提升', '信用卡提额', '荐股群', '牛股推荐',
  '涨停板推荐', '配资平台', '稳赚不赔', '年化收益', '1元保险', '信用卡办理',
  '特价房', '首付分期', '装修报价', '免费设计', '加盟费', '招商加盟', '创业项目',
  '证书挂靠', '代评职称', '办证',
]

/** 正规媒体/机构：标题含营销词也不打广告标、不降权。 */
const MEDIA_HOSTS = [
  'xinhuanet.com', 'people.com.cn', 'gmw.cn', 'ce.cn', 'cctv.com', 'cnr.cn', 'cri.cn',
  'chinanews.com', 'chinadaily.com.cn', 'thepaper.cn', 'jingjiribao.cn', 'yicai.com',
  '21jingji.com', 'stcn.com', 'cs.com.cn', 'bjnews.com.cn', '36kr.com', 'huxiu.com',
  'jiemian.com', 'caixin.com', 'ftchinese.com', 'nfnews.com', 'southcn.com', 'eastday.com',
  'nbd.com.cn', 'cls.cn', 'wallstreetcn.com',
]

/** 常见品牌/公司简称 → 官网与展示名（用于「菜百」这类简称直接给官网）。 */
const BRAND_PROFILES = {
  菜百: { hosts: ['bjcaibai.com.cn'], name: '菜百首饰官网' },
  老庙黄金: { hosts: ['laomiao.com'], name: '老庙黄金官网' },
  周大福: { hosts: ['chowtaifook.com'], name: '周大福官网' },
  周生生: { hosts: ['chowsangsang.com'], name: '周生生官网' },
  中国黄金: { hosts: ['chinagold.com.cn'], name: '中国黄金官网' },
  老凤祥: { hosts: ['laofengxiang.com'], name: '老凤祥官网' },
  iphone: { hosts: ['apple.com'], name: 'Apple 官网' },
  ipad: { hosts: ['apple.com'], name: 'Apple 官网' },
  macbook: { hosts: ['apple.com'], name: 'Apple 官网' },
  苹果: { hosts: ['apple.com'], name: 'Apple 官网' },
  apple: { hosts: ['apple.com'], name: 'Apple 官网' },
  openai: { hosts: ['openai.com'], name: 'OpenAI 官网' },
  chatgpt: { hosts: ['openai.com', 'chatgpt.com'], name: 'ChatGPT 官网' },
  deepseek: { hosts: ['deepseek.com'], name: 'DeepSeek 官网' },
  华为: { hosts: ['huawei.com'], name: '华为官网' },
  huawei: { hosts: ['huawei.com'], name: '华为官网' },
  小米: { hosts: ['mi.com'], name: '小米官网' },
  xiaomi: { hosts: ['mi.com'], name: '小米官网' },
  比亚迪: { hosts: ['byd.com'], name: '比亚迪官网' },
  byd: { hosts: ['byd.com'], name: '比亚迪官网' },
  特斯拉: { hosts: ['tesla.com'], name: '特斯拉官网' },
  tesla: { hosts: ['tesla.com'], name: '特斯拉官网' },
  三星: { hosts: ['samsung.com'], name: '三星官网' },
  samsung: { hosts: ['samsung.com'], name: '三星官网' },
  微软: { hosts: ['microsoft.com'], name: '微软官网' },
  microsoft: { hosts: ['microsoft.com'], name: '微软官网' },
  茅台: { hosts: ['moutai.com.cn'], name: '贵州茅台官网' },
  五粮液: { hosts: ['wuliangye.com.cn'], name: '五粮液官网' },
  宁德时代: { hosts: ['catl.com'], name: '宁德时代官网' },
  美的: { hosts: ['midea.com'], name: '美的官网' },
  格力: { hosts: ['gree.com'], name: '格力官网' },
  海尔: { hosts: ['haier.com'], name: '海尔官网' },
  京东: { hosts: ['jd.com'], name: '京东官网' },
  淘宝: { hosts: ['taobao.com'], name: '淘宝官网' },
  美团: { hosts: ['meituan.com'], name: '美团官网' },
  拼多多: { hosts: ['pinduoduo.com'], name: '拼多多官网' },
  抖音: { hosts: ['douyin.com'], name: '抖音官网' },
  快手: { hosts: ['kuaishou.com'], name: '快手官网' },
  哔哩哔哩: { hosts: ['bilibili.com'], name: '哔哩哔哩官网' },
  b站: { hosts: ['bilibili.com'], name: '哔哩哔哩官网' },
  微信: { hosts: ['weixin.qq.com'], name: '微信官网' },
  支付宝: { hosts: ['alipay.com'], name: '支付宝官网' },
  腾讯: { hosts: ['tencent.com'], name: '腾讯官网' },
  阿里巴巴: { hosts: ['alibabagroup.com'], name: '阿里巴巴官网' },
  百度: { hosts: ['baidu.com'], name: '百度官网' },
  网易: { hosts: ['163.com'], name: '网易官网' },
  大疆: { hosts: ['dji.com'], name: '大疆官网' },
  蔚来: { hosts: ['nio.com'], name: '蔚来官网' },
  理想: { hosts: ['lixiang.com'], name: '理想汽车官网' },
  小鹏: { hosts: ['xiaopeng.com'], name: '小鹏汽车官网' },
  吉利: { hosts: ['geely.com'], name: '吉利汽车官网' },
  万科: { hosts: ['vanke.com'], name: '万科官网' },
  招商银行: { hosts: ['cmbchina.com'], name: '招商银行官网' },
  工商银行: { hosts: ['icbc.com.cn'], name: '工商银行官网' },
  建设银行: { hosts: ['ccb.com'], name: '建设银行官网' },
  中国银行: { hosts: ['boc.cn'], name: '中国银行官网' },
  中国平安: { hosts: ['pingan.com'], name: '中国平安官网' },
  平安: { hosts: ['pingan.com'], name: '中国平安官网' },
  中石化: { hosts: ['sinopec.com'], name: '中国石化官网' },
  中石油: { hosts: ['cnpc.com.cn'], name: '中国石油官网' },
  国家电网: { hosts: ['sgcc.com.cn'], name: '国家电网官网' },
  中国移动: { hosts: ['10086.cn'], name: '中国移动官网' },
  中国联通: { hosts: ['chinaunicom.com'], name: '中国联通官网' },
  中国电信: { hosts: ['chinatelecom.com.cn'], name: '中国电信官网' },
}

/** 所有品牌官网域名（供排序匹配）。 */
const BRAND_HOSTS = [...new Set(Object.values(BRAND_PROFILES).flatMap(profile => profile.hosts))]

/** 从查询里识别品牌/公司简称（最长匹配）。 */
function resolveBrand(query) {
  const text = String(query ?? '').toLowerCase()
  const entries = Object.entries(BRAND_PROFILES).sort((a, b) => b[0].length - a[0].length)
  for (const [word, profile] of entries) {
    if (text.includes(word.toLowerCase())) return { word, ...profile }
  }
  return undefined
}

/** 权威站置顶需要查询意图匹配（避免政采公告霸占「空调」这类选购词）。 */
const INTENT_OFFICIAL = /政策|公告|通知|官网|报名|法规|条例|规定|数据|统计|考试|指南|目录|标准|办法|文件|政府|部门|银行|利率|股票|指数|汇率|基金|期货|签证|护照|社保|公积金|税务|发票|驾照|违章|天气|预警|地震|台风|招标|采购|预算|规划|补贴|落户|居住证/

/** 内容聚合门户与财经资讯平台：可读但不应压过官方站点。 */
const PORTAL_HOSTS = [
  'sohu.com', '163.com', 'qq.com', 'sina.com.cn', 'sina.cn', 'baijiahao.baidu.com',
  'toutiao.com', 'ifeng.com', 'thepaper.cn', 'zhihu.com', 'bilibili.com', 'douyin.com', 'weibo.com',
  'eastmoney.com', 'jrj.com.cn', 'hexun.com', 'cnstock.com', 'stcn.com',
]

/** 域名命中的广告类别；没有则 undefined。 */
function adHostKind(host) {
  for (const [kind, domains] of Object.entries(AD_HOSTS)) {
    if (domains.some(domain => hostMatches(host, domain))) return kind
  }
  return undefined
}

/** 官方 / 高校 / 正规媒体域名。 */
function isTrustedHost(host) {
  return isAuthorityHost(host) || host.endsWith('.edu.cn') || host.endsWith('.edu') || host.endsWith('.ac.cn')
    || MEDIA_HOSTS.some(domain => hostMatches(host, domain))
}

/** 标题 / 站点名是否像竞价广告；返回 { hit, strong, title }。 */
function adPhraseHit(item) {
  const titleText = `${item.title ?? ''} ${item.siteName ?? ''}`.toLowerCase()
  const snippetText = String(item.snippet ?? '').toLowerCase()
  const strongTitle = STRONG_AD_PHRASES.some(phrase => titleText.includes(phrase))
  const domainTitle = DOMAIN_AD_PHRASES.some(phrase => titleText.includes(phrase))
  if (strongTitle || domainTitle) return { hit: true, strong: true, title: true }
  if (STRONG_AD_PHRASES.some(phrase => snippetText.includes(phrase))) return { hit: true, strong: false, title: false }
  return { hit: false, strong: false, title: false }
}

/** 命中哪条资格考试规则；没有则 undefined。 */
function findExamRule(query) {
  const text = String(query ?? '').toLowerCase()
  return EXAM_RULES.find(rule => rule.keywords.some(keyword => text.includes(keyword.toLowerCase())))
}

function json(response, status, body) {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(payload)
}

/** 带 HTTP 状态码的错误；safeHandler 据此返回 4xx/5xx。 */
function httpError(status, code) {
  return Object.assign(new Error(code), { status, code })
}

function readBody(request, limit = 16 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let settled = false
    const fail = (error) => {
      if (settled) return
      settled = true
      request.resume()
      reject(error)
    }
    request.on('data', (chunk) => {
      if (settled) return
      size += chunk.length
      if (size > limit) {
        fail(httpError(413, 'BODY_TOO_LARGE'))
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      if (settled) return
      settled = true
      resolve(Buffer.concat(chunks))
    })
    request.on('error', (error) => fail(error))
  })
}

function timeout(ms) {
  return AbortSignal.timeout(ms)
}

function gbk(buffer) {
  try { return new TextDecoder('gbk').decode(buffer) } catch { return Buffer.from(buffer).toString('utf8') }
}

async function fetchJson(url, options = {}, ms = 15000) {
  const response = await fetch(url, { ...options, signal: timeout(ms) })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return await response.json()
}

async function fetchText(url, options = {}, ms = 15000) {
  const response = await fetch(url, { ...options, signal: timeout(ms) })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return { text: await response.text(), encoding: response.headers.get('content-type') ?? '' }
}

function cacheGet(cache, key, ttl) {
  const hit = cache.get(key)
  if (hit === undefined) return undefined
  if (Date.now() - hit.at > ttl * 1000) { cache.delete(key); return undefined }
  return hit.value
}

function cacheSet(cache, key, value) {
  cache.delete(key)
  cache.set(key, { at: Date.now(), value })
  if (cache.size > 64) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
}

/** 只放行 http/https URL，其余返回空串（结果里的危险协议一律丢弃）。 */
function safeUrl(value) {
  try {
    const url = new URL(String(value ?? ''))
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : ''
  } catch {
    return ''
  }
}

/** 从 DSH 凭据服务读 DeepSeek API Key；不写日志、不回传。 */
async function deepseekKey(ctx) {
  const credentials = ctx.get('credentials')
  if (credentials === undefined || typeof credentials.resolve !== 'function') return undefined
  try {
    const resolved = await credentials.resolve('DEEPSEEK_API_KEY')
    const value = resolved?.value
    return typeof value === 'string' && value.length > 0 ? value : undefined
  } catch {
    return undefined
  }
}

/** 直接调 DeepSeek Search API，保留 authority / rerank_score / site_name。 */
async function deepseekSearch(ctx, query, count, ms = 20000) {
  const key = await deepseekKey(ctx)
  if (key === undefined) throw new Error('NO_DEEPSEEK_KEY')
  const url = 'https://api.deepseek.com/v1/tools/search'
  const response = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, count, need_content: false }),
    signal: timeout(ms),
  })
  if (!response.ok) throw new Error(`DeepSeek Search API HTTP ${response.status}`)
  const data = await response.json()
  if (!data || !Array.isArray(data.results)) throw new Error('DeepSeek Search API returned no results array')
  return data.results
}

/** 搜索：Search API 优先（带 6h 缓存），失败时降级 DSH 的 ctx.web 服务并返回 notice。 */
async function searchSources(ctx, query, count, config, options = {}) {
  const key = `search:${query}|${count}`
  if (options.fresh !== true) {
    const hit = searchCache.get(key)
    if (hit !== undefined && Date.now() - Number(hit.at ?? 0) < cacheTtlMs(config)) {
      return { results: hit.results, engine: hit.engine, notices: [], cached: true, cachedAt: hit.at }
    }
  }
  try {
    const results = await deepseekSearch(ctx, query, count)
    const mapped = results.map(item => ({
      title: typeof item.title === 'string' ? item.title : '',
      url: safeUrl(item.url),
      snippet: typeof item.snippet === 'string' ? item.snippet : '',
      summary: typeof item.summary === 'string' ? item.summary : '',
      siteName: typeof item.site_name === 'string' ? item.site_name : '',
      date: typeof item.date === 'string' ? item.date : '',
      authority: Number.isFinite(item.authority) ? item.authority : -1,
      rerank: Number.isFinite(item.rerank_score) ? item.rerank_score : 0,
      engine: 'deepseek-search-api',
    }))
    searchCache.set(key, { at: Date.now(), results: mapped, engine: 'deepseek-search-api' })
    while (searchCache.size > 200) {
      const oldest = searchCache.keys().next().value
      if (oldest === undefined) break
      searchCache.delete(oldest)
    }
    persistSearchCache()
    return { results: mapped, engine: 'deepseek-search-api', notices: [], cached: false, cachedAt: null }
  } catch (apiError) {
    const web = ctx.get('web')
    if (web === undefined || typeof web.search !== 'function') {
      throw Object.assign(httpError(502, 'SEARCH_FAILED'), { detail: apiError.message })
    }
    const result = await web.search({ query, maxResults: count })
    const mapped = result.sources.map(source => ({
      title: source.title ?? '',
      url: safeUrl(source.url),
      snippet: source.snippet ?? '',
      summary: source.summary ?? '',
      siteName: hostOf(source.url),
      date: source.publishedAt ?? '',
      authority: -1,
      rerank: 0,
      engine: 'dsh-web',
    }))
    return {
      results: mapped,
      engine: 'dsh-web',
      cached: false,
      cachedAt: null,
      notices: [{ level: 'warn', code: 'FALLBACK_DSH_WEB', message: 'DeepSeek 搜索失败（' + describeFetchError(apiError) + '），已降级到 DSH 搜索服务' }],
    }
  }
}

/** 搜索结果的评分权重（请求参数可覆盖，再归一化）。 */
const DEFAULT_WEIGHTS = Object.freeze({ title: 0.42, snippet: 0.22, rank: 0.16, quality: 0.12, freshness: 0.08 })

/** 归一化并校验权重（非负，缺省用默认值；最后归一化到 1）。 */
function normalizeWeights(input) {
  const weights = { ...DEFAULT_WEIGHTS }
  if (input && typeof input === 'object') {
    for (const key of Object.keys(DEFAULT_WEIGHTS)) {
      const value = Number(input[key])
      if (Number.isFinite(value) && value >= 0) weights[key] = Math.min(value, 1)
    }
    const sum = Object.values(weights).reduce((a, b) => a + b, 0)
    if (sum > 0) for (const key of Object.keys(weights)) weights[key] /= sum
  }
  return weights
}

/** 三滑杆（相关性 / 时效 / 官网优先，0–100）→ 内部权重。 */
function weightsFromSliders({ rel, fresh, off }) {
  const relW = Number.isFinite(rel) ? Math.min(Math.max(rel, 0), 100) / 100 : 1
  const freshW = Number.isFinite(fresh) ? Math.min(Math.max(fresh, 0), 100) / 100 : 1
  const offW = Number.isFinite(off) ? Math.min(Math.max(off, 0), 100) / 100 : 1
  return {
    weights: normalizeWeights({
      title: DEFAULT_WEIGHTS.title * relW,
      snippet: DEFAULT_WEIGHTS.snippet * relW,
      rank: DEFAULT_WEIGHTS.rank * relW,
      quality: DEFAULT_WEIGHTS.quality,
      freshness: DEFAULT_WEIGHTS.freshness * freshW,
    }),
    officialBoost: 5 * offW,
  }
}

/** 把 fetch 底层错误翻译成可操作的中文提示（TLS 拦截 / 网络 / 超时）。 */
function describeFetchError(error) {
  const code = String(error?.cause?.code ?? error?.code ?? '')
  const text = String(error?.message ?? error ?? '')
  const table = {
    SELF_SIGNED_CERT_IN_CHAIN: 'TLS 证书被本机安全软件/代理拦截（自签名证书），请把该安全软件的根证书加入 NODE_EXTRA_CA_CERTS 或在其中排除 deepseek.com',
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'TLS 证书链不完整（可能被安全软件/代理拦截）',
    CERT_HAS_EXPIRED: 'TLS 证书已过期（检查系统时间或代理）',
    ERR_TLS_CERT_ALTNAME_INVALID: 'TLS 证书域名不匹配（可能被代理拦截）',
    ENOTFOUND: 'DNS 解析失败（网络不可用）',
    EAI_AGAIN: 'DNS 解析超时（网络不可用）',
    ECONNREFUSED: '连接被拒绝（网络或代理问题）',
    ECONNRESET: '连接被重置（网络或代理问题）',
    ETIMEDOUT: '连接超时（网络不可用）',
    UND_ERR_CONNECT_TIMEOUT: '连接超时（网络不可用）',
    UND_ERR_SOCKET: '连接异常断开（网络或代理问题）',
  }
  if (table[code] !== undefined) return table[code] + '（' + code + '）'
  if (/aborted due to timeout|TimeoutError|The operation was aborted/i.test(text)) {
    return '请求超时（图搜较慢，可能是图片较大或网络较慢，请换小一点的图或稍后重试）'
  }
  if (text.includes('fetch failed')) return '网络请求失败（' + (code || '原因未知') + '）'
  return text
}

/** 去掉跟踪参数、末尾斜杠与 fragment，用于跨源去重。 */
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'spm', 'fbclid', 'gclid', 'from', 'ref', 'source', 'scene', 'share', 'share_token', 'vd_source',
])
function normalizeUrl(value) {
  try {
    const url = new URL(String(value))
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key) || key.startsWith('utm_')) url.searchParams.delete(key)
    }
    const path = url.pathname.replace(/\/+$/, '') || '/'
    const params = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b))
    const search = params.length === 0
      ? ''
      : '?' + params.map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(value)).join('&')
    return `${url.protocol}//${url.host.toLowerCase()}${path}${search}`
  } catch {
    return ''
  }
}

/** 搜索用量落盘与统计（JSONL，仅本地）。 */
function usageDir() {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'clean-search')
}
const USAGE_MAX_BYTES = 4 * 1024 * 1024

async function appendUsage(record) {
  try {
    await mkdir(usageDir(), { recursive: true })
    const file = join(usageDir(), 'search-usage.jsonl')
    await appendFile(file, JSON.stringify(record) + '\n', 'utf8')
    const info = await stat(file)
    if (info.size > USAGE_MAX_BYTES) {
      const kept = (await readFile(file, 'utf8')).split('\n').filter(Boolean).slice(-2000).join('\n') + '\n'
      await writeFile(file, kept, 'utf8')
    }
  } catch { /* 记账失败不影响搜索 */ }
}
async function usageStats() {
  const empty = () => ({ count: 0, ok: 0, failed: 0, cost: 0 })
  const stats = { today: empty(), month: empty(), recent: [], unitCost: 0.005 }
  try {
    const text = await readFile(join(usageDir(), 'search-usage.jsonl'), 'utf8')
    const today = new Date().toISOString().slice(0, 10)
    const month = today.slice(0, 7)
    const lines = text.split('\n').filter(Boolean).slice(-2000)
    for (const line of lines) {
      let record
      try { record = JSON.parse(line) } catch { continue }
      const day = String(record.ts ?? '').slice(0, 10)
      const ok = record.ok === true
      const billable = record.billable !== false
      const add = bucket => {
        bucket.count += 1
        if (ok) { bucket.ok += 1; if (billable) bucket.cost += stats.unitCost } else bucket.failed += 1
      }
      if (day === today) add(stats.today)
      if (day.startsWith(month)) add(stats.month)
    }
    stats.recent = lines.slice(-20).reverse()
      .map(line => { try { return JSON.parse(line) } catch { return null } })
      .filter(Boolean)
      .map(item => ({ ts: item.ts, query: item.query, ok: item.ok, elapsedMs: item.elapsedMs, engine: item.engine }))
    stats.today.cost = Math.round(stats.today.cost * 1000) / 1000
    stats.month.cost = Math.round(stats.month.cost * 1000) / 1000
  } catch { /* 没有记录 */ }
  return stats
}

/** 搜索缓存：内存 + JSON 持久化（重启仍在），默认 6h。 */
const searchCache = new Map()
let searchCacheLoaded = false
let persistTimer
function cacheTtlMs(config) {
  const seconds = Number(config?.cacheSeconds)
  return (Number.isFinite(seconds) && seconds > 0 ? seconds : 21600) * 1000
}
async function loadSearchCache(config) {
  if (searchCacheLoaded) return
  searchCacheLoaded = true
  try {
    const parsed = JSON.parse(await readFile(join(usageDir(), 'search-cache.json'), 'utf8'))
    const now = Date.now()
    for (const [key, entry] of Object.entries(parsed ?? {})) {
      if (entry && now - Number(entry.at ?? 0) < cacheTtlMs(config)) searchCache.set(key, entry)
    }
  } catch { /* 首次运行没有缓存文件 */ }
}
function persistSearchCache() {
  clearTimeout(persistTimer)
  persistTimer = setTimeout(async () => {
    try {
      await mkdir(usageDir(), { recursive: true })
      const payload = Object.fromEntries([...searchCache.entries()].slice(-200))
      await writeFile(join(usageDir(), 'search-cache.json'), JSON.stringify(payload), 'utf8')
    } catch { /* 忽略 */ }
  }, 1500)
  if (typeof persistTimer.unref === 'function') persistTimer.unref()
}

/** HTML 实体解码（阅读模式用）。 */
function decodeEntities(text) {
  return String(text)
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
}

/** 极简正文提取（阅读模式）：去脚本/样式/导航，取 article/main 或正文。 */
function extractArticle(html) {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, ' ').trim() : ''
  let body = html
  body = body.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  body = body.replace(/<style[\s\S]*?<\/style>/gi, ' ')
  body = body.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
  body = body.replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
  body = body.replace(/<(nav|header|footer|aside|form|button|select|textarea)[\s\S]*?<\/\1>/gi, ' ')
  const articleMatch = /<article[^>]*>([\s\S]*?)<\/article>/i.exec(body) ?? /<main[^>]*>([\s\S]*?)<\/main>/i.exec(body)
  if (articleMatch) body = articleMatch[1]
  body = body.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|section|li|h[1-6])>/gi, '\n')
  const text = decodeEntities(body.replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { title, content: text.slice(0, 20000), length: text.length, truncated: text.length > 20000 }
}

/** 单个 IP 是否内网/保留地址（同步）。 */
function isPrivateAddress(address) {
  const value = String(address ?? '').toLowerCase()
  if (value === '' || value === '::1' || value === '::' || value === '0.0.0.0') return true
  if (value.includes(':')) {
    const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(value)
    if (mapped) return isPrivateAddress(mapped[1])
    const hexMapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(value)
    if (hexMapped) {
      const high = parseInt(hexMapped[1], 16)
      const low = parseInt(hexMapped[2], 16)
      return isPrivateAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`)
    }
    if (/^f[cd][0-9a-f]{2}:/.test(value)) return true // fc00::/7 唯一本地地址
    if (/^fe[89ab][0-9a-f]:/.test(value)) return true // fe80::/10 链路本地
    return false
  }
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value)
  if (!match) return false
  const [a, b] = [Number(match[1]), Number(match[2])]
  return a === 0 || a === 127 || a === 10
    || (a === 192 && b === 168)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 169 && b === 254)
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224
}

/** SSRF 防护：主机名/域名解析到内网地址即拒绝（含 IPv6、尾点、DNS 解析到内网）。 */
async function isPrivateHost(host) {
  const value = String(host ?? '').toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (value === '' || value === 'localhost' || value.endsWith('.local')) return true
  if (isPrivateAddress(value)) return true
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return false
  try {
    const records = await lookup(value, { all: true })
    return records.some(record => isPrivateAddress(record.address))
  } catch {
    return false
  }
}

/** 同站最多 2 条，其余沉到后面；保证前列不被一个站点占满。 */
function diversifyByHost(rows) {
  const counts = new Map()
  const kept = []
  const deferred = []
  for (const row of rows) {
    const count = counts.get(row.host) ?? 0
    if (count >= 2) { deferred.push(row); continue }
    counts.set(row.host, count + 1)
    kept.push(row)
  }
  return [...kept, ...deferred]
}

/** 官网优先排序：考试官方 > 意图匹配的权威/品牌官网 > 其他；广告降权、门户微降、URL 规范化去重、分项评分。 */
function rank(results, query, exam, weightOptions = {}) {
  const tokens = String(query).toLowerCase().split(/[\s,，。.!！?？:：/|-]+/).filter(t => t.length >= 2)
  const examHosts = (exam?.official ?? []).map(row => row.host)
  const intentOfficial = INTENT_OFFICIAL.test(query)
  const brandHosts = resolveBrand(query)?.hosts ?? []
  const { weights, officialBoost } = weightsFromSliders(weightOptions)
  const seen = new Set()
  const rows = []
  for (const item of results) {
    if (typeof item.title !== 'string' || item.title.trim() === '') continue
    const url = safeUrl(item.url)
    if (url === '') continue
    const canonical = normalizeUrl(url)
    if (canonical === '' || seen.has(canonical)) continue
    seen.add(canonical)
    const host = hostOf(url)
    if (host === '') continue
    const bare = host.replace(/^www\./, '')
    const labels = bare.split('.')
    const titleText = String(item.title).toLowerCase()
    const snippetText = String(item.snippet ?? '').toLowerCase()
    const titleHits = tokens.filter(token => titleText.includes(token)).length
    const snippetHits = tokens.filter(token => snippetText.includes(token)).length
    const titleScore = tokens.length === 0 ? 0.5 : Math.min(titleHits / tokens.length, 1)
    const snippetScore = tokens.length === 0 ? 0.5 : Math.min(snippetHits / tokens.length, 1)
    const rankScore = Math.min(Math.max((item.rerank ?? 0) / 10, 0), 1)
    const qualityScore = item.engine === 'deepseek-search-api' ? 1 : 0.6
    const siteName = String(item.siteName ?? '').toLowerCase().replace(/\s+/g, '')
    const brandHit = tokens.some(token => bare === token || labels.includes(token))
    const brandHostHit = brandHosts.some(domain => hostMatches(host, domain))
    const siteHit = tokens.some(token => siteName.includes(token))
    const examHit = examHosts.some(domain => hostMatches(host, domain))
    const authorityHost = isAuthorityHost(host)
    const trusted = examHit || authorityHost || isTrustedHost(host)
    const portalHit = PORTAL_HOSTS.some(domain => hostMatches(host, domain))
    // 官方/高校/媒体/品牌站不判广告；其余按域名库与文案特征判
    const phrase = trusted || brandHit || brandHostHit ? { hit: false, strong: false, title: false } : adPhraseHit(item)
    const adHost = brandHit || brandHostHit ? undefined : adHostKind(host)
    const sponsoredKind = adHost ?? (phrase.title ? 'other' : undefined)
    const demoted = adHost !== undefined || phrase.hit
    const authority = item.authority >= 0 ? item.authority : (authorityHost ? 3 : 0)
    const official = trusted || brandHostHit
      || (brandHit && !/(^|\.)(baidu|sohu|sina|163|qq|toutiao|ifeng|thepaper|jiemian|yicai)\./.test(host))
    // 权威/品牌站只在意图匹配时置顶，避免政采公告霸占「空调」这类选购词
    const pinned = examHit || brandHostHit || (official && (intentOfficial || brandHit))
    const ageDays = typeof item.date === 'string' && item.date !== '' ? (Date.now() - Date.parse(item.date)) / 86_400_000 : NaN
    const freshnessScore = Number.isFinite(ageDays) ? Math.max(0, 1 - ageDays / 730) : 0.5
    const stale = Number.isFinite(ageDays) && ageDays > 730 && !official
    const scored = titleScore * weights.title + snippetScore * weights.snippet + rankScore * weights.rank
      + qualityScore * weights.quality + freshnessScore * weights.freshness
    rows.push({
      title: item.title,
      url,
      host,
      snippet: item.snippet ?? '',
      summary: item.summary ?? '',
      siteName: item.siteName ?? '',
      date: item.date ?? '',
      engine: item.engine ?? 'deepseek-search-api',
      official,
      sponsored: sponsoredKind !== undefined,
      sponsoredKind,
      tier: examHit ? 3 : (pinned ? 2 : 0),
      scores: {
        title: Math.round(titleScore * 100) / 100,
        snippet: Math.round(snippetScore * 100) / 100,
        rank: Math.round(rankScore * 100) / 100,
        quality: qualityScore,
        freshness: Math.round(freshnessScore * 100) / 100,
        total: Math.round(scored * 100) / 100,
      },
      score: scored * 10 + authority * 0.6 + (examHit ? 20 : 0) + (official ? officialBoost : 0) + (brandHostHit ? 3 : 0)
        + (siteHit ? 2.5 : 0) - (demoted ? 8 : 0) - (portalHit ? 2 : 0) - (stale ? 2 : 0),
    })
  }
  rows.sort((a, b) => {
    if (a.tier !== b.tier) return b.tier - a.tier
    return b.score - a.score
  })
  return diversifyByHost(rows)
}

/** 按名称查股票（腾讯 smartbox，GBK + \uXXXX 转义）；命中返回 { symbol, name }。 */
async function suggestStock(query, cache) {
  const key = 'suggest:' + query
  const cached = cacheGet(cache, key, 3600)
  if (cached !== undefined) return cached === null ? undefined : cached
  try {
    const response = await fetch(`https://smartbox.gtimg.cn/s3/?q=${encodeURIComponent(query)}&t=all`, {
      headers: { referer: 'https://gu.qq.com/', 'user-agent': 'Mozilla/5.0' },
      signal: timeout(8000),
    })
    if (!response.ok) return undefined
    const text = gbk(await response.arrayBuffer())
    const match = /v_hint="([^"]*)"/.exec(text)
    if (!match) return undefined
    let raw = match[1]
    try { raw = JSON.parse('"' + raw.replace(/"/g, '\\"') + '"') } catch { /* 保留原文 */ }
    const rows = raw.split('^').filter(Boolean).map((row) => {
      const [market, code, name] = row.split('~')
      return { market, code, name }
    })
    const hit = rows.find(row => row.name && row.code && (row.name.includes(query) || query.includes(row.name)))
    let value
    if (hit !== undefined) {
      const market = String(hit.market ?? '').toLowerCase()
      const code = String(hit.code ?? '')
      const symbol = market === 'hk' ? 'hk' + code
        : market === 'us' ? 'us' + code.toUpperCase()
          : ((market === 'sh' || market === 'sz') ? market + code : 'sh' + code)
      value = { symbol, name: hit.name }
    }
    cacheSet(cache, key, value ?? null)
    return value
  } catch {
    return undefined
  }
}

/** 统一标的代码：裸 6 位股票补前缀、hk/us 大小写归一；无法识别返回 undefined。 */
function normalizeSymbol(raw) {
  const text = String(raw ?? '').trim()
  if (text.length === 0) return undefined
  const lower = text.toLowerCase()
  if (/^(sh|sz|bj)\d{6}$/.test(lower)) return lower
  if (/^\d{6}$/.test(lower)) {
    if (/^(6|9)/.test(lower)) return 'sh' + lower
    if (/^(0|3)/.test(lower)) return 'sz' + lower
    if (/^(4|8)/.test(lower)) return 'bj' + lower
    return undefined
  }
  if (/^hk\d{5}$/.test(lower)) return lower
  if (/^hk[a-z]+$/.test(lower)) return 'hk' + lower.slice(2).toUpperCase()
  if (/^us[a-z]+$/.test(lower)) return 'us' + lower.slice(2).toUpperCase()
  if (/^fx_[a-z]+$/.test(lower)) return lower
  if (/^nf_[a-z0-9]+$/.test(lower)) return lower
  if (/^[a-z]{1,2}\d{0,2}$/.test(lower)) return lower
  return undefined
}

/** 行情查询去掉别名后允许的修饰词，避免「大盘鸡」「科创板改革」这类误判。 */
const MARKET_QUERY_SUFFIX = /^(行情|走势|指数|今天|今日|现在|最新|价格|股价|多少|k线|K线|股票|分时|怎么样|如何|分析|点评)?$/

/** 把查询识别成行情标的（指数 / 外汇 / 期货 / 股票代码）。 */
function detectMarket(query) {
  const text = String(query).trim()
  if (text.length === 0) return undefined
  const lower = text.toLowerCase()
  for (const [symbol, kind, label, aliases] of MARKET_ALIASES) {
    for (const alias of aliases) {
      const aliasLower = alias.toLowerCase()
      if (lower === aliasLower) return { symbol, kind, label }
      if (lower.startsWith(aliasLower)) {
        const rest = text.slice(alias.length).trim()
        if (MARKET_QUERY_SUFFIX.test(rest)) return { symbol, kind, label }
      }
    }
  }
  const normalized = normalizeSymbol(text)
  if (normalized !== undefined && /^(sh|sz|bj)\d{6}$/.test(normalized)) return { symbol: normalized, kind: 'stock', label: text }
  if (normalized !== undefined && /^hk\d{5}$/.test(normalized)) return { symbol: normalized, kind: 'stock', label: text }
  return undefined
}

/** 腾讯时间戳 `20261117161427` → `2026-11-17 16:14:27`。 */
function formatTencentTime(value) {
  const text = String(value ?? '')
  if (!/^\d{14}$/.test(text)) return text
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)} ${text.slice(8, 10)}:${text.slice(10, 12)}:${text.slice(12, 14)}`
}

/** 腾讯行情快照（GBK 文本，`v_<code>="..."`）。 */
async function tencentQuote(symbol) {
  const response = await fetch(`https://qt.gtimg.cn/q=${encodeURIComponent(symbol)}`, {
    headers: { referer: 'https://gu.qq.com/', 'user-agent': 'Mozilla/5.0' },
    signal: timeout(10000),
  })
  if (!response.ok) throw new Error(`tencent quote HTTP ${response.status}`)
  const text = gbk(await response.arrayBuffer())
  const match = new RegExp(`v_${symbol}="([^"]*)"`).exec(text)
  if (!match) throw new Error('tencent quote: missing field')
  const fields = match[1].split('~')
  const price = Number(fields[3])
  const prev = Number(fields[4])
  if (!Number.isFinite(price) || !Number.isFinite(prev) || prev === 0) throw new Error('tencent quote: invalid price')
  return {
    symbol,
    name: fields[1] || symbol,
    price,
    prev,
    open: Number(fields[5]) || price,
    change: price - prev,
    changePct: ((price - prev) / prev) * 100,
    time: formatTencentTime(fields[30]),
    source: 'tencent',
  }
}

/** 新浪行情快照（外汇 / 期货，GBK 文本）。 */
async function sinaQuote(symbol) {
  // 期货报价走新浪老接口 `nf_<大写合约>`，日 K / 分时仍用 `<小写合约>`。
  const query = symbol.startsWith('fx_') ? symbol : 'nf_' + symbol.toUpperCase()
  const response = await fetch(`https://hq.sinajs.cn/list=${encodeURIComponent(query)}`, {
    headers: { referer: 'https://finance.sina.com.cn', 'user-agent': 'Mozilla/5.0' },
    signal: timeout(10000),
  })
  if (!response.ok) throw new Error(`sina quote HTTP ${response.status}`)
  const text = gbk(await response.arrayBuffer())
  const match = new RegExp(`hq_str_${query}="([^"]*)"`).exec(text)
  if (!match || match[1].length === 0) throw new Error('sina quote: missing field')
  const fields = match[1].split(',')
  if (symbol.startsWith('fx_')) {
    const price = Number(fields[1])
    const prev = Number(fields[3])
    const bid = Number(fields[2])
    const base = Number.isFinite(prev) && prev > 0 ? prev : bid
    if (!Number.isFinite(price) || !Number.isFinite(base) || base === 0) throw new Error('sina fx: invalid price')
    return {
      symbol, name: symbol.replace('fx_s', '').toUpperCase(), price, prev: base,
      open: base, change: price - base, changePct: ((price - base) / base) * 100,
      time: fields[0] || '', source: 'sina',
    }
  }
  const price = Number(fields[8])
  const prev = Number(fields[10])
  if (!Number.isFinite(price) || !Number.isFinite(prev) || prev === 0) throw new Error('sina futures: invalid price')
  const rawTime = fields[1] || ''
  const time = /^\d{6}$/.test(rawTime) ? `${rawTime.slice(0, 2)}:${rawTime.slice(2, 4)}:${rawTime.slice(4, 6)}` : rawTime
  return {
    symbol, name: fields[0] || symbol, price, prev,
    open: Number(fields[2]) || price, change: price - prev, changePct: ((price - prev) / prev) * 100,
    time, source: 'sina',
  }
}

/** 报价：按标的类型选择数据源。 */
async function quoteFor(rawSymbol) {
  const symbol = normalizeSymbol(rawSymbol)
  if (symbol === undefined) throw httpError(400, 'INVALID_SYMBOL')
  if (symbol.startsWith('fx_') || /^[a-z]{1,2}\d{0,2}$/.test(symbol)) return await sinaQuote(symbol)
  return await tencentQuote(symbol)
}

/** 腾讯日 K（A 股 / 指数 / 港股 / 美股）。美股走 usfqkline，其余走 fqkline。 */
async function tencentKline(symbol, limit = 120) {
  const endpoint = symbol.startsWith('us') ? 'usfqkline' : 'fqkline'
  const url = `https://web.ifzq.gtimg.cn/appstock/app/${endpoint}/get?param=${encodeURIComponent(symbol)},day,,,${limit},qfq`
  const data = await fetchJson(url, { headers: { referer: 'https://gu.qq.com/' } })
  const root = data?.data?.[symbol]
  const rows = root?.qfqday ?? root?.day
  if (!Array.isArray(rows)) throw new Error('tencent kline: empty')
  return rows.map(row => ({
    time: row[0], open: Number(row[1]), close: Number(row[2]), high: Number(row[3]), low: Number(row[4]), volume: Number(row[5]) || 0,
  })).filter(row => Number.isFinite(row.open) && Number.isFinite(row.close))
}

/** 腾讯分时（A 股 / 指数 / 港股）。 */
async function tencentMinute(symbol) {
  const url = `https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${encodeURIComponent(symbol)}`
  const data = await fetchJson(url, { headers: { referer: 'https://gu.qq.com/' } })
  const list = data?.data?.[symbol]?.data?.data
  if (!Array.isArray(list)) throw new Error('tencent minute: empty')
  return list.map(row => {
    const [time, price, volume] = String(row).split(' ')
    return { time, price: Number(price), volume: Number(volume) || 0 }
  }).filter(row => row.time.length > 0 && Number.isFinite(row.price))
}

/** 新浪期货日 K（JSONP）。 */
async function sinaFuturesKline(symbol) {
  const url = `https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20_${symbol}=/InnerFuturesNewService.getDailyKLine?symbol=${symbol}`
  const { text } = await fetchText(url, { headers: { referer: 'https://finance.sina.com.cn' } })
  const start = text.indexOf('(')
  const end = text.lastIndexOf(')')
  if (start < 0 || end <= start) throw new Error('sina futures kline: bad jsonp')
  const rows = JSON.parse(text.slice(start + 1, end))
  if (!Array.isArray(rows)) throw new Error('sina futures kline: empty')
  return rows.map(row => {
    if (Array.isArray(row)) {
      return { time: String(row[0] ?? ''), open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]), volume: Number(row[5]) || 0 }
    }
    return { time: String(row?.d ?? ''), open: Number(row?.o), high: Number(row?.h), low: Number(row?.l), close: Number(row?.c), volume: Number(row?.v) || 0 }
  }).filter(row => Number.isFinite(row.open) && Number.isFinite(row.close))
}

/** 新浪期货分时。 */
async function sinaFuturesMinute(symbol) {
  const url = `https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20_${symbol}=/InnerFuturesNewService.getMinLine?symbol=${symbol}`
  const { text } = await fetchText(url, { headers: { referer: 'https://finance.sina.com.cn' } })
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start < 0 || end <= start) throw new Error('sina futures minute: bad jsonp')
  const rows = JSON.parse(text.slice(start, end + 1))
  if (!Array.isArray(rows)) throw new Error('sina futures minute: empty')
  return rows.map(row => ({ time: String(row[0] ?? ''), price: Number(row[1]), volume: Number(row[2]) || 0 }))
    .filter(row => row.time.length > 0 && Number.isFinite(row.price))
}

/** 新浪外汇分时 K 线（5 分钟）。 */
async function sinaForexMinute(symbol) {
  const url = `https://vip.stock.finance.sina.com.cn/forex/api/jsonp.php/var%20_${symbol}=/NewForexService.getMinKline?symbol=${symbol}&scale=5&datalen=240`
  const { text } = await fetchText(url, { headers: { referer: 'https://finance.sina.com.cn' } })
  const start = text.indexOf('(')
  const end = text.lastIndexOf(')')
  if (start < 0 || end <= start) throw new Error('sina forex minute: bad jsonp')
  const rows = JSON.parse(text.slice(start + 1, end))
  if (!Array.isArray(rows)) throw new Error('sina forex minute: empty')
  return rows.map(row => {
    if (Array.isArray(row)) {
      return { time: String(row[0] ?? ''), open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]) }
    }
    const day = row?.d ?? row?.time ?? ''
    return { time: String(day), open: Number(row?.o), high: Number(row?.h), low: Number(row?.l), close: Number(row?.c) }
  }).filter(row => Number.isFinite(row.close))
}

/** 新浪外汇日 K（JSONP 字符串，管道分隔的 date,open,high,low,close）。 */
async function sinaForexDaily(symbol) {
  const url = `https://vip.stock.finance.sina.com.cn/forex/api/jsonp.php/var%20_${symbol}=/NewForexService.getDayKLine?symbol=${symbol}`
  const { text } = await fetchText(url, { headers: { referer: 'https://finance.sina.com.cn' } }, 20000)
  const start = text.indexOf('"')
  const end = text.lastIndexOf('"')
  if (start < 0 || end <= start) throw new Error('sina forex daily: bad payload')
  const raw = JSON.parse(text.slice(start, end + 1))
  return String(raw).split('|').filter(Boolean).map((row) => {
    const fields = row.split(',')
    return { time: fields[0], open: Number(fields[1]), high: Number(fields[2]), low: Number(fields[3]), close: Number(fields[4]), volume: 0 }
  }).filter(row => Number.isFinite(row.open) && Number.isFinite(row.close)).slice(-120)
}

/** 行情图表数据：日 K 或分时。 */
async function chartFor(rawSymbol, period) {
  const symbol = normalizeSymbol(rawSymbol)
  if (symbol === undefined) throw httpError(400, 'INVALID_SYMBOL')
  const isFx = symbol.startsWith('fx_')
  const isFutures = /^[a-z]{1,2}\d{0,2}$/.test(symbol) && !isFx
  if (period === 'minute') {
    const candles = isFx
      ? (await sinaForexMinute(symbol)).map(c => ({ time: c.time, price: c.close }))
      : (isFutures
          ? (await sinaFuturesMinute(symbol)).map(c => ({ time: c.time, price: c.price }))
          : (await tencentMinute(symbol)).map(c => ({ time: c.time, price: c.price })))
    return { period: 'minute', candles: candles.length >= 5 ? candles : [] }
  }
  const candles = isFx
    ? await sinaForexDaily(symbol)
    : (isFutures ? await sinaFuturesKline(symbol) : await tencentKline(symbol))
  return { period: 'day', candles: candles.slice(-120) }
}

/** 空气质量等级（US AQI）。 */
function aqiLevel(aqi) {
  if (aqi <= 50) return { label: '优', color: '#22c55e' }
  if (aqi <= 100) return { label: '良', color: '#eab308' }
  if (aqi <= 150) return { label: '轻度污染', color: '#f97316' }
  if (aqi <= 200) return { label: '中度污染', color: '#ef4444' }
  if (aqi <= 300) return { label: '重度污染', color: '#a855f7' }
  return { label: '严重污染', color: '#7f1d1d' }
}

/** 穿衣指数：按体感温度分档。 */
function clothingIndex(temp) {
  const t = Number(temp)
  if (!Number.isFinite(t)) return null
  if (t >= 30) return { level: '炎热', advice: '短袖短裤，注意防晒补水' }
  if (t >= 25) return { level: '热', advice: '短袖、薄裙或薄裤' }
  if (t >= 20) return { level: '舒适', advice: '薄长袖、衬衫或薄外套' }
  if (t >= 15) return { level: '较舒适', advice: '长袖 + 薄外套' }
  if (t >= 10) return { level: '凉', advice: '外套或风衣，早晚加衣' }
  if (t >= 5) return { level: '冷', advice: '毛衣 + 外套或大衣' }
  if (t >= 0) return { level: '寒冷', advice: '羽绒服或棉服，注意保暖' }
  return { level: '严寒', advice: '厚羽绒服、帽子手套' }
}

/** 空气质量（Open-Meteo Air Quality，免费无 key）；失败返回 null，不影响天气。 */
async function airQualityFor(latitude, longitude) {
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}`
      + '&current=us_aqi,european_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide&timezone=Asia%2FShanghai'
    const data = await fetchJson(url, {}, 10000)
    const current = data?.current ?? {}
    const raw = Number.isFinite(current.us_aqi)
      ? current.us_aqi
      : (Number.isFinite(current.european_aqi) ? current.european_aqi : NaN)
    if (!Number.isFinite(raw)) return null
    const level = aqiLevel(raw)
    const round = value => (Number.isFinite(Number(value)) ? Math.round(Number(value) * 10) / 10 : null)
    return {
      aqi: Math.round(raw),
      level: level.label,
      color: level.color,
      pm25: round(current.pm2_5),
      pm10: round(current.pm10),
      ozone: round(current.ozone),
      no2: round(current.nitrogen_dioxide),
      so2: round(current.sulphur_dioxide),
      co: round(current.carbon_monoxide),
    }
  } catch {
    return null
  }
}

/** 天气（Open-Meteo，免费无 key）：实时 + 空气质量 + 15 天预报 + 穿衣指数。 */
async function weatherFor(city) {
  let latitude = 31.23
  let longitude = 121.47
  let name = city
  let fallback = false
  try {
    const geo = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`, {}, 10000)
    const hit = geo?.results?.[0]
    if (hit && Number.isFinite(hit.latitude) && Number.isFinite(hit.longitude)) {
      latitude = hit.latitude
      longitude = hit.longitude
      name = hit.name ?? city
    } else {
      // 查不到该城市：坐标与城市名都回退默认城市
      name = '上海'
      fallback = true
    }
  } catch {
    // 地理编码失败：坐标回退上海，城市名也必须是上海，避免「北京」显示上海天气
    name = '上海'
    fallback = true
  }
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}`
    + '&current=temperature_2m,apparent_temperature,weather_code,relative_humidity_2m,wind_speed_10m'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,uv_index_max'
    + '&forecast_days=15&timezone=Asia%2FShanghai'
  const [data, air] = await Promise.all([
    fetchJson(url, {}, 15000),
    airQualityFor(latitude, longitude),
  ])
  const current = data?.current ?? {}
  const daily = data?.daily ?? {}
  const days = Array.isArray(daily.time) ? daily.time.map((date, index) => {
    const max = daily.temperature_2m_max?.[index] ?? null
    const min = daily.temperature_2m_min?.[index] ?? null
    const apparentMax = daily.apparent_temperature_max?.[index]
    const apparentMin = daily.apparent_temperature_min?.[index]
    const apparentAvg = Number.isFinite(apparentMax) && Number.isFinite(apparentMin)
      ? (apparentMax + apparentMin) / 2
      : (Number.isFinite(max) && Number.isFinite(min) ? (max + min) / 2 : null)
    return {
      date,
      code: daily.weather_code?.[index] ?? 0,
      text: WEATHER_TEXT[daily.weather_code?.[index]] ?? '未知',
      max,
      min,
      precipProb: daily.precipitation_probability_max?.[index] ?? null,
      uv: daily.uv_index_max?.[index] ?? null,
      clothing: clothingIndex(apparentAvg),
    }
  }) : []
  return {
    city: name,
    temperature: current.temperature_2m ?? null,
    apparentTemperature: current.apparent_temperature ?? null,
    code: current.weather_code ?? 0,
    text: WEATHER_TEXT[current.weather_code] ?? '未知',
    humidity: current.relative_humidity_2m ?? null,
    wind: current.wind_speed_10m ?? null,
    clothing: clothingIndex(current.apparent_temperature ?? current.temperature_2m),
    air,
    days,
    source: 'open-meteo',
    ...(fallback ? { fallback: true } : {}),
  }
}

/** 首页数据：只取天气。要闻与首页行情已按需求移除，行情只在搜索结果里随关键词出现。 */
async function homePayload(config, cache) {
  const cached = cacheGet(cache, 'weather:' + config.city, 600)
  const weather = cached !== undefined
    ? cached
    : await weatherFor(config.city).then((data) => {
        cacheSet(cache, 'weather:' + config.city, data)
        return data
      }).catch(() => null)
  return { weather, generatedAt: new Date().toISOString() }
}

/** 多引擎以图搜图链接（零依赖兜底）。 */
function imageSearchLinks(imageUrl) {
  const url = encodeURIComponent(imageUrl ?? '')
  return [
    { id: 'google-lens', name: 'Google Lens', url: `https://lens.google.com/uploadbyurl?url=${url}` },
    { id: 'baidu', name: '百度识图', url: `https://graph.baidu.com/s?image=${url}` },
    { id: 'yandex', name: 'Yandex 图片', url: `https://yandex.com/images/search?rpt=imageview&url=${url}` },
    { id: 'bing', name: 'Bing 视觉搜索', url: `https://www.bing.com/images/searchbyimage/upload?cbir=sbi&imgurl=${url}` },
    { id: 'tineye', name: 'TinEye', url: `https://tineye.com/search?url=${url}` },
    { id: 'saucenao', name: 'SauceNAO', url: `https://saucenao.com/search.php?url=${url}` },
  ]
}

/**
 * 图搜图：DeepSeek 联网工具的 image_search（全家桶）为主。
 * 用户消息带图时模型可发起图片搜索，结果 kind 为 image_search，每条带 image_url。
 * API 暂不支持独立的图片搜索接口，只有这条通道。
 */
async function deepseekImageSearch(ctx, dataUrl) {
  const key = await deepseekKey(ctx)
  if (key === undefined) throw new Error('NO_DEEPSEEK_KEY')
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl)
  if (match === null) throw new Error('IMAGE_FORMAT')
  const mediaType = match[1].toLowerCase()
  const base64 = match[2].replace(/\s+/g, '')
  const body = {
    model: 'deepseek-flash',
    max_tokens: 800,
    tools: [{ type: 'deepseek_web_search', name: 'deepseek_web_search' }],
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: '请用这张图片做以图搜图：找出图中内容的相似图片与来源网页。' },
      ],
    }],
  }
  const response = await fetch('https://api.deepseek.com/anthropic/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'content-type': 'application/json', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
    signal: timeout(90000),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`DeepSeek Messages HTTP ${response.status}: ${text.slice(0, 200)}`)
  }
  const data = await response.json()
  const content = Array.isArray(data?.content) ? data.content : []
  const recognition = content.filter(block => block.type === 'text').map(block => block.text).join('\n').trim()
  const images = []
  const pages = []
  for (const block of content) {
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const item of block.content) {
        if (item.type !== 'web_search_result') continue
        const imageUrl = safeUrl(item.image_url)
        const pageUrl = safeUrl(item.url)
        if (imageUrl !== '') {
          images.push({ title: item.title ?? '', imageUrl, pageUrl, snippet: item.snippet ?? '' })
        } else if (pageUrl !== '') {
          pages.push({ title: item.title ?? '', url: pageUrl, snippet: item.snippet ?? '' })
        }
      }
    }
  }
  return { recognition, images, pages }
}

function parseDataUrl(imageUrl) {
  return /^data:/i.test(imageUrl) ? imageUrl : undefined
}

function safeHandler(fn, admit) {
  return async (request, response) => {
    if (admit !== undefined) {
      let rejection
      try { rejection = admit(request) } catch { rejection = undefined }
      if (rejection !== undefined && rejection !== null && rejection !== false) {
        json(response, typeof rejection === 'number' ? rejection : 403, { error: 'FORBIDDEN' })
        return
      }
    }
    try {
      const body = await fn(request)
      json(response, 200, body)
    } catch (error) {
      const status = typeof error?.status === 'number' ? error.status : 502
      const message = error instanceof Error ? error.message : String(error)
      json(response, status, { error: message })
    }
  }
}

export function apply(ctx, rawConfig = {}) {
  const config = { ...DEFAULTS, ...(rawConfig ?? {}) }
  const cache = new Map()

  ctx.inject(['webServer'], (host) => {
    void loadSearchCache(config)
    const connection = ctx.get('connection')
    const admit = connection !== undefined && typeof connection.requestRejection === 'function'
      ? (request) => connection.requestRejection(request)
      : undefined
    const handle = (fn) => safeHandler(fn, admit)
    const disposers = []
    const route = (path, handler) => {
      const off = host.webServer.register({ kind: 'exact', path, handler })
      disposers.push(off)
    }

    route(`${API}/status`, handle(async () => ({
      ok: true,
      version: '0.1.5',
      city: config.city,
      hasDeepSeekKey: (await deepseekKey(ctx)) !== undefined,
      searchEngine: 'deepseek-search-api',
    })))

    route(`${API}/home`, handle(async (request) => {
      const url = new URL(request.url ?? '/', 'http://localhost')
      const requested = (url.searchParams.get('city') ?? '').trim()
      const city = requested.length > 0 ? Array.from(requested).slice(0, 24).join('') : config.city
      return await homePayload({ ...config, city }, cache)
    }))

    route(`${API}/search`, handle(async (request) => {
      const startedAt = Date.now()
      const url = new URL(request.url ?? '/', 'http://localhost')
      const rawQuery = (url.searchParams.get('q') ?? '').trim()
      if (rawQuery.length === 0) throw httpError(400, 'EMPTY_QUERY')
      const query = Array.from(rawQuery).slice(0, 128).join('')
      const rawCount = Number(url.searchParams.get('count') ?? config.count)
      const count = Number.isFinite(rawCount) ? Math.min(Math.max(Math.round(rawCount), 1), 50) : config.count
      const fresh = url.searchParams.get('fresh') === '1'
      const slider = name => {
        const raw = url.searchParams.get(name)
        if (raw === null) return undefined
        const value = Number(raw)
        return Number.isFinite(value) ? value : undefined
      }
      const weightOptions = { rel: slider('rel'), fresh: slider('freshW'), off: slider('off') }
      const exam = findExamRule(query)
      const brand = resolveBrand(query)
      const searchQuery = exam !== undefined
        ? Array.from(query + ' ' + exam.hints).slice(0, 128).join('')
        : (brand !== undefined ? Array.from(query + ' 官网').slice(0, 128).join('') : query)
      let market = detectMarket(query)
      if (market === undefined) {
        // 公司简称（如「菜百」）→ 股票代码，让搜索结果里带行情走势
        const suggestion = await suggestStock(query, cache)
        if (suggestion !== undefined) market = { symbol: suggestion.symbol, kind: 'stock', label: suggestion.name }
      }
      try {
        const [search, chart] = await Promise.all([
          searchSources(ctx, searchQuery, count, config, { fresh }),
          market === undefined ? Promise.resolve(null) : (async () => {
            try {
              const quote = await quoteFor(market.symbol)
              const [day, minute] = await Promise.all([
                chartFor(market.symbol, 'day').catch(() => null),
                chartFor(market.symbol, 'minute').catch(() => null),
              ])
              const hasData = (day?.candles?.length ?? 0) > 0 || (minute?.candles?.length ?? 0) > 0
              return { market: hasData ? market : null, quote: hasData ? quote : null, day, minute }
            } catch { return { market: null, quote: null, day: null, minute: null } }
          })(),
        ])
        let ranked = rank(search.results, query, exam, weightOptions)
        const synthetic = (title, host, snippet) => ({
          title,
          url: 'https://' + host + '/',
          host,
          snippet,
          summary: '',
          siteName: title,
          date: '',
          engine: 'official',
          official: true,
          sponsored: false,
          sponsoredKind: undefined,
          tier: 2,
          scores: { title: 1, snippet: 0, rank: 0, quality: 1, freshness: 1, total: 1 },
          score: 999,
        })
        // 考试类：搜索引擎没召回官方站时，把官方入口补到最前（保证用户总能点到官方报名入口）
        if (exam !== undefined) {
          const missing = exam.official.filter(official => !ranked.some(row => hostMatches(row.host, official.host)))
          if (missing.length > 0) {
            ranked = [...missing.map(official => synthetic(official.name + ' · 官方入口', official.host, '官方报名 / 信息入口')), ...ranked]
          }
        }
        // 品牌/公司简称：结果里没召回官网时，把官网补到第一条
        if (brand !== undefined) {
          const hasOfficial = ranked.some(row => brand.hosts.some(domain => hostMatches(row.host, domain)))
          if (!hasOfficial) ranked = [synthetic(brand.name, brand.hosts[0], '官方网站'), ...ranked]
        }
        await appendUsage({
          ts: new Date().toISOString(), query, count, ok: true,
          elapsedMs: Date.now() - startedAt, engine: search.engine, cached: search.cached,
          billable: search.cached !== true && search.engine === 'deepseek-search-api',
        })
        return {
          query,
          exam: exam === undefined ? null : { label: exam.label, official: exam.official },
          brand: brand === undefined ? null : { name: brand.name, host: brand.hosts[0], word: brand.word },
          chartAfter: brand !== undefined && (chart?.quote != null || chart?.market != null),
          market: chart?.market ?? null,
          quote: chart?.quote ?? null,
          day: chart?.day ?? null,
          minute: chart?.minute ?? null,
          results: ranked,
          engine: search.engine,
          cached: search.cached,
          cachedAt: search.cachedAt,
          notices: search.notices,
          weights: weightsFromSliders(weightOptions).weights,
          elapsedMs: Date.now() - startedAt,
        }
      } catch (error) {
        await appendUsage({
          ts: new Date().toISOString(), query, count, ok: false,
          elapsedMs: Date.now() - startedAt, engine: 'none',
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    }))

    route(`${API}/usage`, handle(async () => await usageStats()))

    route(`${API}/read`, handle(async (request) => {
      if (request.method !== 'GET') throw httpError(405, 'METHOD_NOT_ALLOWED')
      const url = new URL(request.url ?? '/', 'http://localhost')
      let target = safeUrl((url.searchParams.get('url') ?? '').trim())
      if (target === '') throw httpError(400, 'INVALID_URL')
      let fetched = null
      // 手动跟随重定向：每一跳都重新做 SSRF 校验，避免 302 到内网
      for (let hop = 0; hop < 5; hop += 1) {
        if (await isPrivateHost(new URL(target).hostname)) throw httpError(400, 'PRIVATE_URL')
        let response
        try {
          response = await fetch(target, {
            headers: { 'user-agent': 'Mozilla/5.0 (compatible; dsh-clean-search/1.0)', accept: 'text/html,application/xhtml+xml,text/plain' },
            signal: timeout(12000),
            redirect: 'manual',
          })
        } catch (error) {
          throw Object.assign(httpError(502, 'FETCH_FAILED'), { detail: describeFetchError(error) })
        }
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location')
          if (!location) throw Object.assign(httpError(502, 'FETCH_FAILED'), { detail: `redirect ${response.status}` })
          target = safeUrl(new URL(location, target).href)
          if (target === '') throw httpError(400, 'INVALID_URL')
          continue
        }
        fetched = response
        break
      }
      if (fetched === null) throw httpError(502, 'TOO_MANY_REDIRECTS')
      if (!fetched.ok) throw Object.assign(httpError(502, 'FETCH_FAILED'), { detail: `HTTP ${fetched.status}` })
      const contentType = String(fetched.headers.get('content-type') ?? '')
      if (contentType !== '' && !/text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType)) {
        throw httpError(415, 'UNSUPPORTED_TYPE')
      }
      const declared = Number(fetched.headers.get('content-length') ?? NaN)
      if (Number.isFinite(declared) && declared > 3 * 1024 * 1024) throw httpError(413, 'PAGE_TOO_LARGE')
      const buffer = await fetched.arrayBuffer()
      if (buffer.byteLength > 3 * 1024 * 1024) throw httpError(413, 'PAGE_TOO_LARGE')
      const article = extractArticle(new TextDecoder('utf-8').decode(buffer))
      if (article.content.length === 0) throw httpError(502, 'NO_CONTENT')
      return {
        url: target,
        title: article.title,
        content: article.content,
        length: article.length,
        truncated: article.truncated,
      }
    }))

    route(`${API}/quote`, handle(async (request) => {
      const url = new URL(request.url ?? '/', 'http://localhost')
      const raw = (url.searchParams.get('symbol') ?? '').trim()
      if (raw.length === 0) throw httpError(400, 'EMPTY_SYMBOL')
      return { quote: await quoteFor(raw) }
    }))

    route(`${API}/kline`, handle(async (request) => {
      const url = new URL(request.url ?? '/', 'http://localhost')
      const raw = (url.searchParams.get('symbol') ?? '').trim()
      if (raw.length === 0) throw httpError(400, 'EMPTY_SYMBOL')
      const period = url.searchParams.get('period') === 'minute' ? 'minute' : 'day'
      return { symbol: normalizeSymbol(raw), ...(await chartFor(raw, period)) }
    }))

    route(`${API}/image-search`, handle(async (request) => {
      if (request.method !== 'POST') throw httpError(405, 'METHOD_NOT_ALLOWED')
      const rawBody = await readBody(request)
      let payload
      try { payload = JSON.parse(rawBody.toString('utf8')) } catch { throw httpError(400, 'BAD_JSON') }
      const image = typeof payload?.image === 'string' ? payload.image : ''
      if (image.length === 0) throw httpError(400, 'EMPTY_IMAGE')
      const dataUrl = parseDataUrl(image)
      let engine = 'links'
      let recognition = ''
      let images = []
      let pages = []
      let deepseekError = ''
      if (dataUrl !== undefined) {
        try {
          const deep = await deepseekImageSearch(ctx, dataUrl)
          engine = 'deepseek-image-search'
          recognition = deep.recognition
          images = deep.images
          pages = deep.pages
        } catch (error) {
          deepseekError = describeFetchError(error)
        }
      }
      const links = dataUrl !== undefined ? [] : imageSearchLinks(image)
      if (dataUrl !== undefined && images.length === 0 && pages.length === 0 && deepseekError === '') deepseekError = 'NO_IMAGE_RESULTS'
      return { engine, recognition, images, pages, links, deepseekError }
    }))

    ctx.effect(() => () => {
      for (const off of disposers) {
        try { off() } catch { /* 已卸载 */ }
      }
    }, 'clean-search: routes')
  })
}
