/**
 * Splice Manager Module
 * Handles sequential stitching (chaining GIFs in time),
 * spatial layer overlay (adding animated GIF/PNG accessories on top),
 * and side-by-side split-screen montage.
 */

class SpliceManager {
  /**
   * Sequentially appends a second GIF's frames to the first GIF
   * @param {Array<{ canvas: HTMLCanvasElement, delay: number }>} baseFrames 
   * @param {Array<{ canvas: HTMLCanvasElement, delay: number }>} appendFrames 
   * @param {Object} options 
   * @param {'fit'|'pad'|'original'} [options.resizeMode='fit']
   * @param {number} [options.loopCount=1] How many times to repeat the appended clip
   * @returns {Array<{ canvas: HTMLCanvasElement, delay: number }>}
   */
  static appendSequential(baseFrames, appendFrames, options = {}) {
    if (!baseFrames || baseFrames.length === 0) return appendFrames;
    if (!appendFrames || appendFrames.length === 0) return baseFrames;

    const { resizeMode = 'fit', loopCount = 1 } = options;
    const targetWidth = baseFrames[0].canvas.width;
    const targetHeight = baseFrames[0].canvas.height;

    const result = baseFrames.map(f => {
      const c = document.createElement('canvas');
      c.width = targetWidth;
      c.height = targetHeight;
      c.getContext('2d').drawImage(f.canvas, 0, 0);
      return { canvas: c, delay: f.delay };
    });

    for (let loop = 0; loop < loopCount; loop++) {
      for (const af of appendFrames) {
        const c = document.createElement('canvas');
        c.width = targetWidth;
        c.height = targetHeight;
        const ctx = c.getContext('2d');

        if (resizeMode === 'fit') {
          ctx.drawImage(af.canvas, 0, 0, targetWidth, targetHeight);
        } else if (resizeMode === 'pad') {
          // Center inside target
          const scale = Math.min(targetWidth / af.canvas.width, targetHeight / af.canvas.height);
          const dw = af.canvas.width * scale;
          const dh = af.canvas.height * scale;
          const dx = (targetWidth - dw) / 2;
          const dy = (targetHeight - dh) / 2;
          ctx.drawImage(af.canvas, dx, dy, dw, dh);
        } else {
          ctx.drawImage(af.canvas, 0, 0);
        }

        result.push({ canvas: c, delay: af.delay });
      }
    }

    return result;
  }

  /**
   * Bakes/Flattens an animated or static overlay layer onto base frames
   * @param {Array<{ canvas: HTMLCanvasElement, delay: number }>} baseFrames 
   * @param {Array<{ canvas: HTMLCanvasElement }>} overlayFrames 
   * @param {Object} overlayConfig { x, y, width, height, rotation, opacity, loop }
   * @returns {Array<{ canvas: HTMLCanvasElement, delay: number }>}
   */
  static bakeOverlay(baseFrames, overlayFrames, overlayConfig) {
    if (!baseFrames || baseFrames.length === 0) return [];
    if (!overlayFrames || overlayFrames.length === 0) return baseFrames;

    const {
      x = 0,
      y = 0,
      width = 100,
      height = 100,
      rotation = 0,
      opacity = 1.0,
      loop = true
    } = overlayConfig;

    return baseFrames.map((bf, i) => {
      const outCanvas = document.createElement('canvas');
      outCanvas.width = bf.canvas.width;
      outCanvas.height = bf.canvas.height;
      const ctx = outCanvas.getContext('2d');

      // Draw base frame
      ctx.drawImage(bf.canvas, 0, 0);

      // Pick corresponding overlay frame
      let overlayIndex = i;
      if (loop) {
        overlayIndex = i % overlayFrames.length;
      } else {
        overlayIndex = Math.min(i, overlayFrames.length - 1);
      }
      const of = overlayFrames[overlayIndex];

      // Draw overlay
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.translate(x + width / 2, y + height / 2);
      if (rotation) {
        ctx.rotate((rotation * Math.PI) / 180);
      }
      ctx.drawImage(of.canvas, -width / 2, -height / 2, width, height);
      ctx.restore();

      return {
        canvas: outCanvas,
        delay: bf.delay
      };
    });
  }

  /**
   * Stitches two GIFs side-by-side horizontally or vertically
   * @param {Array<{ canvas: HTMLCanvasElement, delay: number }>} framesA 
   * @param {Array<{ canvas: HTMLCanvasElement, delay: number }>} framesB 
   * @param {'horizontal'|'vertical'} direction 
   * @returns {Array<{ canvas: HTMLCanvasElement, delay: number }>}
   */
  static stitchSideBySide(framesA, framesB, direction = 'horizontal') {
    if (!framesA || framesA.length === 0) return framesB;
    if (!framesB || framesB.length === 0) return framesA;

    const totalFrames = Math.max(framesA.length, framesB.length);
    const wA = framesA[0].canvas.width;
    const hA = framesA[0].canvas.height;
    const wB = framesB[0].canvas.width;
    const hB = framesB[0].canvas.height;

    let outW, outH;
    if (direction === 'horizontal') {
      outW = wA + wB;
      outH = Math.max(hA, hB);
    } else {
      outW = Math.max(wA, wB);
      outH = hA + hB;
    }

    const result = [];

    for (let i = 0; i < totalFrames; i++) {
      const fA = framesA[i % framesA.length];
      const fB = framesB[i % framesB.length];

      const c = document.createElement('canvas');
      c.width = outW;
      c.height = outH;
      const ctx = c.getContext('2d');

      if (direction === 'horizontal') {
        const yA = (outH - hA) / 2;
        const yB = (outH - hB) / 2;
        ctx.drawImage(fA.canvas, 0, yA);
        ctx.drawImage(fB.canvas, wA, yB);
      } else {
        const xA = (outW - wA) / 2;
        const xB = (outW - wB) / 2;
        ctx.drawImage(fA.canvas, xA, 0);
        ctx.drawImage(fB.canvas, xB, hA);
      }

      result.push({
        canvas: c,
        delay: fA.delay || fB.delay || 100
      });
    }

    return result;
  }
}

window.SpliceManager = SpliceManager;
