/**
 * QQ Emoji Service
 * Manages fetching, searching, and caching of QQNT animated emojis from QFace.
 */

const SUPER_EMOJI_NAMES = {
  '422': '彩虹 (超级表情)',
  '423': '长城 (超级表情)',
  '432': '隐藏款 (超级表情)',
  '450': '撇嘴 (超级表情)',
  '451': '色 (超级表情)',
  '452': '微笑 (超级表情)',
  '453': '发呆 (超级表情)',
  '454': '酷 (超级表情)',
  '455': '害羞 (超级表情)',
  '456': '闭嘴 (超级表情)',
  '457': '睡 (超级表情)',
  '458': '我? (超级表情)',
  '459': '优雅 (超级表情)',
  '460': '等等 (超级表情)',
  '461': '死机 (超级表情)',
  '462': '无语 (超级表情)',
  '463': '新年快乐',
  '464': '飙车 (红马跑车)',
  '465': '抢红包',
  '466': '妖娆 (回眸一笑)',
  '467': '洗剪吹 (托尼老师)',
  '468': '暗中观察 (探头)',
  '469': '男神嘘',
  '470': '企鹅马头套',
  '472': '心碎 (超级表情)',
  '474': '出拳 (超级表情)',
  '475': '干饭 (超级表情)',
  '476': '老哥啥事 (超级表情)',
  '477': '你懂的 (超级表情)',
  '478': '对勾 (超级表情)',
  '479': '叉叉 (超级表情)',
  '480': '退退退 (超级表情)',
  '481': '沉迷学习 (超级表情)',
  '482': '融化 (超级表情)',
  '483': '喵喵 (超级表情)',
  '484': '比心 (超级表情)',
  '485': '摸摸 (超级表情)',
  '488': '老六 (超级表情)',
  '489': '知识学杂了 (超级表情)',
  '490': '能处 (超级表情)',
  '491': '天秀 (超级表情)',
  '492': '打量 (超级表情)',
  '493': '起个大早 (超级表情)'
};

class QQEmojiService {
  constructor() {
    this.catalog = [];
    this.memoryCache = new Map(); // id -> decoded frames
    this.isLoaded = false;
    this.baseUrl = 'https://koishi.js.org/QFace';
  }

