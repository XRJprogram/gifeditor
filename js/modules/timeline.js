/**
 * Timeline Module
 * Manages frame sequence, playback loop, selection, trimming, reordering, and thumbnails strip.
 */

class Timeline {
  constructor(options = {}) {
    this.frames = [];
    this.currentIndex = 0;
    this.isPlaying = false;
    this.playTimer = null;
    this.speedMultiplier = 1.0;
    this.inPoint = null;
    this.outPoint = null;

    this.containerEl = options.containerEl;
    this.onFrameChange = options.onFrameChange || (() => {});
    this.onFramesUpdate = options.onFramesUpdate || (() => {});
  }

  setFrames(frames) {
    this.pause();
    this.frames = frames.map((f, i) => ({
      ...f,
      index: i,
      delay: f.delay || 100
    }));
    this.currentIndex = 0;
    this.inPoint = null;
    this.outPoint = null;
    this.renderStrip();
    this.notifyFrameChange();
    this.onFramesUpdate(this.frames);
  }

  getFrames() {
    return this.frames;
  }

  getCurrentFrame() {
    return this.frames[this.currentIndex] || null;
  }

  setCurrentIndex(index) {
    if (this.frames.length === 0) return;
    this.currentIndex = Math.max(0, Math.min(index, this.frames.length - 1));
    this.updateActiveThumbnail();
    this.notifyFrameChange();
  }

  play() {
    if (this.isPlaying || this.frames.length <= 1) return;
    this.isPlaying = true;
    this.scheduleNextFrame();
  }

  pause() {
    this.isPlaying = false;
    if (this.playTimer) {
      clearTimeout(this.playTimer);
      this.playTimer = null;
    }
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
    return this.isPlaying;
  }

  scheduleNextFrame() {
    if (!this.isPlaying || this.frames.length === 0) return;

    const currentFrame = this.getCurrentFrame();
    const delay = (currentFrame ? currentFrame.delay : 100) / this.speedMultiplier;

    this.playTimer = setTimeout(() => {
      if (!this.isPlaying) return;
      const start = this.inPoint !== null ? this.inPoint : 0;
      const end = this.outPoint !== null ? this.outPoint : this.frames.length - 1;

      let nextIndex = this.currentIndex + 1;
      if (nextIndex > end || nextIndex < start) {
        nextIndex = start;
      }
      this.currentIndex = nextIndex;
      this.updateActiveThumbnail();
      this.notifyFrameChange();
      this.scheduleNextFrame();
    }, Math.max(16, delay));
  }

  stepForward() {
    this.pause();
    if (this.frames.length === 0) return;
    this.setCurrentIndex((this.currentIndex + 1) % this.frames.length);
  }

  stepBackward() {
    this.pause();
    if (this.frames.length === 0) return;
    this.setCurrentIndex((this.currentIndex - 1 + this.frames.length) % this.frames.length);
  }

  setSpeed(multiplier) {
    this.speedMultiplier = Math.max(0.1, multiplier);
  }

  // --- Frame Operations ---

  deleteCurrentFrame() {
    if (this.frames.length <= 1) {
      alert('至少需要保留 1 帧');
      return;
    }
    this.pause();
    this.frames.splice(this.currentIndex, 1);
    this.frames.forEach((f, i) => f.index = i);
    if (this.currentIndex >= this.frames.length) {
      this.currentIndex = this.frames.length - 1;
    }
    this.renderStrip();
    this.notifyFrameChange();
    this.onFramesUpdate(this.frames);
  }

