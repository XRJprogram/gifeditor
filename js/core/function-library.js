/**
 * Function Library for QQ Emoji Meme Editing & Blueprint Execution
 * Contains all pure transformation functions: Mirror, Merge, Frame Constraint,
 * Warping, Splicing, and Meme FX.
 */

class FunctionLibrary {
  /**
   * Helper to clone frame array
   */
  static cloneFrames(frames) {
    if (!frames) return [];
    return frames.map(f => {
      const c = document.createElement('canvas');
      c.width = f.canvas.width;
      c.height = f.canvas.height;
      c.getContext('2d').drawImage(f.canvas, 0, 0);
      return {
        ...f,
        canvas: c
      };
    });
  }

  // ==========================================
  // 1. 对称与镜像函数 (Symmetry & Mirror)
  // ==========================================

  /**
   * 左侧对称覆盖到右侧 (Left-to-Right Mirror)
   * Takes the left half and mirrors it onto the right half.
   */
  static mirrorLeftToRight(frames) {
    if (!frames || frames.length === 0) return [];
    return frames.map(f => {
      const w = f.canvas.width;
      const h = f.canvas.height;
      const mid = Math.floor(w / 2);

      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const ctx = out.getContext('2d');

      // 1. Draw original left half on the left
      ctx.drawImage(f.canvas, 0, 0, mid, h, 0, 0, mid, h);

      // 2. Mirror left half onto the right half
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(f.canvas, 0, 0, mid, h, 0, 0, mid, h);
      ctx.restore();

      return {
        canvas: out,
        delay: f.delay,
        width: w,
        height: h
      };
    });
  }