  async init() {
    if (this.isLoaded) return;

    // 1. Direct synchronous memory catalog (works 100% offline & under file:// protocol without CORS)
    if (typeof window !== 'undefined' && window.QQ_EMOJI_CATALOG && Array.isArray(window.QQ_EMOJI_CATALOG)) {
      this.catalog = window.QQ_EMOJI_CATALOG;
      this.isLoaded = true;
      return;
    }

    try {
      const res = await fetch('data/emoji_catalog.json');
      if (res.ok) {
        this.catalog = await res.json();
      } else {
        throw new Error('Local catalog not found, falling back to remote index');
      }
    } catch (err) {
      console.warn('Loading remote QFace _index.json fallback...', err);
      try {
        const res = await fetch(`${this.baseUrl}/assets/qq_emoji/_index.json`);
        const list = await res.json();
        this.catalog = list
          .filter(e => e.assets && e.assets.some(a => a.type === 2))
          .map(e => {
            const apng = e.assets.find(a => a.type === 2);
            const png = e.assets.find(a => a.type === 0);
            const rawDesc = (e.describe || '').replace(/^\//, '').trim();
            const name = rawDesc || SUPER_EMOJI_NAMES[e.emojiId] || `表情 #${e.emojiId}`;
            return {
              id: e.emojiId,
              name,
              hasApng: true,
              apngPath: apng ? apng.path : null,
              pngPath: png ? png.path : null,
              isSuperEmoji: !rawDesc || !!SUPER_EMOJI_NAMES[e.emojiId]
            };
          });
      } catch (e2) {
        console.error('Failed to fetch emoji catalog:', e2);
      }
    }

    this.isLoaded = true;
  }

  getCatalog() {
    return this.catalog;
  }

  search(keyword) {
    if (!keyword || !keyword.trim()) {
      return this.catalog;
    }
    const kw = keyword.trim().toLowerCase().replace(/^\//, '');
    return this.catalog.filter(e => 
      e.name.toLowerCase().includes(kw) || e.id === kw
    );
  }

  getEmojiInfo(id) {
    return this.catalog.find(e => e.id === String(id)) || null;
  }

  getThumbnailUrl(id) {
    const info = this.getEmojiInfo(id);
    if (!info) return '';
    const localThumbs = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '21', '49', '96', '104', '110', '182', '212', '268', '277', '281', '297', '305', '318', '324', '326', '452', '464', '466', '468', '475', '480', '488'];
    if (localThumbs.includes(String(id))) {
      return `assets/qq_emoji/${id}_thumb.png`;
    }
    if (info.pngPath) {
      return `${this.baseUrl}/${info.pngPath}`;
    }
    if (info.apngPath) {
      return `${this.baseUrl}/${info.apngPath}`;
    }
    return `${this.baseUrl}/assets/qq_emoji/${id}/png/${id}.png`;
  }

  /**
   * Fetches and decodes the animated APNG/GIF frames for a given emoji ID.
   * @param {string|number} id 
   * @returns {Promise<{ frames: Array, width: number, height: number, totalDuration: number, id: string, name: string }>}
   */
  async loadEmojiFrames(id) {
    const strId = String(id);
    if (this.memoryCache.has(strId)) {
      // Clone canvases so operations don't mutate cache
      const cached = this.memoryCache.get(strId);
      return this.cloneFramesResult(cached);
    }

    const info = this.getEmojiInfo(strId);
    const candidateUrls = [];

    // Try local asset first if downloaded locally
    const localThumbs = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '21', '49', '96', '104', '110', '182', '212', '268', '277', '281', '297', '305', '318', '324', '326', '452', '464', '466', '468', '475', '480', '488'];
    if (localThumbs.includes(strId)) {
      candidateUrls.push(`assets/qq_emoji/${strId}.png`);
    }

    // Try remote CDN
    if (info && info.apngPath) {
      candidateUrls.push(`${this.baseUrl}/${info.apngPath}`);
    } else {
      candidateUrls.push(`${this.baseUrl}/assets/qq_emoji/${strId}/apng/${strId}.png`);
    }

    // Try static PNG fallback
    if (info && info.pngPath) {
      candidateUrls.push(`${this.baseUrl}/${info.pngPath}`);
    }

    let buffer = null;
    let lastErr = null;

    for (const url of candidateUrls) {
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          buffer = await resp.arrayBuffer();
          break;
        }
      } catch (err) {
        lastErr = err;
      }
    }

    if (!buffer) {
      console.warn(`无法通过网络/本地加载表情 [${strId}]，启用备用表情渲染:`, lastErr);
      const fallbackFrames = this.generateProceduralEmoji(strId, info ? info.name : '微笑');
      const result = {
        frames: fallbackFrames,
        width: 128,
        height: 128,
        totalDuration: fallbackFrames.reduce((acc, f) => acc + f.delay, 0),
        id: strId,
        name: info ? info.name : `表情 ${strId}`
      };
      this.memoryCache.set(strId, result);
      return this.cloneFramesResult(result);
    }

    const decoded = await window.GifDecoder.decode(buffer);
    const result = {
      ...decoded,
      id: strId,
      name: info ? info.name : `表情 ${strId}`
    };

    this.memoryCache.set(strId, result);
    return this.cloneFramesResult(result);
  }

  generateProceduralEmoji(id, name) {
    const size = 128;
    const numFrames = 8;
    const frames = [];

    for (let f = 0; f < numFrames; f++) {
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');

      const t = (f / numFrames) * Math.PI * 2;
      const blink = Math.sin(t) > 0.8;
      const wobble = Math.sin(t) * 3;

      ctx.save();
      ctx.translate(size / 2, size / 2 + wobble);

      // Yellow face base
      const grad = ctx.createRadialGradient(-15, -20, 8, 0, 0, 52);
      grad.addColorStop(0, '#ffdf00');
      grad.addColorStop(0.85, '#f59e0b');
      grad.addColorStop(1, '#d97706');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 48, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#1e1b18';
      if (blink) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#1e1b18';
        ctx.beginPath();
        ctx.arc(-18, -6, 8, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(18, -6, 8, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(-18, -6, 6, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(18, -6, 6, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eye reflections
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-20, -10, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(16, -10, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Smile mouth
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 8, 22, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();

      ctx.restore();

      frames.push({
        index: f,
        canvas: c,
        delay: 90,
        width: size,
        height: size
      });
    }

    return frames;
  }

  cloneFramesResult(res) {
    return {
      ...res,
      frames: res.frames.map(f => {
        const c = document.createElement('canvas');
        c.width = f.canvas.width;
        c.height = f.canvas.height;
        c.getContext('2d').drawImage(f.canvas, 0, 0);
        return {
          ...f,
          canvas: c
        };
      })
    };
  }
}

window.QQEmojiService = new QQEmojiService();
