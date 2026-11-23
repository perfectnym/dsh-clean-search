/**
 * 清爽搜索 · Client 半（浏览器 bundle）。
 *
 * 手写 __ModuleLoader__ 线格式：只 require('react')，不 import 任何 Harness Client 包。
 * 页面注册为 main 面板（key = clean-search），侧边栏图标注册到 sidebar.panellist。
 * 样式只用 --dsw-alias-* 主题 token，跟随深浅色。
 */
window.__ModuleLoader__.load({
  id: 'dsh-clean-search',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useRef, useCallback } = React

    const NS = 'clean-search'
    const ZHDICT = {
      nav: '清爽搜索', title: '清爽搜索', subtitle: '无广告 · 官网优先 · 行情直连',
      placeholder: '搜索，或输入关键词',
      search: '搜索', imageSearch: '以图搜图', back: '返回',
      headlines: '今日要闻', weather: '天气', markets: '行情',
      weatherDetail: '天气详情', close: '关闭', humidity: '湿度', wind: '风速',
      feelsLike: '体感', airQuality: '空气质量', clothing: '穿衣指数', forecast15: '15 日天气', precip: '降水',
      cityPlaceholder: '输入城市，如 北京 / 杭州 / 深圳', switchCity: '切换',
      fallbackCity: '城市未识别，已显示默认城市',
      noResults: '没有找到结果', loading: '加载中…', retry: '重试',
      official: '官网', day: '日K', minute: '分时',
      change: '涨跌', open: '开', high: '高', low: '低',
      imageTitle: '以图搜图', imageHint: '上传或拖入一张图片，找相似图片与来源',
      recognition: '识别结果', similar: '相似图片', pages: '来源网页', links: '到引擎里继续搜',
      deepseekFailed: 'DeepSeek 图搜未返回结果，已附上多引擎搜索链接',
      chooseImage: '选择图片', quick: '试试', searchHint: '搜索你想了解的一切',
      minutesAgo: '分钟前', hoursAgo: '小时前', rise: '涨', fall: '跌',
      tencent: '腾讯证券', sina: '新浪财经', source: '来源',
      homeHint: '提示：搜索「上证指数」「美元人民币」「螺纹钢」可直接查看 K 线与分时图',
      imageDropHint: '支持 PNG / JPG / WebP，最大 6 MB，也可以直接拖进来',
      imageTooLarge: '图片超过 6 MB，请选择更小的图片',
      imageTypeError: '只支持图片文件',
      imageNoResult: 'DeepSeek 没有找到这张图的相似结果',
      officialEntry: '官方入口', sponsored: '培训机构',
      trainingAd: '培训机构', medicalAd: '医疗广告', financeAd: '金融广告', ad: '广告',
      recentSearches: '最近搜索', clear: '清空', read: '阅读', reading: '阅读中…',
      openOriginal: '原网页', truncated: '内容过长，已截断',
      cachedAt: '缓存 · {n} 分钟前', refresh: '刷新',
      sortPrefs: '排序偏好', sortHint: '拖动滑杆调整排序权重：相关性影响标题/摘要/排序分，时效影响新旧内容，官网优先影响官方站点加成。',
      sliderRelevance: '相关性', sliderFreshness: '时效', sliderOfficial: '官网优先',
      reset: '重置', apply: '应用',
      usageToday: '今日搜索 {n} 次 · 约 ¥{cost}',
      imageTimeout: '图搜超时（图片较大或网络较慢），请换小一点的图或稍后重试',
      call: '拨打', officialSite: '官网',
    }
    const ENDICT = {
      nav: 'Clean Search', title: 'Clean Search', subtitle: 'No ads · Official sites first · Live markets',
      placeholder: 'Search anything',
      search: 'Search', imageSearch: 'Search by image', back: 'Back',
      headlines: 'Headlines', weather: 'Weather', markets: 'Markets',
      weatherDetail: 'Weather details', close: 'Close', humidity: 'Humidity', wind: 'Wind',
      feelsLike: 'Feels like', airQuality: 'Air quality', clothing: 'Clothing index', forecast15: '15-day forecast', precip: 'precip',
      cityPlaceholder: 'City, e.g. Beijing / Hangzhou / Shenzhen', switchCity: 'Switch',
      fallbackCity: 'City not recognised; showing the default city',
      noResults: 'No results', loading: 'Loading…', retry: 'Retry',
      official: 'Official', day: 'Daily', minute: 'Intraday',
      change: 'Change', open: 'O', high: 'H', low: 'L',
      imageTitle: 'Search by image', imageHint: 'Drop or upload an image to find similar images and sources',
      recognition: 'Recognition', similar: 'Similar images', pages: 'Source pages', links: 'Continue on an engine',
      deepseekFailed: 'DeepSeek image search returned nothing; engine links are provided below',
      chooseImage: 'Choose image', quick: 'Try', searchHint: 'Search anything',
      minutesAgo: 'minutes ago', hoursAgo: 'hours ago', rise: 'up', fall: 'down',
      tencent: 'Tencent', sina: 'Sina', source: 'Source',
      homeHint: 'Tip: search SSE Index, USD/CNY or rebar futures to see candlestick and intraday charts',
      imageDropHint: 'PNG / JPG / WebP up to 6 MB, or drag it in',
      imageTooLarge: 'Image is larger than 6 MB; please pick a smaller one',
      imageTypeError: 'Only image files are supported',
      imageNoResult: 'DeepSeek found no similar image for this picture',
      officialEntry: 'Official entries', sponsored: 'Training',
      trainingAd: 'Training', medicalAd: 'Medical ad', financeAd: 'Finance ad', ad: 'Ad',
      recentSearches: 'Recent searches', clear: 'Clear', read: 'Read', reading: 'Reading…',
      openOriginal: 'Original page', truncated: 'Content truncated',
      cachedAt: 'Cached · {n} min ago', refresh: 'Refresh',
      sortPrefs: 'Ranking preferences', sortHint: 'Drag the sliders to weight relevance, freshness and official-site priority.',
      sliderRelevance: 'Relevance', sliderFreshness: 'Freshness', sliderOfficial: 'Official priority',
      reset: 'Reset', apply: 'Apply',
      usageToday: 'Searches today: {n} · about ¥{cost}',
      imageTimeout: 'Image search timed out (large image or slow network). Try a smaller image or retry later.',
      call: 'Call', officialSite: 'Website',
    }

    let t = key => ZHDICT[key] ?? key

    /** sponsoredKind → 字典键 */
    const AD_LABEL = { training: 'trainingAd', medical: 'medicalAd', finance: 'financeAd', other: 'ad' }

    function api(path) {
      const relative = path.replace(/^\/+/, '')
      if (typeof document === 'undefined') return '/' + relative
      const url = new URL(relative, document.baseURI)
      return url.pathname + url.search
    }

    async function getJson(path, options) {
      const response = await fetch(api(path), { cache: 'no-store', ...(options ?? {}) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'HTTP ' + response.status)
      return body
    }

    const numberFormat = (value, digits) => {
      if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'
      return Number(value).toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    }

    const priceFormat = value => {
      const abs = Math.abs(Number(value) || 0)
      if (abs >= 100) return numberFormat(value, 2)
      if (abs >= 1) return numberFormat(value, 3)
      return numberFormat(value, 4)
    }

    const dateFormat = value => {
      if (!value) return ''
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return ''
      const diff = Date.now() - date.getTime()
      if (diff >= 0 && diff < 3600_000) return Math.max(1, Math.round(diff / 60000)) + ' ' + t('minutesAgo')
      if (diff >= 0 && diff < 86_400_000) return Math.round(diff / 3600_000) + ' ' + t('hoursAgo')
      return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
    }

    const pctClass = value => {
      if (!Number.isFinite(Number(value))) return 'csearch-flat'
      const n = Number(value)
      return n > 0 ? 'csearch-up' : n < 0 ? 'csearch-down' : 'csearch-flat'
    }
    const pctText = value => {
      if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'
      const n = Number(value)
      return (n > 0 ? '+' : '') + n.toFixed(2) + '%'
    }

    const WEATHER_ICON = code => {
      if (code === 0) return '☀️'
      if (code <= 3) return '⛅'
      if (code <= 48) return '🌫️'
      if (code <= 57) return '🌦️'
      if (code <= 67) return '🌧️'
      if (code <= 77) return '❄️'
      if (code <= 82) return '🌧️'
      if (code <= 86) return '🌨️'
      return '⛈️'
    }

    const QUICK_CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都']
    const CITY_KEY = 'dsh-clean-search:city'
    const HISTORY_KEY = 'dsh-clean-search:history'
    const SLIDERS_KEY = 'dsh-clean-search:sliders'
    const MAX_HISTORY = 20

    function loadHistory() {
      try {
        const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
        return Array.isArray(parsed)
          ? parsed.filter(item => item && typeof item.query === 'string').slice(0, MAX_HISTORY)
          : []
      } catch { return [] }
    }
    function saveHistory(list) {
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY))) } catch { /* 忽略 */ }
    }
    function loadSliders() {
      try {
        const parsed = JSON.parse(localStorage.getItem(SLIDERS_KEY) || 'null')
        const clamp = value => (Number.isFinite(Number(value)) ? Math.min(Math.max(Number(value), 0), 100) : 100)
        return { rel: clamp(parsed?.rel), fresh: clamp(parsed?.fresh), off: clamp(parsed?.off) }
      } catch { return { rel: 100, fresh: 100, off: 100 } }
    }
    function saveSliders(sliders) {
      try { localStorage.setItem(SLIDERS_KEY, JSON.stringify(sliders)) } catch { /* 忽略 */ }
    }

    const CSS = `
.csearch-root{height:100%;overflow:auto;color:var(--dsw-alias-label-primary,#1f2328);background:var(--dsw-alias-bg-base,#fff);}
.csearch-inner{max-width:1120px;margin:0 auto;padding:22px 32px 72px;box-sizing:border-box;}

/* ---- header ---- */
.csearch-header{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:40px;}
.csearch-brand{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;letter-spacing:.2px;color:var(--dsw-alias-label-secondary,#5c6570);}
.csearch-brand-dot{width:20px;height:20px;border-radius:7px;background:linear-gradient(135deg,#4c86ff,#1f5ae0);display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;}
.csearch-weather{display:inline-flex;align-items:center;gap:8px;padding:6px 14px 6px 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:var(--dsw-alias-bg-layer-1,#fff);font-size:12px;color:var(--dsw-alias-label-secondary,#5c6570);cursor:pointer;font:inherit;}
.csearch-weather:hover{border-color:var(--dsw-alias-brand-primary,#3d7bfd);}
.csearch-weather b{font-size:14px;color:var(--dsw-alias-label-primary,#1f2328);font-variant-numeric:tabular-nums;}
.csearch-weather .ico{font-size:16px;line-height:1;}

/* ---- hero ---- */
.csearch-hero{display:flex;flex-direction:column;align-items:center;padding:56px 0 34px;}
.csearch-logo{font-size:46px;font-weight:800;letter-spacing:1px;line-height:1.1;background:linear-gradient(120deg,#4c86ff 10%,#2f6bf0 46%,#8f7bff 100%);-webkit-background-clip:text;background-clip:text;color:transparent;user-select:none;}
.csearch-tagline{margin-top:10px;font-size:13px;letter-spacing:.4px;color:var(--dsw-alias-label-tertiary,#8b93a1);}
.csearch-search{display:flex;align-items:center;gap:10px;width:min(680px,100%);margin-top:30px;padding:6px 8px 6px 20px;border-radius:999px;border:1.5px solid var(--dsw-alias-border-l2,#e5e7eb);background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:0 8px 28px rgba(61,123,253,.10),0 2px 6px rgba(31,35,40,.04);transition:border-color .18s ease,box-shadow .18s ease;}
.csearch-search:focus-within{border-color:var(--dsw-alias-brand-primary,#3d7bfd);box-shadow:0 8px 30px rgba(61,123,253,.22),0 0 0 4px rgba(61,123,253,.10);}
.csearch-search-icon{flex:none;color:var(--dsw-alias-label-tertiary,#8b93a1);display:inline-flex;}
.csearch-input{flex:1 1 auto;min-width:0;border:0;outline:0;background:transparent;font:inherit;font-size:15px;line-height:24px;color:var(--dsw-alias-label-primary,#1f2328);padding:8px 0;}
.csearch-input::placeholder{color:var(--dsw-alias-label-tertiary,#8b93a1);font-size:14px;}
.csearch-actions{display:flex;align-items:center;gap:6px;flex:none;}
.csearch-btn{border:0;border-radius:999px;background:linear-gradient(135deg,#4c86ff,#2f6bf0);color:#fff;font:inherit;font-size:13px;font-weight:600;padding:9px 18px;cursor:pointer;white-space:nowrap;transition:filter .15s ease,transform .15s ease;}
.csearch-btn:hover{filter:brightness(1.06);}
.csearch-btn:active{transform:scale(.98);}
.csearch-btn.ghost{background:var(--dsw-alias-bg-layer-2,#f3f4f6);color:var(--dsw-alias-label-secondary,#5c6570);font-weight:500;}
.csearch-btn.ghost:hover{background:var(--dsw-alias-interactive-bg-hover,#2631480f);}
.csearch-btn.mini{padding:7px 14px;font-size:12px;}
.csearch-btn.icon{width:34px;height:34px;padding:0;display:inline-flex;align-items:center;justify-content:center;}
.csearch-chips{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:18px;}
.csearch-chips-label{font-size:12px;color:var(--dsw-alias-label-tertiary,#8b93a1);}
.csearch-home-hint{margin-top:34px;font-size:12px;line-height:20px;color:var(--dsw-alias-label-tertiary,#8b93a1);text-align:center;letter-spacing:.2px;}
.csearch-chip{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:transparent;border-radius:999px;padding:4px 12px;font:inherit;font-size:12px;color:var(--dsw-alias-label-secondary,#5c6570);cursor:pointer;transition:all .15s ease;}
.csearch-chip:hover{border-color:var(--dsw-alias-brand-primary,#3d7bfd);color:var(--dsw-alias-brand-primary,#3d7bfd);background:rgba(61,123,253,.06);}

/* ---- body ---- */
.csearch-body{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:20px;align-items:start;}
.csearch-main{min-width:0;}
.csearch-side{min-width:0;}
.csearch-card{border:1px solid var(--dsw-alias-border-l1,#eef0f3);border-radius:18px;background:var(--dsw-alias-bg-layer-1,#fff);padding:18px 20px;box-shadow:0 1px 2px rgba(31,35,40,.03);transition:box-shadow .18s ease;}
.csearch-card:hover{box-shadow:0 6px 20px rgba(31,35,40,.06);}
.csearch-card + .csearch-card{margin-top:14px;}
.csearch-card-head{display:flex;align-items:center;justify-content:space-between;margin:0 0 14px;}
.csearch-card-title{font-size:14px;font-weight:700;color:var(--dsw-alias-label-primary,#1f2328);display:flex;align-items:center;gap:8px;}
.csearch-card-title .bar{width:3px;height:14px;border-radius:2px;background:linear-gradient(180deg,#4c86ff,#8f7bff);}
.csearch-card-more{font-size:12px;color:var(--dsw-alias-label-tertiary,#8b93a1);}

/* ---- news ---- */
.csearch-news-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 18px;}
.csearch-news-item{display:block;text-decoration:none;padding:10px 0;border-bottom:1px solid var(--dsw-alias-border-l1,#eef0f3);}
.csearch-news-item:nth-last-child(-n+2){border-bottom:0;}
.csearch-news-item .t{font-size:13.5px;line-height:21px;color:var(--dsw-alias-label-primary,#1f2328);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;transition:color .12s ease;}
.csearch-news-item:hover .t{color:var(--dsw-alias-brand-primary,#3d7bfd);}
.csearch-news-item .m{display:flex;align-items:center;gap:8px;margin-top:5px;font-size:11px;color:var(--dsw-alias-label-tertiary,#8b93a1);}
.csearch-news-item .src{color:var(--dsw-alias-label-secondary,#5c6570);}

/* ---- markets ---- */
.csearch-markets{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.csearch-market{border:1px solid var(--dsw-alias-border-l1,#eef0f3);border-radius:12px;padding:9px 12px;background:var(--dsw-alias-bg-base,#fff);transition:border-color .15s ease;}
.csearch-market:hover{border-color:var(--dsw-alias-border-l3,#d9dde3);}
.csearch-market .n{font-size:11px;color:var(--dsw-alias-label-tertiary,#8b93a1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.csearch-market .p{font-size:16px;font-weight:700;margin-top:3px;font-variant-numeric:tabular-nums;letter-spacing:.2px;}
.csearch-market .c{font-size:11px;margin-top:1px;font-variant-numeric:tabular-nums;}
.csearch-up{color:var(--dsw-alias-state-error-primary,#d9342b);}
.csearch-down{color:var(--dsw-alias-state-success-primary,#128a4a);}
.csearch-flat{color:var(--dsw-alias-label-tertiary,#8b93a1);}
.csearch-side-cta{display:flex;align-items:center;gap:10px;padding:12px;border-radius:14px;background:linear-gradient(135deg,rgba(76,134,255,.10),rgba(143,123,255,.10));border:1px solid rgba(76,134,255,.18);cursor:pointer;transition:all .18s ease;}
.csearch-side-cta:hover{background:linear-gradient(135deg,rgba(76,134,255,.16),rgba(143,123,255,.16));border-color:rgba(76,134,255,.34);}
.csearch-side-cta .txt{font-size:12.5px;font-weight:600;color:var(--dsw-alias-label-primary,#1f2328);}
.csearch-side-cta .sub{font-size:11px;color:var(--dsw-alias-label-tertiary,#8b93a1);margin-top:2px;}
.csearch-side-cta .arrow{margin-left:auto;color:var(--dsw-alias-brand-primary,#3d7bfd);}

/* ---- results ---- */
.csearch-topbar{display:flex;align-items:center;gap:10px;margin-bottom:18px;}
.csearch-search.compact{width:auto;flex:1 1 auto;margin:0;padding:4px 6px 4px 16px;box-shadow:0 2px 10px rgba(31,35,40,.05);border-radius:999px;}
.csearch-search.compact:focus-within{box-shadow:0 2px 14px rgba(61,123,253,.18),0 0 0 3px rgba(61,123,253,.10);}
.csearch-chart-inline{margin:10px 0 6px;}
.csearch-chart-inline .csearch-chart{margin:0;}
.csearch-results{margin-top:2px;}
.csearch-official-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 14px;padding:12px 14px;border:1px solid rgba(61,123,253,.20);border-radius:14px;background:linear-gradient(135deg,rgba(76,134,255,.08),rgba(143,123,255,.08));}
.csearch-official-label{font-size:12px;font-weight:700;color:var(--dsw-alias-brand-primary,#3d7bfd);white-space:nowrap;}
.csearch-official-link{padding:5px 12px;border-radius:999px;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,#e5e7eb);font-size:12px;color:var(--dsw-alias-label-primary,#1f2328);text-decoration:none;transition:all .15s ease;}
.csearch-official-link:hover{border-color:var(--dsw-alias-brand-primary,#3d7bfd);color:var(--dsw-alias-brand-primary,#3d7bfd);}
.csearch-tag-muted{font-size:11px;color:var(--dsw-alias-label-tertiary,#8b93a1);border:1px solid var(--dsw-alias-border-l1,#eef0f3);border-radius:999px;padding:1px 8px;}
/* ---- 搜索结果页：参考百度 / 谷歌（列表式、蓝标题、灰摘要、来源行） ---- */
.csearch-topbar{max-width:760px;margin:0 auto 6px;display:flex;align-items:center;gap:10px;padding-top:6px;}
.csearch-topbar .csearch-search-wrap{flex:1 1 auto;width:auto;margin:0;}
.csearch-search.compact{flex:1 1 auto;padding:6px 8px 6px 18px;height:44px;border-radius:999px;box-shadow:0 2px 12px rgba(31,35,40,.06);}
.csearch-search.compact .csearch-input{font-size:15px;}
.csearch-search.compact:focus-within{box-shadow:0 2px 16px rgba(61,123,253,.16),0 0 0 3px rgba(61,123,253,.10);}
.sr-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:760px;margin:0 auto;padding:4px 2px 12px;border-bottom:1px solid var(--dsw-alias-border-l1,#eef0f3);font-size:12.5px;color:var(--dsw-alias-label-tertiary,#8b93a1);}
.sr-tools{display:flex;align-items:center;gap:16px;}
.sr-tool-link{border:0;background:none;font:inherit;font-size:12.5px;color:var(--dsw-alias-label-tertiary,#8b93a1);cursor:pointer;padding:0;}
.sr-tool-link:hover{color:var(--dsw-alias-brand-primary,#3d7bfd);}
.sr-list{max-width:760px;margin:0 auto;}
.sr-item{padding:24px 2px 2px;border-bottom:1px solid var(--dsw-alias-border-l1,#eef0f3);}
.sr-item:last-child{border-bottom:0;}
.sr-meta{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--dsw-alias-label-tertiary,#8b93a1);margin-bottom:7px;min-width:0;}
.sr-fav{width:18px;height:18px;border-radius:50%;background:var(--dsw-alias-bg-layer-2,#f1f3f4);border:1px solid var(--dsw-alias-border-l1,#eef0f3);color:var(--dsw-alias-label-secondary,#5c6570);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex:none;}
.sr-site{font-size:13px;color:var(--dsw-alias-label-secondary,#5c6570);white-space:nowrap;flex:none;}
.sr-path{font-size:12px;color:var(--dsw-alias-label-tertiary,#8b93a1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}
.sr-badge{flex:none;font-size:11px;font-weight:700;color:var(--dsw-alias-brand-primary,#3d7bfd);border:1px solid rgba(61,123,253,.30);border-radius:4px;padding:0 5px;line-height:16px;}
.sr-tag{flex:none;font-size:11px;color:var(--dsw-alias-state-warn-primary,#b45309);}
.sr-title{display:block;font-size:18px;line-height:27px;font-weight:600;letter-spacing:.1px;color:#1a0dab;color:color-mix(in srgb,var(--dsw-alias-brand-primary,#1a0dab) 80%,#1a0dab);text-decoration:none;margin:0 0 7px;overflow-wrap:anywhere;}
.sr-title:hover{text-decoration:underline;}
.sr-snippet{font-size:14px;line-height:1.72;color:var(--dsw-alias-label-secondary,#5c6570);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:0 0 8px;}
.sr-actions{display:flex;align-items:center;gap:12px;padding:0 0 16px;font-size:12px;color:var(--dsw-alias-label-tertiary,#8b93a1);}
.sr-read{margin-left:auto;border:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:var(--dsw-alias-bg-layer-1,#fff);border-radius:6px;font:inherit;font-size:12px;color:var(--dsw-alias-label-secondary,#5c6570);padding:3px 10px;cursor:pointer;opacity:0;transition:opacity .15s ease,border-color .15s ease;}
.sr-item:hover .sr-read{opacity:1;}
.sr-read:hover{border-color:var(--dsw-alias-brand-primary,#3d7bfd);color:var(--dsw-alias-brand-primary,#3d7bfd);}
.csearch-chart{max-width:760px;margin:16px auto;}
.csearch-chart-inline{max-width:760px;margin:18px auto 6px;}
.csearch-official-bar{max-width:760px;margin:12px auto 0;}
@media (max-width:640px){.csearch-inner{padding:16px 18px 60px;}.sr-title{font-size:17px;}.sr-toolbar{font-size:12px;}}
.csearch-result{padding:16px 14px;border-radius:14px;border-bottom:1px solid var(--dsw-alias-border-l1,#eef0f3);transition:background .15s ease;}
.csearch-result:last-child{border-bottom:0;}
.csearch-result:hover{background:var(--dsw-alias-bg-layer-2,#f7f8fa);}
.csearch-result .head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.csearch-result a.title{color:var(--dsw-alias-label-primary,#1f2328);font-size:16px;line-height:24px;text-decoration:none;font-weight:600;letter-spacing:.1px;}
.csearch-result a.title:hover{color:var(--dsw-alias-brand-primary,#3d7bfd);}
.csearch-result .snippet{font-size:13px;line-height:21px;color:var(--dsw-alias-label-secondary,#5c6570);margin-top:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.csearch-result .foot{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px;font-size:11px;color:var(--dsw-alias-label-tertiary,#8b93a1);}
.csearch-result .foot .fav{width:14px;height:14px;border-radius:3px;margin-right:4px;vertical-align:-2px;}
.csearch-badge{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;border-radius:999px;padding:2px 9px;background:linear-gradient(135deg,rgba(76,134,255,.14),rgba(143,123,255,.14));color:var(--dsw-alias-brand-primary,#3d7bfd);white-space:nowrap;border:1px solid rgba(76,134,255,.22);}

/* ---- chart ---- */
.csearch-chart{border:1px solid var(--dsw-alias-border-l1,#eef0f3);border-radius:18px;background:var(--dsw-alias-bg-layer-1,#fff);padding:18px 20px 14px;margin-bottom:16px;box-shadow:0 1px 2px rgba(31,35,40,.03);}
.csearch-chart-head{display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:12px;}
.csearch-chart-name{font-size:13px;font-weight:600;color:var(--dsw-alias-label-secondary,#5c6570);}
.csearch-chart-price{font-size:30px;font-weight:800;line-height:1.15;margin-top:3px;font-variant-numeric:tabular-nums;letter-spacing:.3px;}
.csearch-chart-pct{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;margin-top:4px;font-variant-numeric:tabular-nums;}
.csearch-chart-tabs{margin-left:auto;display:flex;gap:2px;background:var(--dsw-alias-bg-layer-2,#f3f4f6);border-radius:10px;padding:3px;}
.csearch-chart-tab{border:0;background:transparent;font:inherit;font-size:12px;padding:5px 14px;border-radius:8px;cursor:pointer;color:var(--dsw-alias-label-secondary,#5c6570);transition:all .15s ease;}
.csearch-chart-tab.on{background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#1f2328);font-weight:700;box-shadow:0 1px 3px rgba(31,35,40,.12);}
.csearch-chart-stats{display:flex;gap:16px;flex-wrap:wrap;font-size:11px;color:var(--dsw-alias-label-tertiary,#8b93a1);margin-top:10px;padding-top:10px;border-top:1px dashed var(--dsw-alias-border-l1,#eef0f3);}
.csearch-svg{display:block;width:100%;height:auto;}

/* ---- search history / notices / cache / reader / sliders ---- */
.csearch-search-wrap{position:relative;width:min(680px,100%);margin:30px auto 0;}
.csearch-search-wrap .csearch-search{margin-top:0;width:100%;}
.csearch-topbar .csearch-search-wrap{flex:1 1 auto;width:auto;margin:0;}
.csearch-history{position:absolute;left:0;right:0;top:calc(100% + 8px);z-index:20;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:14px;box-shadow:0 12px 36px rgba(31,35,40,.14);padding:8px;max-height:320px;overflow:auto;}
.csearch-history-head{display:flex;align-items:center;justify-content:space-between;padding:2px 8px 6px;font-size:11px;color:var(--dsw-alias-label-tertiary,#8b93a1);}
.csearch-history-clear{border:0;background:none;font:inherit;font-size:11px;color:var(--dsw-alias-label-tertiary,#8b93a1);cursor:pointer;}
.csearch-history-clear:hover{color:var(--dsw-alias-brand-primary,#3d7bfd);}
.csearch-history-item{display:flex;align-items:center;gap:8px;width:100%;border:0;background:none;font:inherit;font-size:13px;color:var(--dsw-alias-label-secondary,#5c6570);padding:8px 10px;border-radius:9px;cursor:pointer;text-align:left;}
.csearch-history-item:hover,.csearch-history-item.on{background:var(--dsw-alias-bg-layer-2,#f3f4f6);color:var(--dsw-alias-label-primary,#1f2328);}
.csearch-home-meta{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:14px;font-size:12px;}
.csearch-link-btn{border:0;background:none;font:inherit;font-size:12px;color:var(--dsw-alias-brand-primary,#3d7bfd);cursor:pointer;padding:0;}
.csearch-link-btn:hover{text-decoration:underline;}
.csearch-notice{font-size:12px;line-height:18px;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#b45309) 10%,transparent);color:var(--dsw-alias-state-warn-primary,#b45309);border-radius:10px;padding:8px 12px;margin:8px 0;}
.csearch-results-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:12px 0 4px;font-size:12px;}
.csearch-cache{display:inline-flex;align-items:center;gap:8px;font-size:11px;color:var(--dsw-alias-label-tertiary,#8b93a1);}
.csearch-cache .csearch-link-btn{font-size:11px;}
.csearch-read-btn{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:var(--dsw-alias-bg-layer-1,#fff);border-radius:999px;font:inherit;font-size:11px;color:var(--dsw-alias-label-secondary,#5c6570);padding:1px 9px;cursor:pointer;margin-left:auto;}
.csearch-read-btn:hover{border-color:var(--dsw-alias-brand-primary,#3d7bfd);color:var(--dsw-alias-brand-primary,#3d7bfd);}
.csearch-score{font-size:11px;color:var(--dsw-alias-label-tertiary,#8b93a1);cursor:help;}
.csearch-reader{width:min(820px,100%);}
.csearch-reader-body{max-height:65vh;overflow:auto;white-space:pre-wrap;font-size:14px;line-height:24px;color:var(--dsw-alias-label-primary,#1f2328);padding:4px 2px;}
.csearch-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;}
.csearch-slider-row{display:flex;align-items:center;gap:12px;margin:10px 0;font-size:13px;color:var(--dsw-alias-label-secondary,#5c6570);}
.csearch-slider-label{width:64px;flex:none;}
.csearch-slider{flex:1;accent-color:var(--dsw-alias-brand-primary,#3d7bfd);}
.csearch-slider-value{width:32px;text-align:right;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary,#1f2328);}

/* ---- 特殊号码卡片 ---- */
.csearch-special{display:flex;align-items:center;gap:16px;max-width:760px;margin:12px auto 4px;padding:16px 20px;border:1px solid var(--dsw-alias-border-l1,#eef0f3);border-radius:16px;background:linear-gradient(135deg,rgba(61,123,253,.08),rgba(143,123,255,.06));}
.csearch-special-number{font-size:28px;font-weight:800;letter-spacing:.5px;color:var(--dsw-alias-brand-primary,#3d7bfd);font-variant-numeric:tabular-nums;white-space:nowrap;}
.csearch-special-info{flex:1 1 auto;min-width:0;}
.csearch-special-name{font-size:15px;font-weight:700;color:var(--dsw-alias-label-primary,#1f2328);}
.csearch-special-desc{font-size:12.5px;line-height:1.6;color:var(--dsw-alias-label-secondary,#5c6570);margin-top:4px;}

/* ---- weather modal ---- */
.csearch-modal-mask{position:fixed;inset:0;z-index:80;background:rgba(15,20,30,.38);display:flex;align-items:center;justify-content:center;padding:24px;}
.csearch-modal{width:min(520px,100%);max-height:min(640px,90vh);overflow:auto;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:20px;padding:20px 22px;box-shadow:0 24px 60px rgba(15,20,30,.25);}
.csearch-modal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
.csearch-modal-title{font-size:16px;font-weight:700;color:var(--dsw-alias-label-primary,#1f2328);}
.csearch-weather-now{display:flex;align-items:center;gap:16px;padding:10px 0 16px;border-bottom:1px solid var(--dsw-alias-border-l1,#eef0f3);}
.csearch-weather-emoji{font-size:44px;line-height:1;}
.csearch-weather-big{font-size:36px;font-weight:800;line-height:1.1;}
.csearch-weather-sub{font-size:13px;color:var(--dsw-alias-label-secondary,#5c6570);}
.csearch-weather-facts{margin-left:auto;display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--dsw-alias-label-tertiary,#8b93a1);text-align:right;}
.csearch-weather-days{display:flex;gap:8px;margin-top:14px;}
.csearch-weather-day{flex:1;text-align:center;font-size:11px;color:var(--dsw-alias-label-tertiary,#8b93a1);border:1px solid var(--dsw-alias-border-l1,#eef0f3);border-radius:10px;padding:8px 2px;background:var(--dsw-alias-bg-base,#fff);}
.csearch-weather-day b{display:block;font-size:12px;color:var(--dsw-alias-label-primary,#1f2328);font-weight:600;margin-top:2px;}
.csearch-aqi{display:flex;align-items:center;gap:8px;margin-top:14px;padding:10px 12px;border-radius:12px;background:var(--dsw-alias-bg-layer-2,#f3f4f6);font-size:13px;color:var(--dsw-alias-label-primary,#1f2328);}
.csearch-aqi-dot{width:10px;height:10px;border-radius:50%;flex:none;}
.csearch-aqi-sub{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-tertiary,#8b93a1);text-align:right;}
.csearch-clothing{margin-top:12px;font-size:12.5px;line-height:20px;color:var(--dsw-alias-label-secondary,#5c6570);}
.csearch-clothing b{color:var(--dsw-alias-label-primary,#1f2328);}
.csearch-forecast{margin-top:16px;}
.csearch-forecast-title{font-size:13px;font-weight:700;color:var(--dsw-alias-label-primary,#1f2328);margin-bottom:8px;}
.csearch-forecast-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;}
.csearch-forecast-cell{border:1px solid var(--dsw-alias-border-l1,#eef0f3);border-radius:9px;padding:7px 3px;text-align:center;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary,#5c6570);}
.csearch-forecast-cell b{display:block;font-size:11px;color:var(--dsw-alias-label-primary,#1f2328);margin:1px 0;}
.csearch-forecast-cell .muted{color:var(--dsw-alias-label-tertiary,#8b93a1);}
@media (max-width: 560px) { .csearch-forecast-grid{grid-template-columns:repeat(3,1fr);} }
.csearch-modal-city{display:flex;gap:8px;margin-top:16px;}
.csearch-modal-city .csearch-input{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:999px;padding:8px 14px;font-size:13px;}
.csearch-quick-cities{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;}

/* ---- image ---- */
.csearch-drop{border:1.5px dashed var(--dsw-alias-border-l3,#d9dde3);border-radius:18px;padding:40px 20px;text-align:center;color:var(--dsw-alias-label-tertiary,#8b93a1);cursor:pointer;transition:all .18s ease;background:var(--dsw-alias-bg-layer-1,#fff);}
.csearch-drop:hover,.csearch-drop.over{border-color:var(--dsw-alias-brand-primary,#3d7bfd);background:rgba(76,134,255,.05);color:var(--dsw-alias-brand-primary,#3d7bfd);}
.csearch-drop .big{font-size:34px;line-height:1;margin-bottom:10px;}
.csearch-drop .hint{font-size:13px;margin-top:4px;color:var(--dsw-alias-label-tertiary,#8b93a1);}
.csearch-imagerow{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:10px;}
.csearch-imagecard{display:block;border:1px solid var(--dsw-alias-border-l1,#eef0f3);border-radius:12px;overflow:hidden;background:var(--dsw-alias-bg-layer-2,#f7f8fa);text-decoration:none;transition:transform .16s ease,box-shadow .16s ease;}
.csearch-imagecard:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(31,35,40,.10);}
.csearch-imagecard img{display:block;width:100%;height:112px;object-fit:cover;}
.csearch-imagecard .cap{font-size:11px;line-height:16px;padding:7px 9px;color:var(--dsw-alias-label-secondary,#5c6570);max-height:46px;overflow:hidden;}
.csearch-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;}
.csearch-link{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:999px;padding:5px 13px;font-size:12px;color:var(--dsw-alias-label-secondary,#5c6570);text-decoration:none;background:var(--dsw-alias-bg-layer-1,#fff);transition:all .15s ease;}
.csearch-link:hover{border-color:var(--dsw-alias-brand-primary,#3d7bfd);color:var(--dsw-alias-brand-primary,#3d7bfd);}
.csearch-pages{display:flex;flex-direction:column;gap:2px;margin-top:8px;}
.csearch-pages a{font-size:13px;line-height:20px;color:var(--dsw-alias-brand-primary,#3d7bfd);text-decoration:none;padding:4px 0;}
.csearch-pages a:hover{text-decoration:underline;}
.csearch-recognition{font-size:13.5px;line-height:22px;white-space:pre-wrap;color:var(--dsw-alias-label-primary,#1f2328);margin-top:4px;}
/* ---- 以图搜图结果页 ---- */
.csearch-imgpage .csearch-topbar{max-width:760px;margin:0 auto 18px;}
.img-title{font-size:16px;font-weight:700;}
.img-drop{max-width:760px;margin:0 auto;border:1.5px dashed var(--dsw-alias-border-l3,#d9dde3);border-radius:18px;padding:56px 24px;text-align:center;cursor:pointer;background:var(--dsw-alias-bg-layer-1,#fff);transition:border-color .18s ease,background .18s ease;}
.img-drop:hover,.img-drop.over{border-color:var(--dsw-alias-brand-primary,#3d7bfd);background:color-mix(in srgb,var(--dsw-alias-brand-primary,#3d7bfd) 4%,var(--dsw-alias-bg-layer-1,#fff));}
.img-drop-icon{display:flex;justify-content:center;color:var(--dsw-alias-label-tertiary,#8b93a1);}
.img-drop-title{font-size:15px;font-weight:600;margin-top:14px;color:var(--dsw-alias-label-primary,#1f2328);}
.img-drop-hint{font-size:12.5px;color:var(--dsw-alias-label-tertiary,#8b93a1);margin-top:6px;}
.img-result{max-width:760px;margin:0 auto;}
.img-section{margin-top:26px;}
.img-section:first-child{margin-top:0;}
.img-section-title{font-size:13px;font-weight:700;color:var(--dsw-alias-label-secondary,#5c6570);margin-bottom:12px;letter-spacing:.2px;}
.img-recognition{background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,#eef0f3);border-radius:14px;padding:18px 20px;}
.cs-md-p{font-size:14px;line-height:1.75;color:var(--dsw-alias-label-primary,#1f2328);margin:0 0 10px;}
.cs-md-p:last-child{margin-bottom:0;}
.cs-md-h{font-size:15px;font-weight:700;color:var(--dsw-alias-label-primary,#1f2328);margin:16px 0 8px;}
.cs-md-list{margin:0 0 10px;padding-left:20px;font-size:14px;line-height:1.75;color:var(--dsw-alias-label-primary,#1f2328);}
.cs-md-list li{margin:3px 0;}
.cs-md-hr{height:1px;background:var(--dsw-alias-border-l1,#eef0f3);margin:14px 0;}
.img-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;}
.img-card{display:block;text-decoration:none;border-radius:12px;overflow:hidden;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,#eef0f3);transition:box-shadow .18s ease,transform .18s ease,border-color .18s ease;}
.img-card:hover{box-shadow:0 8px 24px rgba(31,35,40,.12);transform:translateY(-2px);border-color:var(--dsw-alias-border-l2,#e5e7eb);}
.img-thumb{aspect-ratio:1;background:var(--dsw-alias-bg-layer-2,#f3f4f6);display:flex;align-items:center;justify-content:center;overflow:hidden;}
.img-thumb img{width:100%;height:100%;object-fit:cover;display:block;}
.img-cap{font-size:12px;line-height:17px;color:var(--dsw-alias-label-secondary,#5c6570);padding:8px 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.img-pages{display:flex;flex-direction:column;}
.img-page{display:block;padding:11px 2px;border-bottom:1px solid var(--dsw-alias-border-l1,#eef0f3);text-decoration:none;}
.img-page:last-child{border-bottom:0;}
.img-page-title{font-size:14px;line-height:21px;color:#1a0dab;color:color-mix(in srgb,var(--dsw-alias-brand-primary,#1a0dab) 80%,#1a0dab);}
.img-page:hover .img-page-title{text-decoration:underline;}
.img-page-host{font-size:12px;color:var(--dsw-alias-label-tertiary,#8b93a1);margin-top:2px;}
.img-links{display:flex;flex-wrap:wrap;gap:8px;}
.img-link{font-size:12.5px;color:var(--dsw-alias-label-secondary,#5c6570);border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:999px;padding:5px 12px;text-decoration:none;background:var(--dsw-alias-bg-layer-1,#fff);}
.img-link:hover{border-color:var(--dsw-alias-brand-primary,#3d7bfd);color:var(--dsw-alias-brand-primary,#3d7bfd);}
.img-note{font-size:12.5px;color:var(--dsw-alias-label-tertiary,#8b93a1);margin-top:16px;line-height:1.7;}
.csearch-muted{color:var(--dsw-alias-label-tertiary,#8b93a1);font-size:12px;}
.csearch-empty{text-align:center;color:var(--dsw-alias-label-tertiary,#8b93a1);font-size:13px;padding:40px 0;}
.csearch-error{color:var(--dsw-alias-state-error-primary,#d9342b);font-size:12px;line-height:18px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d9342b) 8%,transparent);border-radius:10px;padding:9px 12px;margin:10px 0;}
.csearch-loading{color:var(--dsw-alias-label-tertiary,#8b93a1);font-size:12px;padding:22px 0;text-align:center;}
.csearch-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px;}

@media (max-width: 900px) {
  .csearch-body{grid-template-columns:1fr;}
  .csearch-news-grid{grid-template-columns:1fr;}
  .csearch-news-item:nth-last-child(-n+2){border-bottom:1px solid var(--dsw-alias-border-l1,#eef0f3);}
  .csearch-news-item:last-child{border-bottom:0;}
  .csearch-hero{padding:36px 0 24px;}
  .csearch-logo{font-size:38px;}
}
`

    function SearchIcon({ size }) {
      const s = size ?? 16
      return h('svg', { viewBox: '0 0 24 24', width: s, height: s, fill: 'none', 'aria-hidden': true },
        h('circle', { cx: 10.5, cy: 10.5, r: 6.5, stroke: 'currentColor', strokeWidth: 2 }),
        h('line', { x1: 15.5, y1: 15.5, x2: 21, y2: 21, stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }))
    }

    function ArrowLeft({ size }) {
      const s = size ?? 16
      return h('svg', { viewBox: '0 0 24 24', width: s, height: s, fill: 'none', 'aria-hidden': true },
        h('path', { d: 'M15 5l-7 7 7 7', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }))
    }

    function CameraIcon({ size }) {
      const s = size ?? 16
      return h('svg', { viewBox: '0 0 24 24', width: s, height: s, fill: 'none', 'aria-hidden': true },
        h('rect', { x: 3, y: 7, width: 18, height: 13, rx: 3, stroke: 'currentColor', strokeWidth: 2 }),
        h('circle', { cx: 12, cy: 13.5, r: 3.5, stroke: 'currentColor', strokeWidth: 2 }),
        h('path', { d: 'M9 7l1.2-2h3.6L15 7', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }))
    }

    function SearchBar({ value, onChange, onSubmit, onImage, compact, focusTick }) {
      const inputRef = useRef(null)
      const [open, setOpen] = useState(false)
      const [active, setActive] = useState(-1)
      const [history, setHistory] = useState(() => loadHistory())
      useEffect(() => {
        if (focusTick === undefined || focusTick === 0) return
        inputRef.current?.focus?.()
      }, [focusTick])
      const keyword = value.trim().toLowerCase()
      const filtered = keyword === ''
        ? history
        : history.filter(item => item.query.toLowerCase().includes(keyword))
      const submit = queryOverride => {
        const text = String(queryOverride ?? value).trim()
        if (text.length === 0) return
        onChange(text)
        const next = [{ query: text, ts: Date.now(), source: 'page' }, ...history.filter(item => item.query !== text)].slice(0, MAX_HISTORY)
        setHistory(next)
        saveHistory(next)
        setOpen(false)
        setActive(-1)
        onSubmit(text)
      }
      const handleKey = event => {
        if (event.key === 'ArrowDown' && open && filtered.length > 0) {
          event.preventDefault()
          setActive(index => Math.min(index + 1, filtered.length - 1))
          return
        }
        if (event.key === 'ArrowUp' && open && filtered.length > 0) {
          event.preventDefault()
          setActive(index => Math.max(index - 1, -1))
          return
        }
        if (event.key === 'Tab' && open && filtered.length > 0) {
          event.preventDefault()
          onChange(filtered[Math.max(active, 0)].query)
          setOpen(false)
          setActive(-1)
          return
        }
        if (event.key === 'Escape') { setOpen(false); setActive(-1); return }
        if (event.key !== 'Enter') return
        if (event.nativeEvent?.isComposing || event.keyCode === 229) return
        if (open && active >= 0 && filtered[active]) { submit(filtered[active].query); return }
        submit()
      }
      const historyList = open && filtered.length > 0
        ? h('div', { className: 'csearch-history' },
            h('div', { className: 'csearch-history-head' },
              h('span', null, t('recentSearches')),
              h('button', {
                className: 'csearch-history-clear',
                onMouseDown: event => event.preventDefault(),
                onClick: () => { const next = []; setHistory(next); saveHistory(next); setActive(-1) },
              }, t('clear'))),
            filtered.map((item, index) => h('button', {
              key: item.query + '|' + index,
              className: 'csearch-history-item' + (index === active ? ' on' : ''),
              onMouseDown: event => event.preventDefault(),
              onClick: () => submit(item.query),
            }, h(SearchIcon, { size: 13 }), h('span', null, item.query))))
        : null
      return h('div', { className: 'csearch-search-wrap' },
        h('div', { className: 'csearch-search' + (compact ? ' compact' : '') },
          h('span', { className: 'csearch-search-icon' }, h(SearchIcon, { size: 17 })),
          h('input', {
            ref: inputRef, className: 'csearch-input', value, placeholder: t('placeholder'), autoFocus: !compact,
            onChange: event => { onChange(event.target.value); setOpen(true); setActive(-1) },
            onFocus: () => setOpen(true),
            onBlur: () => setTimeout(() => setOpen(false), 150),
            onKeyDown: handleKey,
          }),
          h('div', { className: 'csearch-actions' },
            compact
              ? h('button', { className: 'csearch-btn mini', onClick: () => submit() }, t('search'))
              : h('button', { className: 'csearch-btn', onClick: () => submit() }, t('search')),
            onImage
              ? h('button', { className: 'csearch-btn ghost icon', title: t('imageSearch'), onClick: onImage }, h(CameraIcon, { size: 16 }))
              : null)),
        historyList)
    }

    function WeatherPill({ weather, onClick }) {
      if (!weather) return null
      return h('button', {
        className: 'csearch-weather', type: 'button', onClick,
        title: t('weatherDetail'), 'aria-label': t('weatherDetail'),
      },
        h('span', { className: 'ico' }, WEATHER_ICON(weather.code)),
        h('b', null, weather.temperature === null ? '—' : Math.round(weather.temperature) + '°'),
        h('span', null, weather.city || t('weather')),
        h('span', { style: { color: 'var(--dsw-alias-label-tertiary,#8b93a1)' } }, weather.text))
    }

    function WeatherPanel({ weather, city, onClose, onSaveCity, loading }) {
      const [value, setValue] = useState(city ?? '')
      useEffect(() => {
        const onKey = event => { if (event.key === 'Escape') onClose() }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [onClose])
      const submit = () => {
        const next = value.trim()
        if (next.length > 0) onSaveCity(next)
      }
      const days = weather?.days ?? []
      return h('div', { className: 'csearch-modal-mask', onClick: onClose },
        h('div', { className: 'csearch-modal', onClick: event => event.stopPropagation() },
          h('div', { className: 'csearch-modal-head' },
            h('div', { className: 'csearch-modal-title' }, t('weatherDetail') + (weather?.city ? ' · ' + weather.city : '')),
            h('button', { className: 'csearch-btn ghost icon', onClick: onClose, title: t('close') }, '✕')),
          loading
            ? h('div', { className: 'csearch-loading' }, t('loading'))
            : h('div', null,
                h('div', { className: 'csearch-weather-now' },
                  h('div', { className: 'csearch-weather-emoji' }, WEATHER_ICON(weather?.code)),
                  h('div', null,
                    h('div', { className: 'csearch-weather-big' }, weather?.temperature === null || weather?.temperature === undefined ? '—' : Math.round(weather.temperature) + '°'),
                    h('div', { className: 'csearch-weather-sub' }, weather?.text || '')),
                  h('div', { className: 'csearch-weather-facts' },
                    h('div', null, t('feelsLike') + ' ' + (weather?.apparentTemperature === null || weather?.apparentTemperature === undefined ? '—' : Math.round(weather.apparentTemperature) + '°')),
                    h('div', null, t('humidity') + ' ' + (weather?.humidity === null || weather?.humidity === undefined ? '—' : weather.humidity + '%')),
                    h('div', null, t('wind') + ' ' + (weather?.wind === null || weather?.wind === undefined ? '—' : weather.wind + ' km/h')),
                    weather?.fallback ? h('div', { className: 'csearch-muted' }, t('fallbackCity')) : null)),
                weather?.air
                  ? h('div', { className: 'csearch-aqi' },
                      h('span', { className: 'csearch-aqi-dot', style: { background: weather.air.color } }),
                      h('span', null, t('airQuality') + ' ' + weather.air.aqi + ' · ' + weather.air.level),
                      h('span', { className: 'csearch-aqi-sub' },
                        'PM2.5 ' + (weather.air.pm25 ?? '—') + ' · PM10 ' + (weather.air.pm10 ?? '—') + ' · O₃ ' + (weather.air.ozone ?? '—')))
                  : null,
                weather?.clothing
                  ? h('div', { className: 'csearch-clothing' },
                      h('b', null, t('clothing') + '：'), weather.clothing.level + ' · ' + weather.clothing.advice)
                  : null,
                h('div', { className: 'csearch-forecast' },
                  h('div', { className: 'csearch-forecast-title' }, t('forecast15') + '（' + days.length + '）'),
                  h('div', { className: 'csearch-forecast-grid' }, days.map(day =>
                    h('div', { key: day.date, className: 'csearch-forecast-cell' },
                      h('div', null, day.date.slice(5)),
                      h('div', { className: 'muted' }, day.text),
                      h('b', null, Math.round(day.max) + '° / ' + Math.round(day.min) + '°'),
                      h('div', { className: 'muted' }, (day.precipProb ?? 0) + '% ' + t('precip')),
                      h('div', { className: 'muted' }, day.clothing?.level ?? ''))))),
                h('div', { className: 'csearch-modal-city' },
                  h('input', {
                    className: 'csearch-input', value, placeholder: t('cityPlaceholder'),
                    onChange: event => setValue(event.target.value),
                    onKeyDown: event => {
                      if (event.key !== 'Enter') return
                      if (event.nativeEvent?.isComposing || event.keyCode === 229) return
                      submit()
                    },
                  }),
                  h('button', { className: 'csearch-btn mini', onClick: submit }, t('switchCity'))),
                h('div', { className: 'csearch-quick-cities' },
                  QUICK_CITIES.map(name => h('button', { key: name, className: 'csearch-chip', onClick: () => onSaveCity(name) }, name))))))
    }

    function KLineChart({ candles }) {
      if (!Array.isArray(candles) || candles.length === 0) {
        return h('div', { className: 'csearch-empty' }, t('noResults'))
      }
      const width = 860
      const height = 340
      const padTop = 10
      const padBottom = 22
      const priceHeight = 238
      const volTop = padTop + priceHeight + 18
      const volHeight = height - padBottom - volTop
      const padRight = 12
      const plotWidth = width - padRight
      const highs = candles.map(c => Number(c.high) || Number(c.close) || 0)
      const lows = candles.map(c => Number(c.low) || Number(c.close) || 0)
      const volumes = candles.map(c => Number(c.volume) || 0)
      const max = Math.max(...highs)
      const min = Math.min(...lows)
      const span = max - min || 1
      const maxVol = Math.max(...volumes) || 1
      const y = value => padTop + priceHeight - ((value - min) / span) * priceHeight
      const vy = value => volTop + volHeight - (value / maxVol) * volHeight
      const slot = plotWidth / candles.length
      const bodyWidth = Math.max(1.5, Math.min(9, slot * 0.62))
      const up = 'var(--dsw-alias-state-error-primary,#d9342b)'
      const down = 'var(--dsw-alias-state-success-primary,#128a4a)'
      const grid = 'var(--dsw-alias-border-l1,#eef0f3)'
      const axis = 'var(--dsw-alias-label-tertiary,#8b93a1)'
      const children = []
      for (let g = 0; g <= 4; g += 1) {
        const value = min + (span * g) / 4
        const gy = y(value)
        children.push(h('line', { key: 'g' + g, x1: 0, y1: gy, x2: plotWidth, y2: gy, stroke: grid, strokeWidth: 1 }))
        children.push(h('text', { key: 't' + g, x: plotWidth - 2, y: gy - 3, textAnchor: 'end', fontSize: 10, fill: axis, stroke: 'var(--dsw-alias-bg-base,#fff)', strokeWidth: 3, paintOrder: 'stroke' }, priceFormat(value)))
      }
      candles.forEach((candle, index) => {
        const cx = index * slot + slot / 2
        const open = Number(candle.open)
        const close = Number(candle.close)
        const high = Number(candle.high)
        const low = Number(candle.low)
        if (![open, close, high, low].every(Number.isFinite)) return
        const color = close >= open ? up : down
        const top = y(Math.max(open, close))
        const bottom = y(Math.min(open, close))
        const bodyHeight = Math.max(1, bottom - top)
        children.push(h('line', { key: 'w' + index, x1: cx, y1: y(high), x2: cx, y2: y(low), stroke: color, strokeWidth: 1 }))
        children.push(h('rect', { key: 'b' + index, x: cx - bodyWidth / 2, y: top, width: bodyWidth, height: bodyHeight, fill: color, rx: 0.5 }))
        const vh = Math.max(0.5, (volumes[index] / maxVol) * volHeight)
        children.push(h('rect', { key: 'v' + index, x: cx - bodyWidth / 2, y: volTop + volHeight - vh, width: bodyWidth, height: vh, fill: color, opacity: 0.35, rx: 0.5 }))
      })
      const last = candles[candles.length - 1]
      const lastClose = Number(last?.close)
      if (Number.isFinite(lastClose)) {
        const ly = y(lastClose)
        children.push(h('line', { key: 'last', x1: 0, y1: ly, x2: plotWidth, y2: ly, stroke: up, strokeWidth: 1, strokeDasharray: '5 4', opacity: 0.6 }))
        children.push(h('rect', { key: 'lastbg', x: plotWidth - 58, y: ly - 8, width: 56, height: 16, rx: 4, fill: up }))
        children.push(h('text', { key: 'lasttx', x: plotWidth - 30, y: ly + 4, textAnchor: 'middle', fontSize: 10, fill: '#fff', fontWeight: 700 }, priceFormat(lastClose)))
      }
      const first = candles[0]?.time ?? ''
      const lastTime = candles[candles.length - 1]?.time ?? ''
      children.push(h('text', { key: 'f', x: 2, y: height - 6, fontSize: 10, fill: axis }, first))
      children.push(h('text', { key: 'l', x: plotWidth - 2, y: height - 6, textAnchor: 'end', fontSize: 10, fill: axis }, lastTime))
      children.push(h('text', { key: 'vt', x: 2, y: volTop - 6, fontSize: 9, fill: axis }, 'VOL'))
      return h('svg', { className: 'csearch-svg', viewBox: '0 0 ' + width + ' ' + height, preserveAspectRatio: 'none' }, children)
    }

    function MinuteChart({ points, prev }) {
      if (!Array.isArray(points) || points.length === 0) {
        return h('div', { className: 'csearch-empty' }, t('noResults'))
      }
      const width = 860
      const height = 300
      const padTop = 10
      const padBottom = 22
      const padRight = 12
      const plotWidth = width - padRight
      const plotHeight = height - padTop - padBottom
      const values = points.map(point => Number(point.price)).filter(Number.isFinite)
      if (values.length === 0) return h('div', { className: 'csearch-empty' }, t('noResults'))
      let max = Math.max(...values)
      let min = Math.min(...values)
      if (Number.isFinite(Number(prev)) && Number(prev) > 0) {
        max = Math.max(max, Number(prev))
        min = Math.min(min, Number(prev))
      }
      const span = max - min || 1
      const y = value => padTop + plotHeight - ((value - min) / span) * plotHeight
      const x = index => (index / Math.max(1, points.length - 1)) * plotWidth
      const line = points.map((point, index) => (index === 0 ? 'M' : 'L') + x(index).toFixed(1) + ' ' + y(Number(point.price)).toFixed(1)).join(' ')
      const area = line + ' L' + plotWidth + ' ' + (padTop + plotHeight) + ' L0 ' + (padTop + plotHeight) + ' Z'
      const color = 'var(--dsw-alias-brand-primary,#3d7bfd)'
      const axis = 'var(--dsw-alias-label-tertiary,#8b93a1)'
      const grid = 'var(--dsw-alias-border-l1,#eef0f3)'
      const children = [
        h('defs', { key: 'defs' }, h('linearGradient', { id: 'cs-area-fill', x1: '0', y1: '0', x2: '0', y2: '1' },
          h('stop', { offset: '0%', stopColor: color, stopOpacity: 0.22 }),
          h('stop', { offset: '100%', stopColor: color, stopOpacity: 0.02 }))),
      ]
      for (let g = 0; g <= 4; g += 1) {
        const value = min + (span * g) / 4
        const gy = y(value)
        children.push(h('line', { key: 'g' + g, x1: 0, y1: gy, x2: plotWidth, y2: gy, stroke: grid, strokeWidth: 1 }))
        children.push(h('text', { key: 't' + g, x: plotWidth - 2, y: gy - 3, textAnchor: 'end', fontSize: 10, fill: axis, stroke: 'var(--dsw-alias-bg-base,#fff)', strokeWidth: 3, paintOrder: 'stroke' }, priceFormat(value)))
      }
      if (Number.isFinite(Number(prev)) && Number(prev) > 0) {
        children.push(h('line', { key: 'prev', x1: 0, y1: y(Number(prev)), x2: plotWidth, y2: y(Number(prev)), stroke: axis, strokeWidth: 1, strokeDasharray: '4 4', opacity: 0.65 }))
      }
      children.push(h('path', { key: 'area', d: area, fill: 'url(#cs-area-fill)' }))
      children.push(h('path', { key: 'line', d: line, fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinejoin: 'round' }))
      const last = points[points.length - 1]
      const lastPrice = Number(last?.price)
      if (Number.isFinite(lastPrice)) {
        const ly = y(lastPrice)
        children.push(h('circle', { key: 'dot', cx: plotWidth - 2, cy: ly, r: 3.5, fill: color }))
      }
      children.push(h('text', { key: 'lt', x: plotWidth - 2, y: height - 6, textAnchor: 'end', fontSize: 10, fill: axis }, String(last?.time ?? '')))
      return h('svg', { className: 'csearch-svg', viewBox: '0 0 ' + width + ' ' + height, preserveAspectRatio: 'none' }, children)
    }

    function ChartCard({ data }) {
      const { market, quote, day, minute } = data
      const hasDay = (day?.candles?.length ?? 0) > 0
      const hasMinute = (minute?.candles?.length ?? 0) > 10
      const [tab, setTab] = useState(hasDay ? 'day' : (hasMinute ? 'minute' : 'day'))
      if (!market) return null
      const candles = tab === 'day' ? day?.candles : undefined
      const points = tab === 'minute' ? minute?.candles : undefined
      const lastClose = candles?.[candles.length - 1]?.close
      const showPrice = quote ? quote.price : (Number.isFinite(Number(lastClose)) ? Number(lastClose) : null)
      const pct = quote ? quote.changePct : null
      const sub = pct > 0 ? t('rise') : pct < 0 ? t('fall') : ''
      return h('div', { className: 'csearch-chart' },
        h('div', { className: 'csearch-chart-head' },
          h('div', null,
            h('div', { className: 'csearch-chart-name' }, (quote?.name || market.label) + ' · ' + (quote?.source === 'tencent' ? t('tencent') : t('sina'))),
            h('div', { className: 'csearch-chart-price ' + pctClass(pct) }, showPrice === null ? '—' : priceFormat(showPrice)),
            h('div', { className: 'csearch-chart-pct ' + pctClass(pct) },
              h('span', null, pctText(pct) + (sub ? ' ' + sub : '')))),
          h('div', { className: 'csearch-chart-tabs' },
            h('button', { className: 'csearch-chart-tab' + (tab === 'day' && hasDay ? ' on' : ''), onClick: () => setTab('day') }, t('day')),
            h('button', { className: 'csearch-chart-tab' + (tab === 'minute' && hasMinute ? ' on' : ''), onClick: () => setTab('minute') }, t('minute')))),
        (tab === 'day' ? (hasDay ? h(KLineChart, { candles: day?.candles }) : h('div', { className: 'csearch-empty' }, t('noResults')))
          : (hasMinute ? h(MinuteChart, { points: minute?.candles, prev: quote?.prev }) : h('div', { className: 'csearch-empty' }, t('noResults')))),
        quote ? h('div', { className: 'csearch-chart-stats' },
          h('span', null, t('open') + ' ' + priceFormat(quote.open)),
          h('span', null, t('change') + ' ' + pctText(quote.changePct)),
          h('span', null, t('source') + ' ' + (quote.source === 'tencent' ? t('tencent') : t('sina'))),
          h('span', null, quote.time || '')) : null)
    }

    function HomeView({ onSearch, onImage, home, error, loading, onOpenWeather, usage, onOpenSort, focusTick }) {
      const [query, setQuery] = useState('')
      const submit = text => {
        const next = String(text ?? query).trim()
        if (next.length > 0) onSearch(next)
      }
      const weather = home?.weather
      const usageText = usage
        ? t('usageToday').replace('{n}', String(usage.today?.count ?? 0)).replace('{cost}', String(usage.today?.cost ?? 0))
        : ''
      return h('div', { className: 'csearch-home' },
        h('div', { className: 'csearch-header' },
          h('div', { className: 'csearch-brand' },
            h('span', { className: 'csearch-brand-dot' }, h(SearchIcon, { size: 12 })), t('title')),
          h(WeatherPill, { weather, onClick: onOpenWeather })),
        h('div', { className: 'csearch-hero' },
          h('div', { className: 'csearch-logo' }, t('title')),
          h('div', { className: 'csearch-tagline' }, t('subtitle')),
          h(SearchBar, { value: query, onChange: setQuery, onSubmit: submit, onImage, focusTick })),
        h('div', { className: 'csearch-home-meta' },
          usageText ? h('span', { className: 'csearch-muted' }, usageText) : null,
          h('button', { className: 'csearch-link-btn', onClick: onOpenSort }, t('sortPrefs'))),
        loading && home === null ? h('div', { className: 'csearch-loading' }, t('loading')) : null,
        error ? h('div', { className: 'csearch-error' }, error) : null)
    }

    function SortIcon({ size }) {
      const s = size ?? 16
      return h('svg', { viewBox: '0 0 24 24', width: s, height: s, fill: 'none', 'aria-hidden': true },
        h('line', { x1: 5, y1: 7, x2: 19, y2: 7, stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
        h('circle', { cx: 14, cy: 7, r: 2.2, fill: 'currentColor' }),
        h('line', { x1: 5, y1: 17, x2: 19, y2: 17, stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
        h('circle', { cx: 9, cy: 17, r: 2.2, fill: 'currentColor' }))
    }

    function SpecialCard({ data }) {
      const special = data?.special
      if (!special) return null
      const isTel = !special.website
      return h('div', { className: 'csearch-special' },
        h('div', { className: 'csearch-special-number' }, special.number),
        h('div', { className: 'csearch-special-info' },
          h('div', { className: 'csearch-special-name' }, special.name),
          h('div', { className: 'csearch-special-desc' }, special.desc)),
        isTel
          ? h('a', { className: 'csearch-btn mini', href: 'tel:' + special.number }, t('call'))
          : h('a', { className: 'csearch-btn mini', href: special.website, target: '_blank', rel: 'noreferrer' }, t('officialSite')))
    }

    function ResultsView({ data, query, onBack, onSearch, onImage, onRefresh, onRead, onOpenSort, focusTick }) {
      const [value, setValue] = useState(query ?? '')
      const results = data?.results ?? []
      const hasChart = Boolean(data?.quote || data?.market)
      const chartAfter = data?.chartAfter === true && hasChart
      const cachedMinutes = data?.cached && data?.cachedAt
        ? Math.max(0, Math.round((Date.now() - Number(data.cachedAt)) / 60000))
        : null
      const scoreTitle = item => (item.scores
        ? '综合 ' + item.scores.total + ' · 标题 ' + item.scores.title + ' · 摘要 ' + item.scores.snippet
          + ' · 时效 ' + item.scores.freshness + ' · 质量 ' + item.scores.quality
        : undefined)
      const siteIcon = host => h('span', { className: 'sr-fav' },
        String(host || '?').replace(/^www\./, '').charAt(0).toUpperCase())
      const prettyPath = url => {
        try {
          const parsed = new URL(url)
          const path = parsed.pathname === '/' ? '' : parsed.pathname
          return (path + parsed.search).slice(0, 80)
        } catch { return '' }
      }
      const renderRow = (item, index) => h('div', { key: 'r' + index, className: 'sr-item' },
        h('div', { className: 'sr-meta' },
          siteIcon(item.host),
          h('span', { className: 'sr-site' }, String(item.host || '').replace(/^www\./, '')),
          h('span', { className: 'sr-path' }, prettyPath(item.url)),
          item.official ? h('span', { className: 'sr-badge' }, '✓ ' + t('official')) : null,
          item.sponsored ? h('span', { className: 'sr-tag' }, t(AD_LABEL[item.sponsoredKind] ?? 'sponsored')) : null),
        h('a', { className: 'sr-title', href: item.url, target: '_blank', rel: 'noreferrer', title: scoreTitle(item) },
          item.title || item.host),
        item.snippet ? h('div', { className: 'sr-snippet' }, item.snippet) : null,
        h('div', { className: 'sr-actions' },
          h('span', { className: 'sr-date' }, item.date ? dateFormat(item.date) : ''),
          h('button', { className: 'sr-read', onClick: () => onRead(item.url) }, t('read'))))
      const head = chartAfter ? results.slice(0, 1) : []
      const tail = chartAfter ? results.slice(1) : results
      const seconds = Number.isFinite(Number(data?.elapsedMs)) ? (Number(data.elapsedMs) / 1000).toFixed(2) : ''
      return h('div', null,
        h('div', { className: 'csearch-topbar' },
          h('button', { className: 'csearch-btn ghost icon', title: t('back'), onClick: onBack }, h(ArrowLeft, { size: 18 })),
          h(SearchBar, {
            value,
            onChange: setValue,
            onSubmit: text => {
              const next = String(text ?? value).trim()
              if (next.length > 0) onSearch(next)
            },
            onImage, compact: true, focusTick,
          }),
          h('button', { className: 'csearch-btn ghost icon', title: t('sortPrefs'), onClick: onOpenSort }, h(SortIcon))),
        h('div', { className: 'sr-toolbar' },
          h('div', { className: 'sr-stats' },
            '找到 ' + results.length + ' 条结果' + (seconds === '' ? '' : '，用时 ' + seconds + ' 秒')
            + (data?.cached ? '（缓存）' : '')),
          h('div', { className: 'sr-tools' },
            data?.cached
              ? h('button', { className: 'sr-tool-link', onClick: onRefresh }, t('refresh'))
              : null,
            h('button', { className: 'sr-tool-link', onClick: onOpenSort }, t('sortPrefs')))),
        (data?.notices ?? []).map((notice, index) =>
          h('div', { key: 'n' + index, className: 'csearch-notice' }, notice.message)),
        h(SpecialCard, { data }),
        hasChart && !chartAfter ? h(ChartCard, { data }) : null,
        data?.exam?.official?.length
          ? h('div', { className: 'csearch-official-bar' },
              h('span', { className: 'csearch-official-label' }, t('officialEntry') + ' · ' + data.exam.label),
              data.exam.official.map(row =>
                h('a', { key: row.host, className: 'csearch-official-link', href: 'https://' + row.host + '/', target: '_blank', rel: 'noreferrer' }, row.name)))
          : null,
        h('div', { className: 'sr-list' },
          results.length === 0
            ? h('div', { className: 'csearch-empty' }, t('noResults'))
            : [
                ...head.map((item, index) => renderRow(item, index)),
                chartAfter ? h('div', { key: 'chart', className: 'csearch-chart-inline' }, h(ChartCard, { data })) : null,
                ...tail.map((item, index) => renderRow(item, index + head.length)),
              ])
      )
    }

    function ReaderPanel({ url, onClose }) {
      const [state, setState] = useState({ loading: true, error: '', data: null })
      useEffect(() => {
        let alive = true
        const controller = new AbortController()
        setState({ loading: true, error: '', data: null })
        getJson('/dsh-clean-search/api/read?url=' + encodeURIComponent(url), { signal: controller.signal })
          .then(data => { if (alive) setState({ loading: false, error: '', data }) })
          .catch(error => { if (alive) setState({ loading: false, error: error.message, data: null }) })
        return () => { alive = false; controller.abort() }
      }, [url])
      useEffect(() => {
        const onKey = event => { if (event.key === 'Escape') onClose() }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [onClose])
      return h('div', { className: 'csearch-modal-mask', onClick: onClose },
        h('div', { className: 'csearch-modal csearch-reader', onClick: event => event.stopPropagation() },
          h('div', { className: 'csearch-modal-head' },
            h('div', { className: 'csearch-modal-title' }, state.data?.title || t('reading')),
            h('a', { className: 'csearch-muted', href: url, target: '_blank', rel: 'noreferrer' }, t('openOriginal')),
            h('button', { className: 'csearch-btn ghost icon', onClick: onClose, title: t('close') }, '✕')),
          state.loading
            ? h('div', { className: 'csearch-loading' }, t('loading'))
            : state.error
              ? h('div', { className: 'csearch-error' }, state.error)
              : h('div', null,
                  h('div', { className: 'csearch-reader-body' }, state.data.content),
                  state.data.truncated ? h('div', { className: 'csearch-muted' }, t('truncated')) : null)))
    }

    function SortPanel({ sliders, onApply, onClose }) {
      const [local, setLocal] = useState(sliders)
      const row = (key, label) => h('label', { className: 'csearch-slider-row', key },
        h('span', { className: 'csearch-slider-label' }, label),
        h('input', {
          type: 'range', min: 0, max: 100, value: local[key], className: 'csearch-slider',
          onChange: event => setLocal(prev => ({ ...prev, [key]: Number(event.target.value) })),
        }),
        h('span', { className: 'csearch-slider-value' }, String(local[key])))
      return h('div', { className: 'csearch-modal-mask', onClick: onClose },
        h('div', { className: 'csearch-modal', onClick: event => event.stopPropagation() },
          h('div', { className: 'csearch-modal-head' },
            h('div', { className: 'csearch-modal-title' }, t('sortPrefs')),
            h('button', { className: 'csearch-btn ghost icon', onClick: onClose, title: t('close') }, '✕')),
          h('div', { className: 'csearch-muted', style: { marginBottom: 14 } }, t('sortHint')),
          row('rel', t('sliderRelevance')),
          row('fresh', t('sliderFreshness')),
          row('off', t('sliderOfficial')),
          h('div', { className: 'csearch-modal-actions' },
            h('button', { className: 'csearch-btn ghost mini', onClick: () => setLocal({ rel: 100, fresh: 100, off: 100 }) }, t('reset')),
            h('button', { className: 'csearch-btn', onClick: () => { onApply(local); onClose() } }, t('apply')))))
    }

    // 轻量 Markdown 渲染：把识别结果里的 ###、**、*、--- 等符号转成干净排版
    function renderMarkdownLite(text) {
      const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n')
      const blocks = []
      let paragraph = []
      let list = null
      const flushParagraph = () => {
        if (paragraph.length > 0) { blocks.push({ type: 'p', lines: paragraph }); paragraph = [] }
      }
      const flushList = () => {
        if (list !== null && list.length > 0) { blocks.push({ type: 'list', items: list }); list = null }
      }
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (line === '') { flushParagraph(); flushList(); continue }
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { flushParagraph(); flushList(); blocks.push({ type: 'hr' }); continue }
        const heading = /^#{1,6}\s+(.*)$/.exec(line)
        if (heading) {
          flushParagraph(); flushList()
          blocks.push({ type: 'h', text: heading[1].replace(/^[*_]+|[*_]+$/g, '').trim() })
          continue
        }
        const bullet = /^[-*+]\s+(.*)$/.exec(line) ?? /^\d+[.)]\s+(.*)$/.exec(line)
        if (bullet !== null) { flushParagraph(); if (list === null) list = []; list.push(bullet[1]); continue }
        flushList()
        paragraph.push(line)
      }
      flushParagraph(); flushList()
      const clean = value => String(value)
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/[*_]{1,2}/g, '')
        .trim()
      return blocks.map((block, index) => {
        if (block.type === 'hr') return h('div', { key: index, className: 'cs-md-hr' })
        if (block.type === 'h') return h('div', { key: index, className: 'cs-md-h' }, clean(block.text))
        if (block.type === 'list') return h('ul', { key: index, className: 'cs-md-list' }, block.items.map((item, i) => h('li', { key: i }, clean(item))))
        return h('p', { key: index, className: 'cs-md-p' }, clean(block.lines.join(' ')))
      })
    }

    function ImageIcon({ size }) {
      const s = size ?? 44
      return h('svg', { viewBox: '0 0 24 24', width: s, height: s, fill: 'none', 'aria-hidden': true },
        h('rect', { x: 3, y: 4, width: 18, height: 16, rx: 3, stroke: 'currentColor', strokeWidth: 1.6 }),
        h('circle', { cx: 8.5, cy: 9.5, r: 1.8, fill: 'currentColor' }),
        h('path', { d: 'M4 16.5l4.2-4.2a1.5 1.5 0 0 1 2.1 0l2.2 2.2 1.6-1.6a1.5 1.5 0 0 1 2.1 0L21 16.5', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }))
    }

    function ImageView({ onBack, result, busy, error, onPick }) {
      const [over, setOver] = useState(false)
      const dropProps = {
        className: 'img-drop' + (over ? ' over' : ''),
        onClick: onPick,
        onDragOver: event => { event.preventDefault(); setOver(true) },
        onDragLeave: () => setOver(false),
        onDrop: event => {
          event.preventDefault()
          setOver(false)
          const file = event.dataTransfer?.files?.[0]
          if (file !== undefined) onPick(file)
        },
      }
      return h('div', { className: 'csearch-imgpage' },
        h('div', { className: 'csearch-topbar' },
          h('button', { className: 'csearch-btn ghost icon', title: t('back'), onClick: onBack }, h(ArrowLeft, { size: 18 })),
          h('div', { className: 'img-title' }, t('imageTitle')),
          h('button', { className: 'csearch-btn mini', style: { marginLeft: 'auto' }, onClick: () => onPick() }, t('chooseImage'))),
        error ? h('div', { className: 'csearch-error' }, error) : null,
        busy ? h('div', { className: 'csearch-loading' }, t('loading')) : null,
        result === null
          ? h('div', dropProps,
              h('div', { className: 'img-drop-icon' }, h(ImageIcon, { size: 44 })),
              h('div', { className: 'img-drop-title' }, t('imageHint')),
              h('div', { className: 'img-drop-hint' }, t('imageDropHint')))
          : h('div', { className: 'img-result' },
              result.recognition
                ? h('div', { className: 'img-section img-recognition' },
                    h('div', { className: 'img-section-title' }, t('recognition')),
                    renderMarkdownLite(result.recognition))
                : null,
              result.images?.length
                ? h('div', { className: 'img-section' },
                    h('div', { className: 'img-section-title' }, t('similar')),
                    h('div', { className: 'img-grid' }, result.images.map((image, index) =>
                      h('a', { key: index, className: 'img-card', href: image.pageUrl || image.imageUrl, target: '_blank', rel: 'noreferrer' },
                        h('div', { className: 'img-thumb' },
                          h('img', { src: image.imageUrl, alt: image.title || '', loading: 'lazy', onError: event => { event.currentTarget.style.display = 'none' } })),
                        h('div', { className: 'img-cap' }, image.title || image.pageUrl)))))
                : null,
              result.pages?.length
                ? h('div', { className: 'img-section' },
                    h('div', { className: 'img-section-title' }, t('pages')),
                    h('div', { className: 'img-pages' }, result.pages.map((page, index) =>
                      h('a', { key: index, className: 'img-page', href: page.url, target: '_blank', rel: 'noreferrer' },
                        h('div', { className: 'img-page-title' }, page.title || page.url),
                        h('div', { className: 'img-page-host' }, (() => { try { return new URL(page.url).hostname } catch { return '' } })())))))
                : null,
              result.deepseekError === 'NO_IMAGE_RESULTS'
                ? h('div', { className: 'img-note' }, t('imageNoResult'))
                : (result.deepseekError ? h('div', { className: 'img-note' }, t('deepseekFailed') + '（' + result.deepseekError + '）') : null),
              result.links?.length
                ? h('div', { className: 'img-section' },
                    h('div', { className: 'img-section-title' }, t('links')),
                    h('div', { className: 'img-links' }, result.links.map(link =>
                      h('a', { key: link.id, className: 'img-link', href: link.url, target: '_blank', rel: 'noreferrer' }, link.name))))
                : null))
    }

    function CleanSearchPage() {
      const seqRef = useRef(0)
      const [city, setCity] = useState(() => {
        try { return (typeof localStorage !== 'undefined' && localStorage.getItem(CITY_KEY)) || '' } catch { return '' }
      })
      const [weatherOpen, setWeatherOpen] = useState(false)
      const [sortOpen, setSortOpen] = useState(false)
      const [readerUrl, setReaderUrl] = useState('')
      const [focusTick, setFocusTick] = useState(0)
      const [sliders, setSliders] = useState(() => loadSliders())
      const [usage, setUsage] = useState(null)
      const [view, setView] = useState('home')
      const [query, setQuery] = useState('')
      const [home, setHome] = useState(null)
      const [homeError, setHomeError] = useState('')
      const [homeLoading, setHomeLoading] = useState(true)
      const [results, setResults] = useState(null)
      const [resultsLoading, setResultsLoading] = useState(false)
      const [resultsError, setResultsError] = useState('')
      const [imageResult, setImageResult] = useState(null)
      const [imageBusy, setImageBusy] = useState(false)
      const [imageError, setImageError] = useState('')
      const imageRef = useRef(null)

      useEffect(() => {
        let alive = true
        setHomeLoading(true)
        getJson('/dsh-clean-search/api/home' + (city === '' ? '' : '?city=' + encodeURIComponent(city)))
          .then(data => { if (alive) { setHome(data); setHomeError('') } })
          .catch(error => { if (alive) setHomeError(error.message) })
          .finally(() => { if (alive) setHomeLoading(false) })
        return () => { alive = false }
      }, [city])

      useEffect(() => {
        let alive = true
        getJson('/dsh-clean-search/api/usage')
          .then(data => { if (alive) setUsage(data) })
          .catch(() => { /* 用量统计失败不影响首页 */ })
        return () => { alive = false }
      }, [])

      useEffect(() => {
        const onKey = event => {
          if (String(event.key).toLowerCase() !== 'k') return
          if (!(event.metaKey || event.ctrlKey)) return
          const target = event.target
          const editable = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
          if (editable) return
          event.preventDefault()
          setFocusTick(tick => tick + 1)
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [])

      const runSearch = useCallback(async (text, options = {}) => {
        const seq = ++seqRef.current
        const active = options.sliders ?? sliders
        setView('results')
        setQuery(text)
        setResultsLoading(true)
        setResultsError('')
        try {
          const params = new URLSearchParams({ q: text })
          if (options.fresh) params.set('fresh', '1')
          params.set('rel', String(active.rel))
          params.set('freshW', String(active.fresh))
          params.set('off', String(active.off))
          const data = await getJson('/dsh-clean-search/api/search?' + params.toString())
          if (seq !== seqRef.current) return
          setResults(data)
        } catch (error) {
          if (seq !== seqRef.current) return
          setResultsError(error.message)
          setResults(null)
        } finally {
          if (seq === seqRef.current) setResultsLoading(false)
        }
      }, [sliders])

      const applySliders = useCallback(next => {
        setSliders(next)
        saveSliders(next)
        if (view === 'results') void runSearch(query, { sliders: next })
      }, [runSearch, query, view])

      const uploadFile = useCallback(async (file) => {
        if (file === undefined) return
        setView('image')
        setImageBusy(true)
        setImageError('')
        setImageResult(null)
        try {
          const readFileAsDataUrl = async () => new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result))
            reader.onerror = () => reject(new Error('读取图片失败'))
            reader.readAsDataURL(file)
          })
          // 大图先压到长边 1600 / JPEG 0.85，减少上传与模型处理时间（避免图搜超时）
          const compress = async () => {
            try {
              if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return undefined
              const bitmap = await createImageBitmap(file)
              const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
              if (scale === 1 && file.size <= 1024 * 1024) {
                if (typeof bitmap.close === 'function') bitmap.close()
                return undefined
              }
              const canvas = document.createElement('canvas')
              canvas.width = Math.max(1, Math.round(bitmap.width * scale))
              canvas.height = Math.max(1, Math.round(bitmap.height * scale))
              const context = canvas.getContext('2d')
              if (!context) return undefined
              context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
              if (typeof bitmap.close === 'function') bitmap.close()
              return canvas.toDataURL('image/jpeg', 0.85)
            } catch { return undefined }
          }
          const dataUrl = (await compress()) ?? await readFileAsDataUrl()
          const body = await getJson('/dsh-clean-search/api/image-search', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: dataUrl }),
          })
          setImageResult(body)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          setImageError(/aborted due to timeout|TimeoutError/i.test(message) ? t('imageTimeout') : message)
        } finally {
          setImageBusy(false)
        }
      }, [])

      const pickImage = useCallback((file) => {
        if (file instanceof Blob) {
          setView('image')
          if (file.size > 6 * 1024 * 1024) { setImageError(t('imageTooLarge')); return }
          if (typeof file.type === 'string' && file.type !== '' && !file.type.startsWith('image/')) { setImageError(t('imageTypeError')); return }
          void uploadFile(file)
          return
        }
        setView('image')
        imageRef.current?.click?.()
      }, [uploadFile])

      const saveCity = useCallback((next) => {
        const value = String(next ?? '').trim()
        if (value.length === 0) return
        setCity(value)
        try { localStorage.setItem(CITY_KEY, value) } catch { /* 隐私模式下只影响本会话 */ }
      }, [])

      return h('div', { className: 'csearch-root' },
        h('style', null, CSS),
        h('div', { className: 'csearch-inner' },
          view === 'home'
            ? h(HomeView, {
                home, loading: homeLoading, error: homeError,
                onSearch: runSearch,
                onImage: pickImage,
                onOpenWeather: () => setWeatherOpen(true),
                usage,
                onOpenSort: () => setSortOpen(true),
                focusTick,
              })
            : null,
          view === 'results'
            ? (resultsLoading
                ? h('div', null,
                    h('div', { className: 'csearch-topbar' },
                      h('button', { className: 'csearch-btn ghost icon', onClick: () => setView('home') }, h(ArrowLeft, { size: 18 }))),
                    h('div', { className: 'csearch-loading' }, t('loading')))
                : resultsError
                  ? h('div', null,
                      h('div', { className: 'csearch-topbar' },
                        h('button', { className: 'csearch-btn ghost icon', onClick: () => setView('home') }, h(ArrowLeft, { size: 18 })),
                        h('button', { className: 'csearch-btn mini', onClick: () => runSearch(query) }, t('retry'))),
                      h('div', { className: 'csearch-error' }, resultsError))
                  : h(ResultsView, {
                      data: results,
                      query,
                      onBack: () => setView('home'),
                      onSearch: runSearch,
                      onImage: pickImage,
                      onRefresh: () => runSearch(query, { fresh: true }),
                      onRead: url => setReaderUrl(url),
                      onOpenSort: () => setSortOpen(true),
                      focusTick,
                    }))
            : null,
          view === 'image'
            ? h(ImageView, { onBack: () => setView('home'), result: imageResult, busy: imageBusy, error: imageError, onPick: pickImage })
            : null,
          h('input', {
            ref: imageRef, type: 'file', accept: 'image/*', style: { display: 'none' },
            onChange: event => {
              const file = event.target.files?.[0]
              event.target.value = ''
              void uploadFile(file)
            },
          }),
          weatherOpen
            ? h(WeatherPanel, {
                weather: home?.weather,
                city,
                loading: homeLoading,
                onClose: () => setWeatherOpen(false),
                onSaveCity: saveCity,
              })
            : null,
          sortOpen
            ? h(SortPanel, { sliders, onApply: applySliders, onClose: () => setSortOpen(false) })
            : null,
          readerUrl !== ''
            ? h(ReaderPanel, { url: readerUrl, onClose: () => setReaderUrl('') })
            : null),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        try {
          ctx.effect(() => ctx.locale.register(NS, { zh: ZHDICT, en: ENDICT }), 'clean-search: dictionaries')
          t = ctx.locale.bind(NS)
        } catch (error) {
          console.warn('[dsh-clean-search] locale unavailable', error)
        }
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main', key: 'clean-search', locale: NS, inject: () => ({ t }),
        }, CleanSearchPage))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: 'clean-search', order: 2, label: () => t('nav'), locale: NS,
        }, SearchIcon))
      },
    }
  },
})
