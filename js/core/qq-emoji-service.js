/**
 * QQ Emoji Service
 * Manages fetching, searching, and caching of QQNT animated emojis from QFace.
 */

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
          .filter(e => {
            const apng = e.assets && e.assets.find(a => a.type === 2);
            return !!apng && e.describe && e.describe.trim().length > 0;
          })
          .map(e => {
            const apng = e.assets.find(a => a.type === 2);
            const png = e.assets.find(a => a.type === 0);
            return {
              id: e.emojiId,
              name: (e.describe || '').replace(/^\//, ''),
              hasApng: true,
              apngPath: apng ? apng.path : null,
              pngPath: png ? png.path : null
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
      return this.catalog.slice(0, 100);
    }
    const kw = keyword.trim().toLowerCase().replace(/^\//, '');
    return this.catalog.filter(e => 
      e.name.toLowerCase().includes(kw) || e.id === kw
    ).slice(0, 100);
  }

  getEmojiInfo(id) {
    return this.catalog.find(e => e.id === String(id)) || null;
  }

  getThumbnailUrl(id) {
    const info = this.getEmojiInfo(id);
    if (!info) return '';
    const localThumbs = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '21', '49', '96', '104', '182', '212', '268', '277', '281', '305', '318', '324', '326'];
    if (localThumbs.includes(String(id))) {
      return `assets/qq_emoji/${id}_thumb.png`;
    }
    if (info.pngPath) {
      return `${this.baseUrl}/${info.pngPath}`;
    }
    return '';
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
    const localThumbs = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '21', '49', '96', '104', '182', '212', '268', '277', '281', '305', '318', '324', '326'];
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
