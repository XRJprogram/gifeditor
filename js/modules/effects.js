/**
 * Effects & Meme Filters Module
 * Provides color adjustments, glitch hue cycle, grayscale, invert, and meme text baking.
 */

class EffectsManager {
  /**
   * Comprehensive Color & Filter Adjustment
   * Strictly preserves transparency: transparent pixels (alpha === 0) are NEVER altered.
   * @param {Array<{ canvas: HTMLCanvasElement, delay: number }>} frames 
   * @param {Object} options
   * @param {string} [options.filter='none'] 'none' | 'grayscale' | 'invert' | 'sepia' | 'cyberpunk' | 'high_contrast' | 'warm' | 'cool'
   * @param {number} [options.hueRotate=0] 0 - 360 degrees
   * @param {number} [options.saturation=100] 0 - 200%
   * @param {number} [options.brightness=0] -100 to +100%
   * @param {number} [options.contrast=0] -100 to +100%
   * @param {boolean} [options.invert=false]
   * @returns {Array<{ canvas: HTMLCanvasElement, delay: number }>}
   */
  static adjustColorAndFilter(frames, options = {}) {
    if (!frames || frames.length === 0) return [];

    const {
      filter = 'none',
      hueRotate = 0,
      saturation = 100,
      brightness = 0,
      contrast = 0,
      invert = false
    } = options;

    const hasHue = hueRotate !== 0;
    const hasSat = saturation !== 100;
    const hasBri = brightness !== 0;
    const hasCon = contrast !== 0;
    const hasFilter = filter !== 'none';
    const hasInvert = !!invert;

    if (!hasHue && !hasSat && !hasBri && !hasCon && !hasFilter && !hasInvert) {
      return frames;
    }

    const satRatio = saturation / 100;
    const briOffset = (brightness / 100) * 255;
    const conFactor = (259 * ((contrast * 2.55) + 255)) / (255 * (259 - (contrast * 2.55)));

    return frames.map(f => {
      const w = f.canvas.width;
      const h = f.canvas.height;
      const outCanvas = document.createElement('canvas');
      outCanvas.width = w;
      outCanvas.height = h;
      const ctx = outCanvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(f.canvas, 0, 0);

      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        // STRICT RULE: If alpha is 0, completely ignore to protect transparent background
        if (data[i + 3] === 0) continue;

        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        // 1. Preset Filters
        if (hasFilter) {
          switch (filter) {
            case 'grayscale': {
              const gray = 0.299 * r + 0.587 * g + 0.114 * b;
              r = g = b = gray;
              break;
            }
            case 'invert': {
              r = 255 - r;
              g = 255 - g;
              b = 255 - b;
              break;
            }
            case 'sepia': {
              const gray = 0.299 * r + 0.587 * g + 0.114 * b;
              r = Math.min(255, Math.round(gray * 1.15 + 40));
              g = Math.min(255, Math.round(gray * 0.88 + 15));
              b = Math.min(255, Math.max(0, Math.round(gray * 0.55 - 15)));
              break;
            }
            case 'cyberpunk': {
              const gray = 0.299 * r + 0.587 * g + 0.114 * b;
              if (gray > 110) {
                r = Math.min(255, Math.round(r * 1.1 + 40));
                g = Math.max(0, Math.round(g * 0.3));
                b = Math.min(255, Math.round(b * 1.4 + 90));
              } else {
                r = Math.max(0, Math.round(r * 0.2));
                g = Math.min(255, Math.round(g * 1.2 + 40));
                b = Math.min(255, Math.round(b * 1.5 + 90));
              }
              break;
            }
            case 'high_contrast': {
              const gray = 0.299 * r + 0.587 * g + 0.114 * b;
              const c = (gray - 128) * 1.9 + 128;
              r = Math.min(255, Math.max(0, Math.round(c > 128 ? r * 1.35 : r * 0.55)));
              g = Math.min(255, Math.max(0, Math.round(c > 128 ? g * 1.35 : g * 0.55)));
              b = Math.min(255, Math.max(0, Math.round(c > 128 ? b * 1.35 : b * 0.55)));
              break;
            }
            case 'warm': {
              r = Math.min(255, Math.round(r * 1.25 + 35));
              g = Math.min(255, Math.round(g * 1.05 + 10));
              b = Math.max(0, Math.round(b * 0.55 - 20));
              break;
            }
            case 'cool': {
              r = Math.max(0, Math.round(r * 0.6 - 15));
              g = Math.min(255, Math.round(g * 1.05 + 20));
              b = Math.min(255, Math.round(b * 1.45 + 55));
              break;
            }
          }
        }

        // 2. Invert toggle
        if (hasInvert && filter !== 'invert') {
          r = 255 - r;
          g = 255 - g;
          b = 255 - b;
        }

        // 3. Hue & Saturation
        if (hasHue || hasSat) {
          const [hVal, sVal, lVal] = this.rgbToHsl(r, g, b);
          const newH = (hVal + hueRotate + 360) % 360;
          const newS = Math.max(0, Math.min(1, sVal * satRatio));
          const [nr, ng, nb] = this.hslToRgb(newH, newS, lVal);
          r = nr; g = ng; b = nb;
        }

        // 4. Brightness
        if (hasBri) {
          r = Math.min(255, Math.max(0, r + briOffset));
          g = Math.min(255, Math.max(0, g + briOffset));
          b = Math.min(255, Math.max(0, b + briOffset));
        }

        // 5. Contrast
        if (hasCon) {
          r = Math.min(255, Math.max(0, conFactor * (r - 128) + 128));
          g = Math.min(255, Math.max(0, conFactor * (g - 128) + 128));
          b = Math.min(255, Math.max(0, conFactor * (b - 128) + 128));
        }

        data[i] = Math.round(r);
        data[i + 1] = Math.round(g);
        data[i + 2] = Math.round(b);
        // data[i + 3] (alpha) remains strictly unchanged!
      }

      ctx.putImageData(imgData, 0, 0);
      return {
        canvas: outCanvas,
        delay: f.delay
      };
    });
  }

  /**
   * Applies legacy/glitch color filter to an array of frames
   * @param {Array<{ canvas: HTMLCanvasElement, delay: number }>} frames 
   * @param {Object} filterConfig { type, hueShift, brightness, contrast }
   * @returns {Array<{ canvas: HTMLCanvasElement, delay: number }>}
   */
  static applyFilters(frames, filterConfig) {
    const { type = 'none', brightness = 1.0, contrast = 1.0 } = filterConfig;
    if (type === 'none' && brightness === 1.0 && contrast === 1.0) {
      return frames;
    }

    return frames.map((f, frameIdx) => {
      const w = f.canvas.width;
      const h = f.canvas.height;
      const outCanvas = document.createElement('canvas');
      outCanvas.width = w;
      outCanvas.height = h;
      const ctx = outCanvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(f.canvas, 0, 0);

      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      // Rainbow hue shift per frame
      const rainbowShift = (type === 'rainbow') ? (frameIdx / frames.length) * 360 : 0;

      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue; // Skip transparent

        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        // Brightness & Contrast
        if (brightness !== 1.0) {
          r = Math.min(255, r * brightness);
          g = Math.min(255, g * brightness);
          b = Math.min(255, b * brightness);
        }
        if (contrast !== 1.0) {
          r = Math.min(255, Math.max(0, (r - 128) * contrast + 128));
          g = Math.min(255, Math.max(0, (g - 128) * contrast + 128));
          b = Math.min(255, Math.max(0, (b - 128) * contrast + 128));
        }

        switch (type) {
          case 'grayscale': {
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            r = g = b = gray;
            break;
          }
          case 'invert': {
            r = 255 - r;
            g = 255 - g;
            b = 255 - b;
            break;
          }
          case 'rainbow': {
            // Shift RGB via HSL
            const [hVal, sVal, lVal] = this.rgbToHsl(r, g, b);
            const newH = (hVal + rainbowShift) % 360;
            const [nr, ng, nb] = this.hslToRgb(newH, sVal, lVal);
            r = nr; g = ng; b = nb;
            break;
          }
        }

        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
      }

      ctx.putImageData(imgData, 0, 0);
      return {
        canvas: outCanvas,
        delay: f.delay
      };
    });
  }

  /**
   * Bakes meme text directly into each frame
   */
  static bakeText(frames, textConfig) {
    if (!textConfig || (!textConfig.topText && !textConfig.bottomText)) {
      return frames;
    }

    return frames.map(f => {
      const w = f.canvas.width;
      const h = f.canvas.height;
      const outCanvas = document.createElement('canvas');
      outCanvas.width = w;
      outCanvas.height = h;
      const ctx = outCanvas.getContext('2d');
      ctx.drawImage(f.canvas, 0, 0);

      ctx.font = `bold ${textConfig.fontSize}px ${textConfig.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = textConfig.textColor;
      ctx.strokeStyle = textConfig.strokeColor;
      ctx.lineWidth = textConfig.strokeWidth;
      ctx.lineJoin = 'miter';
      ctx.miterLimit = 2;

      if (textConfig.topText) {
        const ty = textConfig.topY || 35;
        ctx.strokeText(textConfig.topText, w / 2, ty);
        ctx.fillText(textConfig.topText, w / 2, ty);
      }

      if (textConfig.bottomText) {
        const by = textConfig.bottomY !== null ? textConfig.bottomY : (h - 35);
        ctx.strokeText(textConfig.bottomText, w / 2, by);
        ctx.fillText(textConfig.bottomText, w / 2, by);
      }

      return {
        canvas: outCanvas,
        delay: f.delay
      };
    });
  }

  // --- HSL RGB conversions ---

  static rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }
    return [h, s, l];
  }

  static hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const hNorm = h / 360;
      r = hue2rgb(p, q, hNorm + 1/3);
      g = hue2rgb(p, q, hNorm);
      b = hue2rgb(p, q, hNorm - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }
}

window.EffectsManager = EffectsManager;