  /**
   * 右侧对称覆盖到左侧 (Right-to-Left Mirror)
   * Takes the right half and mirrors it onto the left half.
   */
  static mirrorRightToLeft(frames) {
    if (!frames || frames.length === 0) return [];
    return frames.map(f => {
      const w = f.canvas.width;
      const h = f.canvas.height;
      const mid = Math.floor(w / 2);
      const rightWidth = w - mid;

      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const ctx = out.getContext('2d');

      // 1. Draw original right half on the right
      ctx.drawImage(f.canvas, mid, 0, rightWidth, h, mid, 0, rightWidth, h);

      // 2. Mirror right half onto the left half
      ctx.save();
      ctx.translate(mid, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(f.canvas, mid, 0, rightWidth, h, 0, 0, rightWidth, h);
      ctx.restore();

      return {
        canvas: out,
        delay: f.delay,
        width: w,
        height: h
      };
    });
  }

  /**
   * 上半对称覆盖到下半 (Top-to-Bottom Mirror)
   */
  static mirrorTopToBottom(frames) {
    if (!frames || frames.length === 0) return [];
    return frames.map(f => {
      const w = f.canvas.width;
      const h = f.canvas.height;
      const mid = Math.floor(h / 2);

      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const ctx = out.getContext('2d');

      // 1. Draw top half
      ctx.drawImage(f.canvas, 0, 0, w, mid, 0, 0, w, mid);

      // 2. Mirror top half to bottom
      ctx.save();
      ctx.translate(0, h);
      ctx.scale(1, -1);
      ctx.drawImage(f.canvas, 0, 0, w, mid, 0, 0, w, mid);
      ctx.restore();

      return { canvas: out, delay: f.delay, width: w, height: h };
    });
  }

  /**
   * 下半对称覆盖到上半 (Bottom-to-Top Mirror)
   */
  static mirrorBottomToTop(frames) {
    if (!frames || frames.length === 0) return [];
    return frames.map(f => {
      const w = f.canvas.width;
      const h = f.canvas.height;
      const mid = Math.floor(h / 2);
      const bottomHeight = h - mid;

      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const ctx = out.getContext('2d');

      // 1. Draw bottom half
      ctx.drawImage(f.canvas, 0, mid, w, bottomHeight, 0, mid, w, bottomHeight);

      // 2. Mirror bottom half to top
      ctx.save();
      ctx.translate(0, mid);
      ctx.scale(1, -1);
      ctx.drawImage(f.canvas, 0, mid, w, bottomHeight, 0, 0, w, bottomHeight);
      ctx.restore();

      return { canvas: out, delay: f.delay, width: w, height: h };
    });
  }

  /**
   * 四向万花筒对称 (4-Way Kaleidoscope Mirror)
   */
  static mirror4Way(frames) {
    if (!frames || frames.length === 0) return [];
    // Compose Left-to-Right then Top-to-Bottom
    const step1 = this.mirrorLeftToRight(frames);
    return this.mirrorTopToBottom(step1);
  }

  /**
   * 双向对称 (Dual Symmetry)
   * @param {Array} frames
   * @param {'left'|'right'|'top'|'bottom'} keep 保留侧
   */
  static mirrorDual(frames, keep = 'left') {
    switch (keep) {
      case 'right':
        return this.mirrorRightToLeft(frames);
      case 'top':
        return this.mirrorTopToBottom(frames);
      case 'bottom':
        return this.mirrorBottomToTop(frames);
      case 'left':
      default:
        return this.mirrorLeftToRight(frames);
    }
  }

  /**
   * 四向对称 (Quad Symmetry)
   * @param {Array} frames
   * @param {'top_left'|'top_right'|'bottom_left'|'bottom_right'} quadrant 保留象限
   */
  static mirrorQuad(frames, quadrant = 'top_left') {
    if (!frames || frames.length === 0) return [];
    switch (quadrant) {
      case 'top_right':
        return this.mirrorTopToBottom(this.mirrorRightToLeft(frames));
      case 'bottom_left':
        return this.mirrorBottomToTop(this.mirrorLeftToRight(frames));
      case 'bottom_right':
        return this.mirrorBottomToTop(this.mirrorRightToLeft(frames));
      case 'top_left':
      default:
        return this.mirrorTopToBottom(this.mirrorLeftToRight(frames));
    }
  }

  /**
   * 统一对称镜像函数 (Consolidated Mirror Symmetry - 兼容旧版调用)
   * @param {Array} frames
   * @param {string} direction
   */
  static mirrorSymmetry(frames, direction = 'left_to_right') {
    if (direction === 'four_way') return this.mirrorQuad(frames, 'top_left');
    if (direction === 'right_to_left') return this.mirrorDual(frames, 'right');
    if (direction === 'top_to_bottom') return this.mirrorDual(frames, 'top');
    if (direction === 'bottom_to_top') return this.mirrorDual(frames, 'bottom');
    return this.mirrorDual(frames, 'left');
  }

  // ==========================================
  // 2. 表情缝合与多输入融合 (Merge & Splice)
  // ==========================================

  /**
   * 双表情阴阳脸缝合 (Merge Face: Left A + Right B)
   * Left half from Emoji A + Right half from Emoji B!
   */
  static mergeFace(framesA, framesB, splitRatio = 0.5) {
    if (!framesA || framesA.length === 0) return framesB || [];
    if (!framesB || framesB.length === 0) return framesA || [];

    const totalFrames = Math.max(framesA.length, framesB.length);
    const targetW = Math.max(framesA[0].canvas.width, framesB[0].canvas.width);
    const targetH = Math.max(framesA[0].canvas.height, framesB[0].canvas.height);
    const splitX = Math.round(targetW * splitRatio);

    const outFrames = [];

    for (let i = 0; i < totalFrames; i++) {
      const fA = framesA[i % framesA.length];
      const fB = framesB[i % framesB.length];

      const out = document.createElement('canvas');
      out.width = targetW;
      out.height = targetH;
      const ctx = out.getContext('2d');

      // Left half from A
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, splitX, targetH);
      ctx.clip();
      ctx.drawImage(fA.canvas, 0, 0, targetW, targetH);
      ctx.restore();

      // Right half from B
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, targetW - splitX, targetH);
      ctx.clip();
      ctx.drawImage(fB.canvas, 0, 0, targetW, targetH);
      ctx.restore();

      outFrames.push({
        canvas: out,
        delay: fA.delay || fB.delay || 80,
        width: targetW,
        height: targetH
      });
    }

