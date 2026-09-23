/**
 * Canvas View Module
 * Interactive viewport manager supporting zoom, pan, crop box overlay,
 * warp center handle, overlay layer manipulation, and text rendering.
 */

class CanvasView {
  constructor(canvasEl, options = {}) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.container = canvasEl.parentElement;

    this.zoom = 1.0;
    this.pan = { x: 0, y: 0 };
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };

    // Active tool mode: 'view' | 'crop' | 'warp' | 'overlay' | 'text'
    this.toolMode = 'view';

    // Crop box state (canvas pixel coordinates)
    this.cropBox = { x: 0, y: 0, width: 200, height: 200, active: false, aspectRatio: null };
    this.activeCropHandle = null;
    this.cropDragStart = { x: 0, y: 0, box: null };

    // Overlay layer state
    this.overlay = null; // { canvas/frames, x, y, width, height, rotation, opacity, loop }
    this.isDraggingOverlay = false;
    this.overlayDragStart = { x: 0, y: 0, origX: 0, origY: 0 };

    // Warp center point
    this.warpCenter = { x: 0.5, y: 0.5 }; // normalized 0~1
    this.isDraggingWarpCenter = false;

    // Text meme overlay
    this.textConfig = {
      topText: '',
      bottomText: '',
      fontSize: 28,
      fontFamily: 'Impact, sans-serif',
      textColor: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidth: 4,
      topY: 40,
      bottomY: null
    };

    // Current frame canvas to display
    this.currentFrameCanvas = null;

    // Callbacks
    this.onCropChange = options.onCropChange || (() => {});
    this.onWarpCenterChange = options.onWarpCenterChange || (() => {});
    this.onOverlayChange = options.onOverlayChange || (() => {});

    this.initEvents();
  }

  setFrame(frameCanvas) {
    const isFirstTime = !this.currentFrameCanvas;
    this.currentFrameCanvas = frameCanvas;

    if (isFirstTime && frameCanvas) {
      this.resetCropBoxToFrame();
      this.fitToContainer();
    }
    this.render();
  }

  setToolMode(mode) {
    this.toolMode = mode;
    this.render();
  }

  setCropAspectRatio(ratio) { // null or number (e.g. 1 for 1:1, 4/3, 16/9)
    this.cropBox.aspectRatio = ratio;
    if (ratio && this.cropBox.width > 0) {
      this.cropBox.height = Math.round(this.cropBox.width / ratio);
      this.constrainCropBox();
    }
    this.render();
    this.onCropChange(this.cropBox);
  }

  resetCropBoxToFrame() {
    if (!this.currentFrameCanvas) return;
    const w = this.currentFrameCanvas.width;
    const h = this.currentFrameCanvas.height;
    this.cropBox = {
      x: 0,
      y: 0,
      width: w,
      height: h,
      active: true,
      aspectRatio: this.cropBox.aspectRatio
    };
    this.onCropChange(this.cropBox);
  }

  constrainCropBox() {
    if (!this.currentFrameCanvas) return;
    const fw = this.currentFrameCanvas.width;
    const fh = this.currentFrameCanvas.height;

    this.cropBox.x = Math.max(0, Math.min(this.cropBox.x, fw - 20));
    this.cropBox.y = Math.max(0, Math.min(this.cropBox.y, fh - 20));
    this.cropBox.width = Math.max(20, Math.min(this.cropBox.width, fw - this.cropBox.x));
    this.cropBox.height = Math.max(20, Math.min(this.cropBox.height, fh - this.cropBox.y));

    if (this.cropBox.aspectRatio) {
      let h = Math.round(this.cropBox.width / this.cropBox.aspectRatio);
      if (this.cropBox.y + h > fh) {
        h = fh - this.cropBox.y;
        this.cropBox.width = Math.round(h * this.cropBox.aspectRatio);
      }
      this.cropBox.height = h;
    }
  }

  fitToContainer() {
    if (!this.currentFrameCanvas || !this.container) return;
    const cw = this.container.clientWidth || 600;
    const ch = this.container.clientHeight || 450;
    const fw = this.currentFrameCanvas.width;
    const fh = this.currentFrameCanvas.height;

    const scale = Math.min((cw - 40) / fw, (ch - 40) / fh, 2.5);
    this.zoom = Math.max(0.2, scale);
    this.pan = {
      x: (cw - fw * this.zoom) / 2,
      y: (ch - fh * this.zoom) / 2
    };
    this.render();
  }

  // --- Coordinate helpers ---

  clientToCanvas(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: (sx - this.pan.x) / this.zoom,
      y: (sy - this.pan.y) / this.zoom
    };
  }

  canvasToScreen(cx, cy) {
    return {
      x: cx * this.zoom + this.pan.x,
      y: cy * this.zoom + this.pan.y
    };
  }

  // --- Event Handling ---

  initEvents() {
    // Wheel zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      const mouse = this.clientToCanvas(e.clientX, e.clientY);

      const newZoom = Math.max(0.1, Math.min(10, this.zoom * zoomFactor));
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      this.pan.x = sx - mouse.x * newZoom;
      this.pan.y = sy - mouse.y * newZoom;
      this.zoom = newZoom;
      this.render();
    }, { passive: false });

    // Pointer down
    this.canvas.addEventListener('pointerdown', (e) => {
      const pos = this.clientToCanvas(e.clientX, e.clientY);

      // Space key or middle click: Pan
      if (e.button === 1 || e.spaceKey || (e.altKey && e.button === 0)) {
        this.isPanning = true;
        this.panStart = { x: e.clientX - this.pan.x, y: e.clientY - this.pan.y };
        this.canvas.style.cursor = 'grabbing';
        return;
      }

      if (e.button !== 0) return;

      if (this.toolMode === 'crop') {
        const handle = this.getCropHandleAt(pos.x, pos.y);
        if (handle) {
          this.activeCropHandle = handle;
          this.cropDragStart = { x: pos.x, y: pos.y, box: { ...this.cropBox } };
          return;
        } else if (this.isInsideCropBox(pos.x, pos.y)) {
          this.activeCropHandle = 'move';
          this.cropDragStart = { x: pos.x, y: pos.y, box: { ...this.cropBox } };
          return;
        }
      }

      if (this.toolMode === 'warp') {
        // Check if clicked near warp center
        if (this.currentFrameCanvas) {
          const w = this.currentFrameCanvas.width;
          const h = this.currentFrameCanvas.height;
          const wx = this.warpCenter.x * w;
          const wy = this.warpCenter.y * h;
          const dist = Math.hypot(pos.x - wx, pos.y - wy);
          if (dist < 30 / this.zoom || true) { // Allow click anywhere to reposition warp center
            this.warpCenter = {
              x: Math.max(0, Math.min(1, pos.x / w)),
              y: Math.max(0, Math.min(1, pos.y / h))
            };
            this.isDraggingWarpCenter = true;
            this.render();
            this.onWarpCenterChange(this.warpCenter);
            return;
          }
        }
      }

      if (this.toolMode === 'overlay' && this.overlay) {
        // Drag overlay
        const ox = this.overlay.x;
        const oy = this.overlay.y;
        const ow = this.overlay.width;
        const oh = this.overlay.height;
        if (pos.x >= ox && pos.x <= ox + ow && pos.y >= oy && pos.y <= oy + oh) {
          this.isDraggingOverlay = true;
          this.overlayDragStart = { x: pos.x, y: pos.y, origX: ox, origY: oy };
          return;
        }
      }

      // Default drag pan if no tool caught it
      this.isPanning = true;
      this.panStart = { x: e.clientX - this.pan.x, y: e.clientY - this.pan.y };
    });

    // Pointer move
    window.addEventListener('pointermove', (e) => {
      if (this.isPanning) {
        this.pan.x = e.clientX - this.panStart.x;
        this.pan.y = e.clientY - this.panStart.y;
        this.render();
        return;
      }

      const pos = this.clientToCanvas(e.clientX, e.clientY);

      if (this.toolMode === 'crop' && this.activeCropHandle) {
        this.handleCropDrag(pos);
        this.render();
        this.onCropChange(this.cropBox);
        return;
      }

      if (this.toolMode === 'warp' && this.isDraggingWarpCenter && this.currentFrameCanvas) {
        const w = this.currentFrameCanvas.width;
        const h = this.currentFrameCanvas.height;
        this.warpCenter = {
          x: Math.max(0, Math.min(1, pos.x / w)),
          y: Math.max(0, Math.min(1, pos.y / h))
        };
        this.render();
        this.onWarpCenterChange(this.warpCenter);
        return;
      }

      if (this.toolMode === 'overlay' && this.isDraggingOverlay && this.overlay) {
        const dx = pos.x - this.overlayDragStart.x;
        const dy = pos.y - this.overlayDragStart.y;
        this.overlay.x = Math.round(this.overlayDragStart.origX + dx);
        this.overlay.y = Math.round(this.overlayDragStart.origY + dy);
        this.render();
        this.onOverlayChange(this.overlay);
        return;
      }

      // Update cursor
      if (this.toolMode === 'crop') {
        const handle = this.getCropHandleAt(pos.x, pos.y);
        if (handle) {
          this.canvas.style.cursor = `${handle}-resize`;
        } else if (this.isInsideCropBox(pos.x, pos.y)) {
          this.canvas.style.cursor = 'move';
        } else {
          this.canvas.style.cursor = 'crosshair';
        }
      } else if (this.toolMode === 'warp') {
        this.canvas.style.cursor = 'crosshair';
      } else {
        this.canvas.style.cursor = 'default';
      }
    });

    // Pointer up
    window.addEventListener('pointerup', () => {
      this.isPanning = false;
      this.activeCropHandle = null;
      this.isDraggingWarpCenter = false;
      this.isDraggingOverlay = false;
      this.canvas.style.cursor = 'default';
    });

    // Window resize
    window.addEventListener('resize', () => {
      this.resizeCanvasToContainer();
      this.render();
    });

    this.resizeCanvasToContainer();
  }

  resizeCanvasToContainer() {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.canvas.width = w;
    this.canvas.height = h;
  }

  // --- Crop Box Drag Helpers ---

  getCropHandleAt(cx, cy) {
    const b = this.cropBox;
    const tolerance = 15 / this.zoom;
    const corners = [
      { name: 'nw', x: b.x, y: b.y },
      { name: 'ne', x: b.x + b.width, y: b.y },
      { name: 'se', x: b.x + b.width, y: b.y + b.height },
      { name: 'sw', x: b.x, y: b.y + b.height },
      { name: 'n', x: b.x + b.width / 2, y: b.y },
      { name: 's', x: b.x + b.width / 2, y: b.y + b.height },
      { name: 'w', x: b.x, y: b.y + b.height / 2 },
      { name: 'e', x: b.x + b.width, y: b.y + b.height / 2 }
    ];

    for (const c of corners) {
      if (Math.hypot(cx - c.x, cy - c.y) <= tolerance) {
        return c.name;
      }
    }
    return null;
  }

  isInsideCropBox(cx, cy) {
    const b = this.cropBox;
    return cx >= b.x && cx <= b.x + b.width && cy >= b.y && cy <= b.y + b.height;
  }

  handleCropDrag(pos) {
    const start = this.cropDragStart;
    const dx = pos.x - start.x;
    const dy = pos.y - start.y;
    const b = { ...start.box };

    if (this.activeCropHandle === 'move') {
      b.x += dx;
      b.y += dy;
    } else {
      if (this.activeCropHandle.includes('e')) b.width += dx;
      if (this.activeCropHandle.includes('s')) b.height += dy;
      if (this.activeCropHandle.includes('w')) {
        b.x += dx;
        b.width -= dx;
      }
      if (this.activeCropHandle.includes('n')) {
        b.y += dy;
        b.height -= dy;
      }
    }

    if (b.width < 20) b.width = 20;
    if (b.height < 20) b.height = 20;

    this.cropBox.x = Math.round(b.x);
    this.cropBox.y = Math.round(b.y);
    this.cropBox.width = Math.round(b.width);
    this.cropBox.height = Math.round(b.height);

    this.constrainCropBox();
  }

  // --- Main Rendering Loop ---

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Draw background checkered pattern
    this.drawCheckerboard(ctx, w, h);

    if (!this.currentFrameCanvas) return;

    ctx.save();
    ctx.translate(this.pan.x, this.pan.y);
    ctx.scale(this.zoom, this.zoom);

    // 1. Draw base frame
    ctx.drawImage(this.currentFrameCanvas, 0, 0);

    // 2. Draw overlay layer if present
    if (this.overlay && this.overlay.canvas) {
      ctx.save();
      ctx.globalAlpha = this.overlay.opacity !== undefined ? this.overlay.opacity : 1.0;
      ctx.translate(this.overlay.x + this.overlay.width / 2, this.overlay.y + this.overlay.height / 2);
      if (this.overlay.rotation) {
        ctx.rotate((this.overlay.rotation * Math.PI) / 180);
      }
      ctx.drawImage(this.overlay.canvas, -this.overlay.width / 2, -this.overlay.height / 2, this.overlay.width, this.overlay.height);
      ctx.restore();

      // Draw overlay bounding box when in overlay tool
      if (this.toolMode === 'overlay') {
        ctx.save();
        ctx.strokeStyle = '#4CC9F0';
        ctx.lineWidth = 1.5 / this.zoom;
        ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);
        ctx.strokeRect(this.overlay.x, this.overlay.y, this.overlay.width, this.overlay.height);
        ctx.restore();
      }
    }

    // 3. Draw Meme Text if configured
    this.drawMemeText(ctx);

    // 4. Draw Crop Overlay if in crop mode
    if (this.toolMode === 'crop') {
      this.drawCropOverlay(ctx);
    }

    // 5. Draw Warp Center Handle if in warp mode
    if (this.toolMode === 'warp') {
      this.drawWarpHandle(ctx);
    }

    ctx.restore();
  }

  drawCheckerboard(ctx, w, h) {
    const size = 16;
    ctx.fillStyle = '#1e1e24';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#262630';
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        if ((x / size + y / size) % 2 === 0) {
          ctx.fillRect(x, y, size, size);
        }
      }
    }
  }

  drawMemeText(ctx) {
    if (!this.textConfig) return;
    const fw = this.currentFrameCanvas.width;
    const fh = this.currentFrameCanvas.height;

    ctx.save();
    ctx.font = `bold ${this.textConfig.fontSize}px ${this.textConfig.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.textConfig.textColor;
    ctx.strokeStyle = this.textConfig.strokeColor;
    ctx.lineWidth = this.textConfig.strokeWidth;
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 2;

    if (this.textConfig.topText) {
      const ty = this.textConfig.topY || 35;
      ctx.strokeText(this.textConfig.topText, fw / 2, ty);
      ctx.fillText(this.textConfig.topText, fw / 2, ty);
    }

    if (this.textConfig.bottomText) {
      const by = this.textConfig.bottomY !== null ? this.textConfig.bottomY : (fh - 35);
      ctx.strokeText(this.textConfig.bottomText, fw / 2, by);
      ctx.fillText(this.textConfig.bottomText, fw / 2, by);
    }

    ctx.restore();
  }

  drawCropOverlay(ctx) {
    const fw = this.currentFrameCanvas.width;
    const fh = this.currentFrameCanvas.height;
    const b = this.cropBox;

    // Darken exterior
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    // Outer frame
    ctx.rect(-1000, -1000, fw + 2000, fh + 2000);
    // Inner cutout
    ctx.rect(b.x + b.width, b.y, -b.width, b.height);
    ctx.fill();

    // Crop box outline
    ctx.strokeStyle = '#00F5D4';
    ctx.lineWidth = 2 / this.zoom;
    ctx.strokeRect(b.x, b.y, b.width, b.height);

    // Rule of thirds grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1 / this.zoom;
    ctx.beginPath();
    ctx.moveTo(b.x + b.width / 3, b.y);
    ctx.lineTo(b.x + b.width / 3, b.y + b.height);
    ctx.moveTo(b.x + (b.width * 2) / 3, b.y);
    ctx.lineTo(b.x + (b.width * 2) / 3, b.y + b.height);
    ctx.moveTo(b.x, b.y + b.height / 3);
    ctx.lineTo(b.x + b.width, b.y + b.height / 3);
    ctx.moveTo(b.x, b.y + (b.height * 2) / 3);
    ctx.lineTo(b.x + b.width, b.y + (b.height * 2) / 3);
    ctx.stroke();

    // Corner and edge handles
    const handleSize = 8 / this.zoom;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#00F5D4';
    ctx.lineWidth = 2 / this.zoom;

    const handles = [
      [b.x, b.y],
      [b.x + b.width, b.y],
      [b.x + b.width, b.y + b.height],
      [b.x, b.y + b.height],
      [b.x + b.width / 2, b.y],
      [b.x + b.width / 2, b.y + b.height],
      [b.x, b.y + b.height / 2],
      [b.x + b.width, b.y + b.height / 2]
    ];

    handles.forEach(([hx, hy]) => {
      ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
    });

    ctx.restore();
  }

  drawWarpHandle(ctx) {
    if (!this.currentFrameCanvas) return;
    const fw = this.currentFrameCanvas.width;
    const fh = this.currentFrameCanvas.height;
    const cx = this.warpCenter.x * fw;
    const cy = this.warpCenter.y * fh;
    const r = 16 / this.zoom;

    ctx.save();
    // Outer pulse ring
    ctx.strokeStyle = '#FF007F';
    ctx.lineWidth = 2.5 / this.zoom;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(cx - r * 1.5, cy);
    ctx.lineTo(cx + r * 1.5, cy);
    ctx.moveTo(cx, cy - r * 1.5);
    ctx.lineTo(cx, cy + r * 1.5);
    ctx.stroke();

    // Center point
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx, cy, 4 / this.zoom, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

window.CanvasView = CanvasView;
