/**
 * Warp & Deformation Engine
 * Provides pixel-level transformations (Bulge, Pinch, Wave, Twirl, Skew, Squash/Stretch, Jitter)
 * tailored for emoji and meme GIF derivative creation.
 */

class WarpEngine {
  /**
   * Samples source ImageData at non-integer coordinates (u, v) using bilinear interpolation.
   */
  static sampleBilinear(srcData, w, h, u, v, outRgba) {
    if (u < 0 || u > w - 1 || v < 0 || v > h - 1) {
      // Outside boundary: transparent
      outRgba[0] = 0;
      outRgba[1] = 0;
      outRgba[2] = 0;
      outRgba[3] = 0;
      return;
    }

    const x0 = Math.floor(u);
    const y0 = Math.floor(v);
    const x1 = Math.min(w - 1, x0 + 1);
    const y1 = Math.min(h - 1, y0 + 1);
    const fx = u - x0;
    const fy = v - y0;

    const idx00 = (y0 * w + x0) * 4;
    const idx10 = (y0 * w + x1) * 4;
    const idx01 = (y1 * w + x0) * 4;
    const idx11 = (y1 * w + x1) * 4;

    const w00 = (1 - fx) * (1 - fy);
    const w10 = fx * (1 - fy);
    const w01 = (1 - fx) * fy;
    const w11 = fx * fy;

    outRgba[0] = Math.round(srcData[idx00] * w00 + srcData[idx10] * w10 + srcData[idx01] * w01 + srcData[idx11] * w11);
    outRgba[1] = Math.round(srcData[idx00 + 1] * w00 + srcData[idx10 + 1] * w10 + srcData[idx01 + 1] * w01 + srcData[idx11 + 1] * w11);
    outRgba[2] = Math.round(srcData[idx00 + 2] * w00 + srcData[idx10 + 2] * w10 + srcData[idx01 + 2] * w01 + srcData[idx11 + 2] * w11);
    outRgba[3] = Math.round(srcData[idx00 + 3] * w00 + srcData[idx10 + 3] * w10 + srcData[idx01 + 3] * w01 + srcData[idx11 + 3] * w11);
  }

