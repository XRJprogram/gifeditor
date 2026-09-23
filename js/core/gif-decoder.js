/**
 * Universal GIF & APNG Decoder Module
 * Supports animated APNG (QQNT Emojis), animated GIF, and static images.
 */

class GifDecoder {
  /**
   * Decodes an ArrayBuffer or Uint8Array of either a GIF or an APNG into an array of frames.
   * @param {ArrayBuffer|Uint8Array} buffer 
   * @returns {Promise<{ width: number, height: number, totalDuration: number, frames: Array<{ canvas: HTMLCanvasElement, delay: number, width: number, height: number }> }>}
   */
  static async decode(buffer) {
    const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const ab = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);

    // Check header signature
    const isPng = uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4E && uint8[3] === 0x47;
    const isGif = (uint8[0] === 0x47 && uint8[1] === 0x49 && uint8[2] === 0x46);

    if (isPng) {
      return this.decodeAPNG(ab);
    } else if (isGif) {
      return this.decodeGIF(uint8);
    } else {
      // Try image blob fallback
      const blob = new Blob([uint8]);
      return this.decodeStaticImage(blob);
    }
  }

  /**
   * Decodes APNG ArrayBuffer using apng-js
   */
  static async decodeAPNG(arrayBuffer) {
    if (!window.GifEngine || !window.GifEngine.parseAPNG) {
      throw new Error('APNG 解析引擎未加载');
    }

    const apng = window.GifEngine.parseAPNG(arrayBuffer);
    if (apng instanceof Error) {
      // If not animated APNG, try static image decoding
      const blob = new Blob([arrayBuffer], { type: 'image/png' });
      return this.decodeStaticImage(blob);
    }

    const width = apng.width;
    const height = apng.height;
    const frames = [];

    const accumCanvas = document.createElement('canvas');
    accumCanvas.width = width;
    accumCanvas.height = height;
    const accumCtx = accumCanvas.getContext('2d');

    const prevBackupCanvas = document.createElement('canvas');
    prevBackupCanvas.width = width;
    prevBackupCanvas.height = height;
    const prevBackupCtx = prevBackupCanvas.getContext('2d');

    let prevDisposeOp = 0;
    let prevRect = { left: 0, top: 0, width, height };

    // Load all frame images concurrently via apng.createImages
    if (apng.createImages) {
      await apng.createImages();
    } else {
      await Promise.all(apng.frames.map(f => f.createImage()));
    }

    for (let i = 0; i < apng.frames.length; i++) {
      const f = apng.frames[i];
      const img = f.imageElement;
      if (!img) continue;

      // 1. Handle previous frame's disposal
      if (prevDisposeOp === 1) { // APNG_DISPOSE_OP_BACKGROUND
        accumCtx.clearRect(prevRect.left, prevRect.top, prevRect.width, prevRect.height);
      } else if (prevDisposeOp === 2) { // APNG_DISPOSE_OP_PREVIOUS
        accumCtx.clearRect(0, 0, width, height);
        accumCtx.drawImage(prevBackupCanvas, 0, 0);
      }

      // 2. If current frame has disposeOp === 2, backup canvas before drawing
      if (f.disposeOp === 2) {
        prevBackupCtx.clearRect(0, 0, width, height);
        prevBackupCtx.drawImage(accumCanvas, 0, 0);
      }

      // 3. Handle blendOp
      if (f.blendOp === 0) { // APNG_BLEND_OP_SOURCE
        accumCtx.clearRect(f.left, f.top, f.width, f.height);
      }
      accumCtx.drawImage(img, f.left, f.top, f.width, f.height);

      // 4. Standalone frame snapshot
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = width;
      frameCanvas.height = height;
      frameCanvas.getContext('2d').drawImage(accumCanvas, 0, 0);

      let delayMs = Math.round(f.delay);
      if (delayMs <= 15) delayMs = 60; // Smooth fallback for fast frames

      frames.push({
        index: i,
        canvas: frameCanvas,
        delay: delayMs,
        width,
        height
      });

      prevDisposeOp = f.disposeOp;
      prevRect = { left: f.left, top: f.top, width: f.width, height: f.height };
    }

    return {
      width,
      height,
      totalDuration: frames.reduce((acc, f) => acc + f.delay, 0),
      frames
    };
  }

  /**
   * Decodes GIF ArrayBuffer using omggif
   */
  static async decodeGIF(uint8) {
    const reader = new window.GifEngine.GifReader(uint8);
    const width = reader.width;
    const height = reader.height;
    const numFrames = reader.numFrames();

    if (numFrames === 0) {
      throw new Error('GIF 文件中未检测到有效帧');
    }

    const accumCanvas = document.createElement('canvas');
    accumCanvas.width = width;
    accumCanvas.height = height;
    const accumCtx = accumCanvas.getContext('2d', { willReadFrequently: true });

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    const backupCanvas = document.createElement('canvas');
    backupCanvas.width = width;
    backupCanvas.height = height;
    const backupCtx = backupCanvas.getContext('2d');

    const frames = [];
    let prevDisposal = 0;
    let prevFrameRect = { x: 0, y: 0, width, height };
    let totalDuration = 0;

    for (let i = 0; i < numFrames; i++) {
      const info = reader.frameInfo(i);

      if (prevDisposal === 2) {
        accumCtx.clearRect(prevFrameRect.x, prevFrameRect.y, prevFrameRect.width, prevFrameRect.height);
      } else if (prevDisposal === 3) {
        accumCtx.clearRect(0, 0, width, height);
        accumCtx.drawImage(backupCanvas, 0, 0);
      }

      if (info.disposal === 3) {
        backupCtx.clearRect(0, 0, width, height);
        backupCtx.drawImage(accumCanvas, 0, 0);
      }

      const frameData = new Uint8ClampedArray(info.width * info.height * 4);
      reader.decodeAndBlitFrameRGBA(i, frameData);

      tempCanvas.width = info.width;
      tempCanvas.height = info.height;
      const imgData = new ImageData(frameData, info.width, info.height);
      tempCtx.putImageData(imgData, 0, 0);

      accumCtx.drawImage(tempCanvas, info.x, info.y);

      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = width;
      frameCanvas.height = height;
      frameCanvas.getContext('2d').drawImage(accumCanvas, 0, 0);

      let delayMs = (info.delay || 10) * 10;
      if (delayMs <= 10) delayMs = 100;
      totalDuration += delayMs;

      frames.push({
        index: i,
        canvas: frameCanvas,
        delay: delayMs,
        width,
        height
      });

      prevDisposal = info.disposal;
      prevFrameRect = { x: info.x, y: info.y, width: info.width, height: info.height };
    }

    return {
      width,
      height,
      totalDuration,
      frames
    };
  }

  /**
   * Helper to load static image (PNG/JPG/WebP) and convert to a single-frame animation
   */
  static async decodeStaticImage(blobOrFile) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blobOrFile);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        resolve({
          width: img.width,
          height: img.height,
          totalDuration: 100,
          frames: [{
            index: 0,
            canvas,
            delay: 100,
            width: img.width,
            height: img.height
          }]
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('无法读取图像文件'));
      };
      img.src = url;
    });
  }
}

window.GifDecoder = GifDecoder;