    return outFrames;
  }

  /**
   * 画中画/配件叠加 (Overlay)
   */
  static overlay(baseFrames, overlayFrames, options = {}) {
    return window.SpliceManager.bakeOverlay(baseFrames, overlayFrames, options);
  }

  /**
   * 时间轴前后串联 (Sequence Append)
   */
  static sequenceAppend(framesA, framesB, loopCount = 1) {
    return window.SpliceManager.appendSequential(framesA, framesB, { loopCount });
  }

  /**
   * 并排拼接 (Side-by-Side)
   */
  static sideBySide(framesA, framesB, direction = 'horizontal') {
    return window.SpliceManager.stitchSideBySide(framesA, framesB, direction);
  }

  // ==========================================
  // 3. 帧数约束与时间控制 (Frame Constraint & Speed)
  // ==========================================

  /**
   * 帧数裁剪约束与重采样 (Frame Constraint)
   * @param {Array} frames 
   * @param {Object} options
   * @param {number} [options.maxFrames=0] Maximum frames (resamples if exceeded)
   * @param {number} [options.startFrame=0] Trim start frame
   * @param {number} [options.endFrame=-1] Trim end frame
   * @param {number} [options.step=1] Downsample step (1, 2, 3...)
   * @param {number} [options.overrideDelay=0] Custom delay in ms (0 to keep)
   * @param {number} [options.speedMultiplier=1.0]
   */
  static frameConstraint(frames, options = {}) {
    if (!frames || frames.length === 0) return [];
    let list = this.cloneFrames(frames);

    const {
      maxFrames = 0,
      startFrame = 0,
      endFrame = -1,
      step = 1,
      overrideDelay = 0,
      speedMultiplier = 1.0
    } = options;

    // 1. Trim Range
    const start = Math.max(0, Math.min(startFrame, list.length - 1));
    const end = (endFrame >= 0 && endFrame < list.length) ? endFrame : list.length - 1;
    if (start <= end) {
      list = list.slice(start, end + 1);
    }

    // 2. Downsample Step
    if (step > 1) {
      const stepped = [];
      for (let i = 0; i < list.length; i += step) {
        stepped.push(list[i]);
      }
      list = stepped;
    }

    // 3. Max Frames Constraint (Intelligently resample to fit maxFrames)
    if (maxFrames > 0 && list.length > maxFrames) {
      const resampled = [];
      for (let i = 0; i < maxFrames; i++) {
        const srcIdx = Math.round((i / (maxFrames - 1)) * (list.length - 1));
        resampled.push(list[srcIdx]);
      }
      list = resampled;
    }

    // 4. Delay & Speed
    list.forEach(f => {
      let d = overrideDelay > 0 ? overrideDelay : f.delay;
      if (speedMultiplier && speedMultiplier > 0) {
        d = Math.round(d / speedMultiplier);
      }
      f.delay = Math.max(20, d);
    });

    return list;
  }

  /**
   * 帧数相对区间截取 (Frame Range Interval: 0% to 100%)
   * @param {Array<{ canvas: HTMLCanvasElement, delay: number }>} frames 
   * @param {number} startPercent [0, 100]
   * @param {number} endPercent [0, 100]
   * @returns {Array<{ canvas: HTMLCanvasElement, delay: number }>}
   */
  static frameInterval(frames, startPercent = 0, endPercent = 100) {
    if (!frames || frames.length === 0) return [];
    const total = frames.length;
    let s = Math.max(0, Math.min(100, parseFloat(startPercent) || 0));
    let e = Math.max(0, Math.min(100, parseFloat(endPercent) || 100));
    if (s > e) {
      const tmp = s; s = e; e = tmp;
    }

    let startIdx = Math.floor(total * (s / 100));
    let endIdx = Math.ceil(total * (e / 100));

    startIdx = Math.max(0, Math.min(total - 1, startIdx));
    endIdx = Math.max(startIdx + 1, Math.min(total, endIdx));

    const sliced = frames.slice(startIdx, endIdx);
    return this.cloneFrames(sliced);
  }

  /**
   * 播放速度调节 (Speed Adjust)
   * @param {Array} frames
   * @param {number} speedMultiplier e.g. 0.5 (slow), 2.0 (fast)
   */
  static speedAdjust(frames, speedMultiplier = 1.0) {
    if (!frames || frames.length === 0) return [];
    const speed = Math.max(0.1, Math.min(10.0, parseFloat(speedMultiplier) || 1.0));
    return frames.map(f => {
      const origDelay = f.delay || 60;
      const newDelay = Math.max(16, Math.round(origDelay / speed));
      return {
        ...f,
        delay: newDelay
      };
    });
  }

  /**
   * 乒乓往复循环 (Boomerang / Ping-Pong)
   */
  static boomerang(frames) {
    if (!frames || frames.length <= 1) return frames || [];
    const list = this.cloneFrames(frames);
    const reversed = [];
    for (let i = list.length - 2; i > 0; i--) {
      reversed.push(list[i]);
    }
    return list.concat(reversed);
  }

  /**
   * 倒放 (Reverse)
   */
  static reverse(frames) {
    if (!frames || frames.length === 0) return [];
    const list = this.cloneFrames(frames);
    list.reverse();
    return list;
  }

  // ==========================================
  // 4. 变形与特效 (Warping & Effects)
  // ==========================================

  static warp(frames, warpConfig) {
    if (!frames || frames.length === 0) return [];
    return frames.map((f, i) => {
      const c = window.WarpEngine.applyWarp(f.canvas, warpConfig, i, frames.length);
      return {
        ...f,
        canvas: c
      };
    });
  }

  static memeText(frames, textConfig) {
    return window.EffectsManager.bakeText(frames, textConfig);
  }

  static rainbowGlitch(frames) {
    return window.EffectsManager.applyFilters(frames, { type: 'rainbow' });
  }

  static colorFilter(frames, filterType, brightness = 1.0, contrast = 1.0) {
    return window.EffectsManager.applyFilters(frames, { type: filterType, brightness, contrast });
  }

  static colorAdjust(frames, options = {}) {
    return window.EffectsManager.adjustColorAndFilter(frames, options);
  }
}

window.FunctionLibrary = FunctionLibrary;