  /**
   * Applies deformation config to a canvas and returns a new transformed canvas.
   * @param {HTMLCanvasElement} srcCanvas 
   * @param {Object} warpConfig 
   * @param {number} [frameIndex=0] Current frame index
   * @param {number} [totalFrames=1] Total frame count
   * @returns {HTMLCanvasElement}
   */
  static applyWarp(srcCanvas, warpConfig, frameIndex = 0, totalFrames = 1) {
    const w = srcCanvas.width;
    const h = srcCanvas.height;

    // Check if any deformation is active
    const {
      type = 'none', // 'bulge', 'pinch', 'wave', 'twirl', 'skew', 'squash', 'shake'
      center = { x: 0.5, y: 0.5 }, // normalized 0~1
      radius = Math.min(w, h) * 0.45,
      strength = 0.5, // -1 to 1 or 0 to 1
      amplitude = 15,
      frequency = 0.05,
      animated = false,
      skewX = 0,
      skewY = 0,
      scaleX = 1,
      scaleY = 1,
      shakeIntensity = 0,
      flipH = false,
      flipV = false,
      rotation = 0 // degrees
    } = warpConfig;

    // First handle geometric flips and simple canvas transforms
    const outCanvas = document.createElement('canvas');
    outCanvas.width = w;
    outCanvas.height = h;
    const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });

    // Base draw with potential flip/rotation/scale
    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = w;
    baseCanvas.height = h;
    const baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true });

    baseCtx.save();
    baseCtx.translate(w / 2, h / 2);

    if (flipH) baseCtx.scale(-1, 1);
    if (flipV) baseCtx.scale(1, -1);
    if (rotation !== 0) baseCtx.rotate((rotation * Math.PI) / 180);

    // Dynamic jelly squash & stretch
    let currentScaleX = scaleX;
    let currentScaleY = scaleY;
    if (type === 'squash' && animated && totalFrames > 1) {
      const t = (frameIndex / totalFrames) * Math.PI * 2;
      const jellyFactor = Math.sin(t) * (strength * 0.4);
      currentScaleX *= (1 + jellyFactor);
      currentScaleY *= (1 - jellyFactor);
    }
    baseCtx.scale(currentScaleX, currentScaleY);

    // Camera shake / jitter
    if (type === 'shake' || shakeIntensity > 0) {
      const shakeVal = type === 'shake' ? strength * 20 : shakeIntensity;
      const rx = (Math.random() * 2 - 1) * shakeVal;
      const ry = (Math.random() * 2 - 1) * shakeVal;
      baseCtx.translate(rx, ry);
    }

    baseCtx.drawImage(srcCanvas, -w / 2, -h / 2);
    baseCtx.restore();

    // If no pixel-level warp is requested, return the transformed baseCanvas directly!
    const needsPixelWarp = ['lens', 'bulge', 'pinch', 'wave', 'twirl', 'skew'].includes(type);
    if (!needsPixelWarp) {
      return baseCanvas;
    }

    // Pixel-level inverse mapping
    const srcImgData = baseCtx.getImageData(0, 0, w, h);
    const srcData = srcImgData.data;
    const dstImgData = outCtx.createImageData(w, h);
    const dstData = dstImgData.data;

    const cx = center.x * w;
    const cy = center.y * h;
    const r = Math.max(10, radius);

    // Animation phase for wave / wobble
    let phase = 0;
    if (animated && totalFrames > 1) {
      phase = (frameIndex / totalFrames) * Math.PI * 2;
    }

    const tempRgba = new Uint8ClampedArray(4);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let u = x;
        let v = y;

        switch (type) {
          case 'lens': {
            // Unified lens scaling:
            // strength > 0 (0%~100%): Bulge 凸透镜膨胀 (power > 1, newRn < rn -> magnify center)
            // strength === 0: Neutral 无变形 (power = 1, newRn = rn -> 1:1 original)
            // strength < 0 (-100%~0%): Pinch 凹透镜收缩 (power < 1, newRn > rn -> shrink center)
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < r && dist > 0.0001) {
              const rn = dist / r;
              const power = Math.exp(strength * 1.35);
              const factor = Math.pow(rn, power) / rn;
              u = cx + dx * factor;
              v = cy + dy * factor;
            }
            break;
          }

          case 'bulge': {
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < r && dist > 0.0001) {
              const rn = dist / r;
              const power = Math.exp(Math.abs(strength) * 1.35);
              const factor = Math.pow(rn, power) / rn;
              u = cx + dx * factor;
              v = cy + dy * factor;
            }
            break;
          }

          case 'pinch': {
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < r && dist > 0.0001) {
              const rn = dist / r;
              const power = Math.exp(-Math.abs(strength) * 1.35);
              const factor = Math.pow(rn, power) / rn;
              u = cx + dx * factor;
              v = cy + dy * factor;
            }
            break;
          }

          case 'wave': {
            // Wave wobble: sine wave along Y and X
            const amp = amplitude * strength;
            const freq = frequency;
            u = x + Math.sin(y * freq + phase) * amp;
            v = y + Math.cos(x * freq + phase) * (amp * 0.5);
            break;
          }

          case 'twirl': {
            // Vortex / Twirl
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < r && dist > 0) {
              const angle = Math.atan2(dy, dx);
              const twirlAngle = (1 - dist / r) * (strength * Math.PI * 2);
              const finalAngle = angle + (animated ? twirlAngle + phase : twirlAngle);
              u = cx + dist * Math.cos(finalAngle);
              v = cy + dist * Math.sin(finalAngle);
            }
            break;
          }

          case 'skew': {
            // Skew / Perspective
            u = x - (y - cy) * (skewX * 0.02);
            v = y - (x - cx) * (skewY * 0.02);
            break;
          }
        }

        this.sampleBilinear(srcData, w, h, u, v, tempRgba);

        const dstIdx = (y * w + x) * 4;
        dstData[dstIdx] = tempRgba[0];
        dstData[dstIdx + 1] = tempRgba[1];
        dstData[dstIdx + 2] = tempRgba[2];
        dstData[dstIdx + 3] = tempRgba[3];
      }
    }

    outCtx.putImageData(dstImgData, 0, 0);
    return outCanvas;
  }
}

window.WarpEngine = WarpEngine;
