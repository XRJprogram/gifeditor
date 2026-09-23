/**
 * GIF Encoder Module
 * Uses gifenc (via GifEngine) to encode frame canvases into a high-quality,
 * optimized GIF file with transparency and color quantization.
 */

class GifEncoder {
  /**
   * Encodes frames to GIF Blob
   * @param {Array<{ canvas: HTMLCanvasElement, delay: number }>} frames 
   * @param {Object} options
   * @param {number} [options.width] Target width (defaults to first frame width)
   * @param {number} [options.height] Target height (defaults to first frame height)
   * @param {number} [options.maxColors=256] Max color palette size (64, 128, 256)
   * @param {boolean} [options.preserveTransparency=true] Keep alpha channel transparent
   * @param {string} [options.backgroundColor='#ffffff'] Background color if transparency disabled
   * @param {number} [options.loop=0] 0 for infinite loop
   * @param {Function} [options.onProgress] Callback (currentFrame, totalFrames)
   * @returns {Promise<{ blob: Blob, bytes: Uint8Array, sizeKB: number, url: string }>}
   */
  static async encode(frames, options = {}) {
    if (!frames || frames.length === 0) {
      throw new Error('没有可导出的帧');
    }

    const {
      maxColors = 256,
      preserveTransparency = true,
      backgroundColor = '#ffffff',
      loop = 0,
      onProgress = null
    } = options;

    const targetWidth = options.width || frames[0].canvas.width;
    const targetHeight = options.height || frames[0].canvas.height;

    const { GIFEncoder, quantize, applyPalette } = window.GifEngine;
    const gif = GIFEncoder();

    // Render canvas for resizing if needed
    const resizeCanvas = document.createElement('canvas');
    resizeCanvas.width = targetWidth;
    resizeCanvas.height = targetHeight;
    const resizeCtx = resizeCanvas.getContext('2d', { willReadFrequently: true });

    // Yield control to UI every few frames
    const yieldTime = () => new Promise(resolve => setTimeout(resolve, 0));

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      resizeCtx.clearRect(0, 0, targetWidth, targetHeight);
      resizeCtx.imageSmoothingEnabled = true;
      resizeCtx.imageSmoothingQuality = 'high';

      if (!preserveTransparency) {
        resizeCtx.fillStyle = backgroundColor;
        resizeCtx.fillRect(0, 0, targetWidth, targetHeight);
      }

      // Draw frame scaled to target dimensions
      resizeCtx.drawImage(frame.canvas, 0, 0, targetWidth, targetHeight);

      const imageData = resizeCtx.getImageData(0, 0, targetWidth, targetHeight);
      const rgba = imageData.data;
      const numPixels = targetWidth * targetHeight;

      let palette = [];
      let index = null;
      let transparentIndex = -1;

      if (preserveTransparency) {
        // Detect transparent pixels (alpha threshold = 128 to eliminate semi-transparent fringe halos)
        let hasTransparent = false;
        let opaqueCount = 0;
        for (let p = 0; p < numPixels; p++) {
          if (rgba[p * 4 + 3] < 128) {
            hasTransparent = true;
          } else {
            opaqueCount++;
          }
        }

        if (hasTransparent) {
          if (opaqueCount === 0) {
            // All transparent frame
            palette = [[0, 0, 0]];
            index = new Uint8Array(numPixels);
            transparentIndex = 0;
          } else {
            // Gather opaque pixels only
            const opaqueRgba = new Uint8Array(opaqueCount * 4);
            let opIdx = 0;
            for (let p = 0; p < numPixels; p++) {
              if (rgba[p * 4 + 3] >= 128) {
                opaqueRgba[opIdx * 4] = rgba[p * 4];
                opaqueRgba[opIdx * 4 + 1] = rgba[p * 4 + 1];
                opaqueRgba[opIdx * 4 + 2] = rgba[p * 4 + 2];
                opaqueRgba[opIdx * 4 + 3] = 255;
                opIdx++;
              }
            }

            // Quantize opaque pixels with high-fidelity rgb565
            const maxOpaqueColors = Math.min(255, Math.max(16, maxColors - 1));
            const opaquePalette = quantize(opaqueRgba, maxOpaqueColors, { format: 'rgb565' });
            const opaqueIndices = applyPalette(opaqueRgba, opaquePalette, 'rgb565');

            // Reserve palette index 0 strictly for transparent background
            palette = [[0, 0, 0], ...opaquePalette];
            transparentIndex = 0;

            index = new Uint8Array(numPixels);
            let opCursor = 0;
            for (let p = 0; p < numPixels; p++) {
              if (rgba[p * 4 + 3] < 128) {
                index[p] = 0; // Transparent
              } else {
                index[p] = opaqueIndices[opCursor++] + 1; // Offset by 1 for palette[0]
              }
            }
          }
        } else {
          // No transparent pixels in this frame
          palette = quantize(rgba, Math.min(256, maxColors), { format: 'rgb565' });
          index = applyPalette(rgba, palette, 'rgb565');
          transparentIndex = -1;
        }
      } else {
        // Transparency disabled: solid background
        for (let p = 0; p < numPixels; p++) {
          rgba[p * 4 + 3] = 255;
        }
        palette = quantize(rgba, Math.min(256, maxColors), { format: 'rgb565' });
        index = applyPalette(rgba, palette, 'rgb565');
        transparentIndex = -1;
      }

      const frameDelay = Math.max(20, Math.round(frame.delay || 100));

      gif.writeFrame(index, targetWidth, targetHeight, {
        palette,
        delay: frameDelay,
        transparent: transparentIndex !== -1,
        transparentIndex: transparentIndex !== -1 ? transparentIndex : 0,
        repeat: loop === 0 ? 0 : loop
      });

      if (onProgress) {
        onProgress(i + 1, frames.length);
      }

      // Keep browser responsive during encoding
      if (i % 3 === 0) {
        await yieldTime();
      }
    }

    gif.finish();
    const bytes = gif.bytes();
    const blob = new Blob([bytes], { type: 'image/gif' });
    const url = URL.createObjectURL(blob);
    const sizeKB = Math.round((bytes.length / 1024) * 10) / 10;

    return {
      blob,
      bytes,
      sizeKB,
      url
    };
  }
}

window.GifEncoder = GifEncoder;
