/**
 * Demo Generator
 * Procedurally generates animated emojis directly via Canvas
 * for instant testing of stitching, cropping, and warping without needing external files.
 */

class DemoGenerator {
  /**
   * Generates a cute Shiba Doge wobbly head animation (8 frames)
   * @returns {Array<{ canvas: HTMLCanvasElement, delay: number }>}
   */
  static generateShiba() {
    const size = 200;
    const numFrames = 8;
    const frames = [];

    for (let f = 0; f < numFrames; f++) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      const angle = Math.sin((f / numFrames) * Math.PI * 2) * 0.15;
      const bounceY = Math.abs(Math.sin((f / numFrames) * Math.PI * 2)) * 8;

      ctx.save();
      ctx.translate(size / 2, size / 2 + bounceY);
      ctx.rotate(angle);

      // Shiba head (Warm golden orange)
      ctx.fillStyle = '#E8A857';
      ctx.beginPath();
      ctx.ellipse(0, 0, 70, 60, 0, 0, Math.PI * 2);
      ctx.fill();

      // White muzzle & cheeks
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(-30, 20, 30, 25, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(30, 20, 30, 25, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 25, 26, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ears
      const earWiggle = Math.cos((f / numFrames) * Math.PI * 2) * 0.1;
      // Left ear
      ctx.save();
      ctx.translate(-50, -45);
      ctx.rotate(-0.3 + earWiggle);
      ctx.fillStyle = '#C88536';
      ctx.beginPath();
      ctx.moveTo(0, 20);
      ctx.lineTo(25, -35);
      ctx.lineTo(45, 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FCE3CE';
      ctx.beginPath();
      ctx.moveTo(10, 15);
      ctx.lineTo(25, -20);
      ctx.lineTo(38, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Right ear
      ctx.save();
      ctx.translate(50, -45);
      ctx.rotate(0.3 - earWiggle);
      ctx.fillStyle = '#C88536';
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.lineTo(-25, -35);
      ctx.lineTo(-45, 20);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FCE3CE';
      ctx.beginPath();
      ctx.moveTo(-10, 15);
      ctx.lineTo(-25, -20);
      ctx.lineTo(-38, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Eyebrows (white spots)
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(-30, -28, 10, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(30, -28, 10, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#221915';
      ctx.beginPath();
      ctx.ellipse(-32, -8, 8, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(32, -8, 8, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eye reflections
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-34, -12, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(30, -12, 3, 0, Math.PI * 2);
      ctx.fill();

      // Nose
      ctx.fillStyle = '#1A1412';
      ctx.beginPath();
      ctx.moveTo(-12, 12);
      ctx.lineTo(12, 12);
      ctx.lineTo(0, 24);
      ctx.closePath();
      ctx.fill();

      // Tongue
      const tongueY = 32 + Math.sin((f / numFrames) * Math.PI * 2) * 4;
      ctx.fillStyle = '#FF7A90';
      ctx.beginPath();
      ctx.arc(0, tongueY, 12, 0, Math.PI);
      ctx.fill();

      // Mouth outline
      ctx.strokeStyle = '#2B1E18';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(-10, 26, 12, 0.1 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(10, 26, 12, 0.2 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();

      ctx.restore();

      frames.push({
        index: f,
        canvas,
        delay: 110,
        width: size,
        height: size
      });
    }

    return frames;
  }

  /**
   * Generates a bouncing sweat yellow emoji (10 frames)
   * @returns {Array<{ canvas: HTMLCanvasElement, delay: number }>}
   */
  static generateSweatEmoji() {
    const size = 200;
    const numFrames = 10;
    const frames = [];

    for (let f = 0; f < numFrames; f++) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      const t = (f / numFrames) * Math.PI * 2;
      const bounce = Math.sin(t);
      const scaleY = 1 + bounce * 0.12;
      const scaleX = 1 - bounce * 0.08;
      const offsetY = -Math.abs(Math.sin(t)) * 14;

      ctx.save();
      ctx.translate(size / 2, size / 2 + offsetY);
      ctx.scale(scaleX, scaleY);

      // Yellow head base with gradient
      const grad = ctx.createRadialGradient(-20, -30, 10, 0, 0, 75);
      grad.addColorStop(0, '#FFE866');
      grad.addColorStop(0.8, '#FFBA08');
      grad.addColorStop(1, '#E89400');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 70, 0, Math.PI * 2);
      ctx.fill();

      // Pleading big eyes
      ctx.fillStyle = '#201A15';
      ctx.beginPath();
      ctx.ellipse(-26, -10, 14, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(26, -10, 14, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      // Big eye reflections
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-29, -18, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(23, -18, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-22, -2, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(30, -2, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Curved sad/nervous mouth
      ctx.strokeStyle = '#5E3804';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 48, 20, 1.25 * Math.PI, 1.75 * Math.PI);
      ctx.stroke();

      // Blushing cheeks
      ctx.fillStyle = 'rgba(255, 100, 100, 0.4)';
      ctx.beginPath();
      ctx.ellipse(-42, 14, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(42, 14, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dripping sweat drop (animating drop offset)
      const sweatY = -40 + ((f % 5) / 5) * 20;
      ctx.fillStyle = '#4CC9F0';
      ctx.beginPath();
      ctx.moveTo(48, sweatY);
      ctx.bezierCurveTo(40, sweatY + 12, 38, sweatY + 28, 48, sweatY + 28);
      ctx.bezierCurveTo(58, sweatY + 28, 56, sweatY + 12, 48, sweatY);
      ctx.fill();

      ctx.restore();

      frames.push({
        index: f,
        canvas,
        delay: 90,
        width: size,
        height: size
      });
    }

    return frames;
  }

  /**
   * Generates Thug Life pixel sunglasses overlay animation (8 frames)
   * Can be spliced/overlaid onto any GIF or used standalone!
   * @returns {Array<{ canvas: HTMLCanvasElement, delay: number }>}
   */
  static generateSunglasses() {
    const width = 160;
    const height = 90;
    const numFrames = 8;
    const frames = [];

    for (let f = 0; f < numFrames; f++) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Descending animation then resting
      const dropProgress = Math.min(1, (f + 1) / 4);
      const curY = -30 + dropProgress * 65;

      ctx.save();
      ctx.translate(width / 2, curY);

      // Glasses frame (Thug Life 8-bit black pixel sunglasses)
      ctx.fillStyle = '#111111';

      // Left lens
      ctx.fillRect(-65, -12, 55, 24);
      // Right lens
      ctx.fillRect(10, -12, 55, 24);
      // Bridge
      ctx.fillRect(-10, -8, 20, 8);
      // Temples
      ctx.fillRect(-72, -10, 10, 6);
      ctx.fillRect(62, -10, 10, 6);

      // White pixel glares (reflecting light)
      const glintOffset = (f >= 4) ? ((f - 4) * 8) : 0;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-55 + glintOffset, -8, 8, 8);
      ctx.fillRect(-45 + glintOffset, 0, 6, 6);

      ctx.fillRect(20 + glintOffset, -8, 8, 8);
      ctx.fillRect(30 + glintOffset, 0, 6, 6);

      // Sparkle star at the corner on late frames
      if (f >= 5) {
        ctx.fillStyle = '#FFE57F';
        const sx = 58;
        const sy = -14;
        const starSize = 5 + (f % 2) * 3;
        ctx.beginPath();
        ctx.arc(sx, sy, starSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      frames.push({
        index: f,
        canvas,
        delay: 100,
        width,
        height
      });
    }

    return frames;
  }
}

window.DemoGenerator = DemoGenerator;