  duplicateCurrentFrame() {
    if (this.frames.length === 0) return;
    this.pause();
    const cur = this.getCurrentFrame();
    const cloneCanvas = document.createElement('canvas');
    cloneCanvas.width = cur.canvas.width;
    cloneCanvas.height = cur.canvas.height;
    const ctx = cloneCanvas.getContext('2d');
    ctx.drawImage(cur.canvas, 0, 0);

    const newFrame = {
      canvas: cloneCanvas,
      delay: cur.delay,
      width: cur.width,
      height: cur.height,
      index: this.currentIndex + 1
    };

    this.frames.splice(this.currentIndex + 1, 0, newFrame);
    this.frames.forEach((f, i) => f.index = i);
    this.currentIndex++;
    this.renderStrip();
    this.notifyFrameChange();
    this.onFramesUpdate(this.frames);
  }

  reverseFrames() {
    if (this.frames.length <= 1) return;
    this.pause();
    this.frames.reverse();
    this.frames.forEach((f, i) => f.index = i);
    this.currentIndex = 0;
    this.renderStrip();
    this.notifyFrameChange();
    this.onFramesUpdate(this.frames);
  }

  applyBoomerang() {
    if (this.frames.length <= 1) return;
    this.pause();
    // Clones reverse frames excluding first and last
    const reversed = [];
    for (let i = this.frames.length - 2; i > 0; i--) {
      const orig = this.frames[i];
      const cloneCanvas = document.createElement('canvas');
      cloneCanvas.width = orig.canvas.width;
      cloneCanvas.height = orig.canvas.height;
      cloneCanvas.getContext('2d').drawImage(orig.canvas, 0, 0);
      reversed.push({
        canvas: cloneCanvas,
        delay: orig.delay,
        width: orig.width,
        height: orig.height
      });
    }
    this.frames = this.frames.concat(reversed);
    this.frames.forEach((f, i) => f.index = i);
    this.renderStrip();
    this.notifyFrameChange();
    this.onFramesUpdate(this.frames);
  }

  setUniformDelay(delayMs) {
    this.frames.forEach(f => f.delay = delayMs);
    this.renderStrip();
    this.onFramesUpdate(this.frames);
  }

  trimToPoints() {
    if (this.inPoint === null && this.outPoint === null) return;
    this.pause();
    const start = this.inPoint !== null ? this.inPoint : 0;
    const end = this.outPoint !== null ? this.outPoint : this.frames.length - 1;
    if (start > end) return;

    this.frames = this.frames.slice(start, end + 1);
    this.frames.forEach((f, i) => f.index = i);
    this.inPoint = null;
    this.outPoint = null;
    this.currentIndex = 0;
    this.renderStrip();
    this.notifyFrameChange();
    this.onFramesUpdate(this.frames);
  }

  // --- Rendering UI Strip ---

  renderStrip() {
    if (!this.containerEl) return;
    this.containerEl.innerHTML = '';

    this.frames.forEach((frame, idx) => {
      const item = document.createElement('div');
      item.className = `timeline-frame-item ${idx === this.currentIndex ? 'active' : ''}`;
      item.dataset.index = idx;

      // Small thumbnail
      const thumb = document.createElement('img');
      thumb.className = 'timeline-thumb';
      thumb.src = frame.canvas.toDataURL('image/png');
      item.appendChild(thumb);

      // Meta info (index + delay)
      const meta = document.createElement('div');
      meta.className = 'timeline-frame-meta';
      meta.textContent = `#${idx + 1} (${frame.delay}ms)`;
      item.appendChild(meta);

      item.onclick = () => {
        this.pause();
        this.setCurrentIndex(idx);
      };

      this.containerEl.appendChild(item);
    });

    this.scrollToActiveThumbnail();
  }

  updateActiveThumbnail() {
    if (!this.containerEl) return;
    const items = this.containerEl.querySelectorAll('.timeline-frame-item');
    items.forEach((item, idx) => {
      if (idx === this.currentIndex) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
    this.scrollToActiveThumbnail();
  }

  scrollToActiveThumbnail() {
    if (!this.containerEl) return;
    const active = this.containerEl.querySelector('.timeline-frame-item.active');
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  notifyFrameChange() {
    this.onFrameChange(this.getCurrentFrame(), this.currentIndex, this.frames.length);
  }
}

window.Timeline = Timeline;
