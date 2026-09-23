/**
 * Blueprint Canvas View Controller
 * Manages panning, zooming, node rendering, pin connections, and bezier wire drawing.
 */

class BlueprintCanvas {
  constructor(containerEl, graphModel, options = {}) {
    this.container = containerEl;
    this.model = graphModel;

    // Viewport transform
    this.zoom = 1.0;
    this.pan = { x: 80, y: 80 };
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };

    // Active wire drawing state
    this.isDrawingWire = false;
    this.wireSource = null; // { nodeId, pinId, x, y }
    this.mouseCanvasPos = { x: 0, y: 0 };

    // Active node dragging
    this.draggingNode = null;
    this.nodeDragStart = { x: 0, y: 0, nodeX: 0, nodeY: 0 };

    // Callbacks
    this.onSelectEmojiForNode = options.onSelectEmojiForNode || (() => {});
    this.onNodeSelected = options.onNodeSelected || (() => {});

    this.initDOM();
    this.initEvents();

    // Subscribe to model changes
    this.model.onGraphUpdate = (data) => {
      this.render(data.needsRender);
    };
  }

  initDOM() {
    this.container.classList.add('blueprint-container');

    // Transform layer
    this.transformLayer = document.createElement('div');
    this.transformLayer.className = 'blueprint-transform-layer';

    // SVG layer for wires
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'blueprint-wires-svg');

    // Drawing wire path
    this.drawingWirePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.drawingWirePath.setAttribute('class', 'blueprint-wire-drawing');
    this.drawingWirePath.style.display = 'none';
    this.svg.appendChild(this.drawingWirePath);

    // Nodes layer
    this.nodesLayer = document.createElement('div');
    this.nodesLayer.className = 'blueprint-nodes-layer';

    this.transformLayer.appendChild(this.svg);
    this.transformLayer.appendChild(this.nodesLayer);
    this.container.appendChild(this.transformLayer);

    this.updateTransform();
  }

  updateTransform() {
    this.transformLayer.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`;
    // Update grid background offset & scale
    const bgScale = 20 * this.zoom;
    const bgScaleLarge = 100 * this.zoom;
    this.container.style.backgroundSize = `${bgScale}px ${bgScale}px, ${bgScale}px ${bgScale}px, ${bgScaleLarge}px ${bgScaleLarge}px, ${bgScaleLarge}px ${bgScaleLarge}px`;
    this.container.style.backgroundPosition = `${this.pan.x}px ${this.pan.y}px`;
  }

  screenToCanvas(clientX, clientY) {
    const rect = this.container.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.pan.x) / this.zoom,
      y: (clientY - rect.top - this.pan.y) / this.zoom
    };
  }

  initEvents() {
    // Wheel Zoom
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
      const mouse = this.screenToCanvas(e.clientX, e.clientY);

      const newZoom = Math.max(0.2, Math.min(2.5, this.zoom * zoomFactor));
      const rect = this.container.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      this.pan.x = sx - mouse.x * newZoom;
      this.pan.y = sy - mouse.y * newZoom;
      this.zoom = newZoom;
      this.updateTransform();
    }, { passive: false });

    // Pointer Down (Pan or Node Drag)
    this.container.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.bp-pin-circle') || e.target.closest('input') || e.target.closest('button') || e.target.closest('.bp-dual-range-container')) {
        return; // Don't pan if interacting with controls
      }

      const header = e.target.closest('.bp-node-header');
      if (header) {
        // Drag node
        const nodeEl = header.closest('.bp-node');
        const nodeId = nodeEl.dataset.nodeId;
        const node = this.model.nodes.get(nodeId);
        if (node) {
          this.draggingNode = node;
          const pos = this.screenToCanvas(e.clientX, e.clientY);
          this.nodeDragStart = {
            x: pos.x,
            y: pos.y,
            nodeX: node.x,
            nodeY: node.y
          };
          this.selectNode(nodeId);
          return;
        }
      }

      // Pan canvas
      if (e.button === 0 || e.button === 1 || e.button === 2) {
        this.isPanning = true;
        this.panStart = { x: e.clientX - this.pan.x, y: e.clientY - this.pan.y };
        this.container.classList.add('grabbing');
      }
    });

    // Pointer Move
    window.addEventListener('pointermove', (e) => {
      if (this.isPanning) {
        this.pan.x = e.clientX - this.panStart.x;
        this.pan.y = e.clientY - this.panStart.y;
        this.updateTransform();
        return;
      }

      const pos = this.screenToCanvas(e.clientX, e.clientY);
      this.mouseCanvasPos = pos;

      if (this.draggingNode) {
        const dx = pos.x - this.nodeDragStart.x;
        const dy = pos.y - this.nodeDragStart.y;
        this.draggingNode.x = Math.round(this.nodeDragStart.nodeX + dx);
        this.draggingNode.y = Math.round(this.nodeDragStart.nodeY + dy);

        // Update DOM node position directly for smooth 60fps
        const nodeEl = this.nodesLayer.querySelector(`[data-node-id="${this.draggingNode.id}"]`);
        if (nodeEl) {
          nodeEl.style.left = `${this.draggingNode.x}px`;
          nodeEl.style.top = `${this.draggingNode.y}px`;
        }
        this.renderWires();
        return;
      }

      if (this.isDrawingWire) {
        this.updateDrawingWire(pos.x, pos.y);
      }
    });

    // Pointer Up
    window.addEventListener('pointerup', (e) => {
      if (this.isPanning) {
        this.isPanning = false;
        this.container.classList.remove('grabbing');
      }

      if (this.draggingNode) {
        this.model.notifyUpdate(false);
        this.draggingNode = null;
      }

      if (this.isDrawingWire) {
        // Check if dropped on a pin
        const targetPin = e.target.closest('.bp-pin-circle');
        if (targetPin && targetPin.dataset.pinType === 'input') {
          const toNode = targetPin.dataset.nodeId;
          const toPin = targetPin.dataset.pinId;
          const meta = this.wireSource ? this.wireSource.detachedMeta : null;

          if (meta && meta.origToNode === toNode && meta.origToPin === toPin) {
            // 连到原来的输入端就是删除这条线 (already disconnected on drag start)
          } else {
            this.model.connect(this.wireSource.nodeId, this.wireSource.pinId, toNode, toPin);
          }
        }
        this.cancelDrawingWire();
      }
    });

    // Prevent context menu on canvas for smooth right-click panning
    this.container.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  selectNode(nodeId) {
    this.nodesLayer.querySelectorAll('.bp-node').forEach(el => {
      if (el.dataset.nodeId === nodeId) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });
    const node = this.model.nodes.get(nodeId);
    if (node) {
      this.onNodeSelected(node);
    }
  }

  // --- Wire Drawing Interaction ---

  startDrawingWire(nodeId, pinId, pinEl, detachedMeta = null) {
    const pinRect = pinEl.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();

    const startX = (pinRect.left + pinRect.width / 2 - containerRect.left - this.pan.x) / this.zoom;
    const startY = (pinRect.top + pinRect.height / 2 - containerRect.top - this.pan.y) / this.zoom;

    this.isDrawingWire = true;
    this.wireSource = { nodeId, pinId, x: startX, y: startY, detachedMeta };
    this.drawingWirePath.style.display = 'block';
    this.updateDrawingWire(startX, startY);
  }

  updateDrawingWire(endX, endY) {
    const { x: startX, y: startY } = this.wireSource;
    const pathD = this.calculateBezierPath(startX, startY, endX, endY);
    this.drawingWirePath.setAttribute('d', pathD);
  }

  cancelDrawingWire() {
    this.isDrawingWire = false;
    this.wireSource = null;
    this.drawingWirePath.style.display = 'none';
  }

  calculateBezierPath(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1);
    const curvature = Math.max(40, dx * 0.5);
    return `M ${x1} ${y1} C ${x1 + curvature} ${y1}, ${x2 - curvature} ${y2}, ${x2} ${y2}`;
  }

  // --- Main Render ---

  render(fullRebuild = true) {
    if (fullRebuild) {
      this.renderNodes();
    }
    this.renderWires();
  }

  renderNodes() {
    this.nodesLayer.innerHTML = '';

    this.model.nodes.forEach(node => {
      const def = window.NODE_DEFINITIONS[node.type];
      if (!def) return;

      const cat = window.NODE_CATEGORIES[def.category] || window.NODE_CATEGORIES.COMPOSITION;

      const nodeEl = document.createElement('div');
      nodeEl.className = 'bp-node';
      nodeEl.dataset.nodeId = node.id;
      nodeEl.style.left = `${node.x}px`;
      nodeEl.style.top = `${node.y}px`;

      // Header
      const headerEl = document.createElement('div');
      headerEl.className = 'bp-node-header';
      headerEl.style.setProperty('--node-color', cat.color);

      const titleGroup = document.createElement('div');
      titleGroup.className = 'bp-node-title-group';
      titleGroup.innerHTML = `
        <span class="bp-node-title">${def.title}</span>
        ${def.subtitle ? `<span class="bp-node-subtitle">${def.subtitle}</span>` : ''}
      `;

      const closeBtn = document.createElement('button');
      closeBtn.className = 'bp-node-close';
      closeBtn.innerHTML = '&times;';
      closeBtn.title = '删除此节点';
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        this.model.removeNode(node.id);
      };

      headerEl.appendChild(titleGroup);
      headerEl.appendChild(closeBtn);
      nodeEl.appendChild(headerEl);

      // Body
      const bodyEl = document.createElement('div');
      bodyEl.className = 'bp-node-body';

      // Pins Row (Inputs on Left, Outputs on Right)
      const pinsRow = document.createElement('div');
      pinsRow.className = 'bp-pins-row';

      const inputsCol = document.createElement('div');
      inputsCol.className = 'bp-pins-inputs';
      def.inputs.forEach(pin => {
        const pinEl = document.createElement('div');
        pinEl.className = 'bp-pin';

        const circle = document.createElement('div');
        circle.className = 'bp-pin-circle';
        circle.dataset.nodeId = node.id;
        circle.dataset.pinId = pin.id;
        circle.dataset.pinType = 'input';

        // Check if connected
        const isConn = this.model.connections.some(c => c.toNode === node.id && c.toPin === pin.id);
        if (isConn) {
          circle.classList.add('connected');
          circle.title = '拖拽可重连至其他输入端，连回原处或空白处可删除此连线';
        }

        circle.onpointerdown = (e) => {
          e.stopPropagation();
          const existingConn = this.model.connections.find(c => c.toNode === node.id && c.toPin === pin.id);
          if (existingConn) {
            this.model.disconnect(existingConn.id);
            const fromPinCircle = this.nodesLayer.querySelector(
              `[data-node-id="${existingConn.fromNode}"][data-pin-id="${existingConn.fromPin}"][data-pin-type="output"]`
            );
            if (fromPinCircle) {
              this.startDrawingWire(existingConn.fromNode, existingConn.fromPin, fromPinCircle, {
                origToNode: node.id,
                origToPin: pin.id
              });
            }
          }
        };

        pinEl.appendChild(circle);
        pinEl.appendChild(document.createTextNode(pin.name));
        inputsCol.appendChild(pinEl);
      });

      const outputsCol = document.createElement('div');
      outputsCol.className = 'bp-pins-outputs';
      def.outputs.forEach(pin => {
        const pinEl = document.createElement('div');
        pinEl.className = 'bp-pin bp-pin-output';

        pinEl.appendChild(document.createTextNode(pin.name));

        const circle = document.createElement('div');
        circle.className = 'bp-pin-circle';
        circle.dataset.nodeId = node.id;
        circle.dataset.pinId = pin.id;
        circle.dataset.pinType = 'output';

        const isConn = this.model.connections.some(c => c.fromNode === node.id && c.fromPin === pin.id);
        if (isConn) circle.classList.add('connected');

        // Drag wire from output pin
        circle.onpointerdown = (e) => {
          e.stopPropagation();
          this.startDrawingWire(node.id, pin.id, circle);
        };

        pinEl.appendChild(circle);
        outputsCol.appendChild(pinEl);
      });

      pinsRow.appendChild(inputsCol);
      pinsRow.appendChild(outputsCol);
      bodyEl.appendChild(pinsRow);

      // Node Custom Parameters UI
      const paramsEl = this.buildNodeParamsUI(node, def);
      if (paramsEl) {
        bodyEl.appendChild(paramsEl);
      }

      nodeEl.appendChild(bodyEl);
      this.nodesLayer.appendChild(nodeEl);
    });
  }

  buildNodeParamsUI(node, def) {
    const box = document.createElement('div');
    box.className = 'bp-node-params';

    if (node.type === 'input_emoji') {
      const emojiId = node.params.emojiId || '14';
      const info = window.QQEmojiService.getEmojiInfo(emojiId);
      const name = info ? info.name : `表情`;
      const thumb = window.QQEmojiService.getThumbnailUrl(emojiId);

      const card = document.createElement('div');
      card.className = 'bp-emoji-card';
      card.innerHTML = `
        <img class="bp-emoji-thumb" src="${thumb}" alt="${name}">
        <div class="bp-emoji-info">
          <div class="bp-emoji-name">${name}</div>
          <div class="bp-emoji-tag">官方动态表情</div>
        </div>
      `;

      const changeBtn = document.createElement('button');
      changeBtn.className = 'btn btn-sm btn-primary';
      changeBtn.style.width = '100%';
      changeBtn.style.justifyContent = 'center';
      changeBtn.textContent = '更换表情';
      changeBtn.onclick = () => {
        this.onSelectEmojiForNode(node);
      };

      box.appendChild(card);
      box.appendChild(changeBtn);
      return box;
    }

    if (node.type === 'symmetry_dual' || node.type === 'mirror_symmetry') {
      const keep = node.params.keep || (node.params.direction === 'right_to_left' ? 'right' : node.params.direction === 'top_to_bottom' ? 'top' : node.params.direction === 'bottom_to_top' ? 'bottom' : 'left');
      box.innerHTML = `
        <div class="bp-segmented-tabs" id="tabs_dual_${node.id}">
          <button class="bp-tab-btn ${keep === 'left' ? 'active' : ''}" data-keep="left">左侧</button>
          <button class="bp-tab-btn ${keep === 'top' ? 'active' : ''}" data-keep="top">上方</button>
          <button class="bp-tab-btn ${keep === 'right' ? 'active' : ''}" data-keep="right">右侧</button>
          <button class="bp-tab-btn ${keep === 'bottom' ? 'active' : ''}" data-keep="bottom">下方</button>
        </div>
      `;
      box.querySelectorAll('.bp-tab-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const targetKeep = btn.dataset.keep;
          box.querySelectorAll('.bp-tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.model.updateNodeParams(node.id, { keep: targetKeep });
        };
      });
      return box;
    }

    if (node.type === 'symmetry_quad') {
      const quad = node.params.quadrant || 'top_left';
      box.innerHTML = `
        <div class="bp-segmented-tabs" id="tabs_quad_${node.id}">
          <button class="bp-tab-btn ${quad === 'top_left' ? 'active' : ''}" data-quad="top_left">左上</button>
          <button class="bp-tab-btn ${quad === 'top_right' ? 'active' : ''}" data-quad="top_right">右上</button>
          <button class="bp-tab-btn ${quad === 'bottom_left' ? 'active' : ''}" data-quad="bottom_left">左下</button>
          <button class="bp-tab-btn ${quad === 'bottom_right' ? 'active' : ''}" data-quad="bottom_right">右下</button>
        </div>
      `;
      box.querySelectorAll('.bp-tab-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const targetQuad = btn.dataset.quad;
          box.querySelectorAll('.bp-tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.model.updateNodeParams(node.id, { quadrant: targetQuad });
        };
      });
      return box;
    }

    if (node.type === 'overlay') {
      box.innerHTML = `
        <div class="bp-param-block">
          <div class="bp-param-header">
            <span class="bp-param-label">X 偏移</span>
            <span class="bp-param-val" id="val_x_${node.id}">${node.params.x || 0}px</span>
          </div>
          <input type="range" class="bp-param-slider" id="slider_x_${node.id}" min="-80" max="80" value="${node.params.x || 0}">
        </div>
        <div class="bp-param-block">
          <div class="bp-param-header">
            <span class="bp-param-label">Y 偏移</span>
            <span class="bp-param-val" id="val_y_${node.id}">${node.params.y || 0}px</span>
          </div>
          <input type="range" class="bp-param-slider" id="slider_y_${node.id}" min="-80" max="80" value="${node.params.y || 0}">
        </div>
        <div class="bp-param-block">
          <div class="bp-param-header">
            <span class="bp-param-label">尺寸缩放</span>
            <span class="bp-param-val" id="val_scale_${node.id}">${node.params.scale || 60}%</span>
          </div>
          <input type="range" class="bp-param-slider" id="slider_scale_${node.id}" min="20" max="200" value="${node.params.scale || 60}">
        </div>
        <div class="bp-param-block">
          <div class="bp-param-header">
            <span class="bp-param-label">旋转角度</span>
            <span class="bp-param-val" id="val_rot_${node.id}">${node.params.rotation || 0}&deg;</span>
          </div>
          <input type="range" class="bp-param-slider" id="slider_rot_${node.id}" min="-180" max="180" value="${node.params.rotation || 0}">
        </div>
        <div class="bp-param-block">
          <div class="bp-param-header">
            <span class="bp-param-label">不透明度</span>
            <span class="bp-param-val" id="val_op_${node.id}">${node.params.opacity !== undefined ? node.params.opacity : 100}%</span>
          </div>
          <input type="range" class="bp-param-slider" id="slider_op_${node.id}" min="10" max="100" value="${node.params.opacity !== undefined ? node.params.opacity : 100}">
        </div>
      `;

      setTimeout(() => {
        const sx = box.querySelector(`#slider_x_${node.id}`);
        const sy = box.querySelector(`#slider_y_${node.id}`);
        const sc = box.querySelector(`#slider_scale_${node.id}`);
        const sr = box.querySelector(`#slider_rot_${node.id}`);
        const so = box.querySelector(`#slider_op_${node.id}`);

        if (sx) sx.oninput = (e) => {
          const v = parseInt(e.target.value, 10);
          box.querySelector(`#val_x_${node.id}`).textContent = `${v}px`;
          this.model.updateNodeParams(node.id, { x: v });
        };
        if (sy) sy.oninput = (e) => {
          const v = parseInt(e.target.value, 10);
          box.querySelector(`#val_y_${node.id}`).textContent = `${v}px`;
          this.model.updateNodeParams(node.id, { y: v });
        };
        if (sc) sc.oninput = (e) => {
          const v = parseInt(e.target.value, 10);
          box.querySelector(`#val_scale_${node.id}`).textContent = `${v}%`;
          this.model.updateNodeParams(node.id, { scale: v });
        };
        if (sr) sr.oninput = (e) => {
          const v = parseInt(e.target.value, 10);
          box.querySelector(`#val_rot_${node.id}`).innerHTML = `${v}&deg;`;
          this.model.updateNodeParams(node.id, { rotation: v });
        };
        if (so) so.oninput = (e) => {
          const v = parseInt(e.target.value, 10);
          box.querySelector(`#val_op_${node.id}`).textContent = `${v}%`;
          this.model.updateNodeParams(node.id, { opacity: v });
        };
      }, 0);

      return box;
    }

    if (node.type === 'color_adjust') {
      const curFilter = node.params.filter || 'none';
      box.innerHTML = `
        <div class="bp-segmented-tabs" style="display:flex; flex-wrap:wrap; gap:3px; margin-bottom:10px;">
          <button class="bp-tab-btn ${curFilter === 'none' ? 'active' : ''}" data-filt="none">无</button>
          <button class="bp-tab-btn ${curFilter === 'grayscale' ? 'active' : ''}" data-filt="grayscale">灰度</button>
          <button class="bp-tab-btn ${curFilter === 'invert' ? 'active' : ''}" data-filt="invert">反色</button>
          <button class="bp-tab-btn ${curFilter === 'sepia' ? 'active' : ''}" data-filt="sepia">复古</button>
          <button class="bp-tab-btn ${curFilter === 'cyberpunk' ? 'active' : ''}" data-filt="cyberpunk">赛博</button>
          <button class="bp-tab-btn ${curFilter === 'high_contrast' ? 'active' : ''}" data-filt="high_contrast">高反差</button>
          <button class="bp-tab-btn ${curFilter === 'warm' ? 'active' : ''}" data-filt="warm">暖调</button>
          <button class="bp-tab-btn ${curFilter === 'cool' ? 'active' : ''}" data-filt="cool">冷调</button>
        </div>
        <div class="bp-param-block">
          <div class="bp-param-header">
            <span class="bp-param-label">色相偏移</span>
            <span class="bp-param-val" id="val_hue_${node.id}">${node.params.hueRotate || 0}&deg;</span>
          </div>
          <input type="range" class="bp-param-slider" id="slider_hue_${node.id}" min="0" max="360" value="${node.params.hueRotate || 0}">
        </div>
        <div class="bp-param-block">
          <div class="bp-param-header">
            <span class="bp-param-label">饱和度</span>
            <span class="bp-param-val" id="val_sat_${node.id}">${node.params.saturation !== undefined ? node.params.saturation : 100}%</span>
          </div>
          <input type="range" class="bp-param-slider" id="slider_sat_${node.id}" min="0" max="200" value="${node.params.saturation !== undefined ? node.params.saturation : 100}">
        </div>
        <div class="bp-param-block">
          <div class="bp-param-header">
            <span class="bp-param-label">亮度微调</span>
            <span class="bp-param-val" id="val_bri_${node.id}">${node.params.brightness || 0}%</span>
          </div>
          <input type="range" class="bp-param-slider" id="slider_bri_${node.id}" min="-100" max="100" value="${node.params.brightness || 0}">
        </div>
        <div class="bp-param-block">
          <div class="bp-param-header">
            <span class="bp-param-label">对比度</span>
            <span class="bp-param-val" id="val_con_${node.id}">${node.params.contrast || 0}%</span>
          </div>
          <input type="range" class="bp-param-slider" id="slider_con_${node.id}" min="-100" max="100" value="${node.params.contrast || 0}">
        </div>
      `;

      box.querySelectorAll('[data-filt]').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const filt = btn.dataset.filt;
          box.querySelectorAll('[data-filt]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.model.updateNodeParams(node.id, { filter: filt });
        };
      });

      setTimeout(() => {
        const sHue = box.querySelector(`#slider_hue_${node.id}`);
        const sSat = box.querySelector(`#slider_sat_${node.id}`);
        const sBri = box.querySelector(`#slider_bri_${node.id}`);
        const sCon = box.querySelector(`#slider_con_${node.id}`);

        if (sHue) sHue.oninput = (e) => {
          const v = parseInt(e.target.value, 10);
          box.querySelector(`#val_hue_${node.id}`).innerHTML = `${v}&deg;`;
          this.model.updateNodeParams(node.id, { hueRotate: v });
        };
        if (sSat) sSat.oninput = (e) => {
          const v = parseInt(e.target.value, 10);
          box.querySelector(`#val_sat_${node.id}`).textContent = `${v}%`;
          this.model.updateNodeParams(node.id, { saturation: v });
        };
        if (sBri) sBri.oninput = (e) => {
          const v = parseInt(e.target.value, 10);
          box.querySelector(`#val_bri_${node.id}`).textContent = `${v}%`;
          this.model.updateNodeParams(node.id, { brightness: v });
        };
        if (sCon) sCon.oninput = (e) => {
          const v = parseInt(e.target.value, 10);
          box.querySelector(`#val_con_${node.id}`).textContent = `${v}%`;
          this.model.updateNodeParams(node.id, { contrast: v });
        };
      }, 0);

      return box;
    }

    if (node.type === 'speed_adjust') {
      const curSpeed = parseFloat(node.params.speed) || 1.5;
      box.innerHTML = `
        <div class="bp-segmented-tabs" id="tabs_speed_${node.id}">
          <button class="bp-tab-btn ${curSpeed === 0.5 ? 'active' : ''}" data-spd="0.5">0.5x</button>
          <button class="bp-tab-btn ${curSpeed === 1.0 ? 'active' : ''}" data-spd="1.0">1.0x</button>
          <button class="bp-tab-btn ${curSpeed === 1.5 ? 'active' : ''}" data-spd="1.5">1.5x</button>
          <button class="bp-tab-btn ${curSpeed === 2.0 ? 'active' : ''}" data-spd="2.0">2.0x</button>
          <button class="bp-tab-btn ${curSpeed === 3.0 ? 'active' : ''}" data-spd="3.0">3.0x</button>
        </div>
        <div class="bp-param-block" style="margin-top:6px;">
          <div class="bp-param-header">
            <span class="bp-param-label">自定义倍速</span>
            <span class="bp-param-val" id="val_speed_${node.id}">${curSpeed.toFixed(2)}x</span>
          </div>
          <input type="range" class="bp-param-slider" id="slider_speed_${node.id}" min="0.25" max="4.0" step="0.05" value="${curSpeed}">
        </div>
      `;

      box.querySelectorAll('[data-spd]').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const spd = parseFloat(btn.dataset.spd);
          box.querySelectorAll('[data-spd]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const slider = box.querySelector(`#slider_speed_${node.id}`);
          if (slider) slider.value = spd;
          const valBadge = box.querySelector(`#val_speed_${node.id}`);
          if (valBadge) valBadge.textContent = `${spd.toFixed(2)}x`;
          this.model.updateNodeParams(node.id, { speed: spd });
        };
      });

      setTimeout(() => {
        const slider = box.querySelector(`#slider_speed_${node.id}`);
        if (slider) {
          slider.oninput = (e) => {
            const v = parseFloat(e.target.value);
            box.querySelector(`#val_speed_${node.id}`).textContent = `${v.toFixed(2)}x`;
            box.querySelectorAll('[data-spd]').forEach(b => {
              if (Math.abs(parseFloat(b.dataset.spd) - v) < 0.01) {
                b.classList.add('active');
              } else {
                b.classList.remove('active');
              }
            });
            this.model.updateNodeParams(node.id, { speed: v });
          };
        }
      }, 0);

      return box;
    }

    if (node.type === 'frame_interval') {
      const s = node.params.startPercent !== undefined ? node.params.startPercent : 0;
      const e = node.params.endPercent !== undefined ? node.params.endPercent : 100;
      box.innerHTML = `
        <div class="bp-param-block">
          <div class="bp-param-header">
            <span class="bp-param-label">相对区间</span>
            <span class="bp-param-val" id="val_interval_${node.id}">${s}% ~ ${e}%</span>
          </div>
          <div class="bp-dual-range-container" id="range_wrap_${node.id}">
            <div class="bp-dual-range-track"></div>
            <div class="bp-dual-range-highlight" id="highlight_${node.id}" title="拖动平移区间"></div>
            <div class="bp-dual-range-handle handle-start" id="handle_min_${node.id}" tabindex="0" role="slider" aria-label="区间起始" aria-valuemin="0" aria-valuemax="${e}" aria-valuenow="${s}" title="起始: ${s}%"></div>
            <div class="bp-dual-range-handle handle-end" id="handle_max_${node.id}" tabindex="0" role="slider" aria-label="区间结束" aria-valuemin="${s}" aria-valuemax="100" aria-valuenow="${e}" title="结束: ${e}%"></div>
          </div>
          <div class="bp-segmented-tabs" style="margin-top:6px;">
            <button class="bp-tab-btn" data-preset="0-50">前 50%</button>
            <button class="bp-tab-btn" data-preset="50-100">后 50%</button>
            <button class="bp-tab-btn" data-preset="25-75">中 50%</button>
            <button class="bp-tab-btn" data-preset="0-100">全段</button>
          </div>
        </div>
      `;

      setTimeout(() => {
        const wrap = box.querySelector(`#range_wrap_${node.id}`);
        const handleMin = box.querySelector(`#handle_min_${node.id}`);
        const handleMax = box.querySelector(`#handle_max_${node.id}`);
        const highlight = box.querySelector(`#highlight_${node.id}`);
        const valLabel = box.querySelector(`#val_interval_${node.id}`);

        if (!wrap || !handleMin || !handleMax || !highlight) return;

        let curS = node.params.startPercent !== undefined ? node.params.startPercent : 0;
        let curE = node.params.endPercent !== undefined ? node.params.endPercent : 100;

        const updateVisuals = (sVal, eVal, commit = false) => {
          curS = Math.max(0, Math.min(100, Math.round(sVal)));
          curE = Math.max(0, Math.min(100, Math.round(eVal)));
          if (curS > curE) curS = curE;

          const sPct = curS / 100;
          const ePct = curE / 100;

          handleMin.style.left = `calc(8px + (100% - 16px) * ${sPct})`;
          handleMax.style.left = `calc(8px + (100% - 16px) * ${ePct})`;
          highlight.style.left = `calc(8px + (100% - 16px) * ${sPct})`;
          highlight.style.width = `calc((100% - 16px) * ${ePct - sPct})`;

          handleMin.setAttribute('aria-valuenow', curS);
          handleMin.setAttribute('aria-valuemax', curE);
          handleMin.title = `起始: ${curS}%`;

          handleMax.setAttribute('aria-valuenow', curE);
          handleMax.setAttribute('aria-valuemin', curS);
          handleMax.title = `结束: ${curE}%`;

          if (valLabel) {
            valLabel.textContent = `${curS}% ~ ${curE}%`;
          }

          if (commit) {
            this.model.updateNodeParams(node.id, { startPercent: curS, endPercent: curE });
          }
        };

        // Initial paint
        updateVisuals(curS, curE, false);

        const getPctFromX = (clientX) => {
          const rect = wrap.getBoundingClientRect();
          const usable = rect.width - 16;
          if (usable <= 0) return 0;
          const x = clientX - rect.left - 8;
          return Math.max(0, Math.min(100, Math.round((x / usable) * 100)));
        };

        let dragging = null; // 'min' | 'max' | 'pan'
        let panStartX = 0;
        let panInitialS = 0;
        let panInitialE = 0;

        wrap.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          wrap.setPointerCapture(e.pointerId);

          if (e.target === handleMin) {
            dragging = 'min';
            handleMin.classList.add('dragging');
          } else if (e.target === handleMax) {
            dragging = 'max';
            handleMax.classList.add('dragging');
          } else if (e.target === highlight) {
            dragging = 'pan';
            panStartX = e.clientX;
            panInitialS = curS;
            panInitialE = curE;
            highlight.classList.add('dragging');
          } else {
            // Clicked track background: snap nearest handle
            const clickedPct = getPctFromX(e.clientX);
            const distMin = Math.abs(clickedPct - curS);
            const distMax = Math.abs(clickedPct - curE);
            if (distMin <= distMax) {
              dragging = 'min';
              handleMin.classList.add('dragging');
              updateVisuals(clickedPct, curE, true);
            } else {
              dragging = 'max';
              handleMax.classList.add('dragging');
              updateVisuals(curS, clickedPct, true);
            }
          }
        });

        wrap.addEventListener('pointermove', (e) => {
          if (!dragging) return;
          e.stopPropagation();

          if (dragging === 'min') {
            const pct = getPctFromX(e.clientX);
            const newS = Math.min(pct, curE);
            updateVisuals(newS, curE, false);
          } else if (dragging === 'max') {
            const pct = getPctFromX(e.clientX);
            const newE = Math.max(pct, curS);
            updateVisuals(curS, newE, false);
          } else if (dragging === 'pan') {
            const rect = wrap.getBoundingClientRect();
            const usable = rect.width - 16;
            if (usable > 0) {
              const deltaPct = Math.round(((e.clientX - panStartX) / usable) * 100);
              const span = panInitialE - panInitialS;
              let newS = Math.max(0, Math.min(100 - span, panInitialS + deltaPct));
              let newE = newS + span;
              updateVisuals(newS, newE, false);
            }
          }
        });

        const stopDrag = (e) => {
          if (!dragging) return;
          try { wrap.releasePointerCapture(e.pointerId); } catch (_) {}
          handleMin.classList.remove('dragging');
          handleMax.classList.remove('dragging');
          highlight.classList.remove('dragging');
          dragging = null;
          updateVisuals(curS, curE, true);
        };

        wrap.addEventListener('pointerup', stopDrag);
        wrap.addEventListener('pointercancel', stopDrag);

        const handleKey = (e, isMin) => {
          let step = 0;
          const delta = e.shiftKey ? 5 : 1;
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') step = -delta;
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') step = delta;
          if (step !== 0) {
            e.preventDefault();
            e.stopPropagation();
            if (isMin) {
              const newS = Math.max(0, Math.min(curE, curS + step));
              updateVisuals(newS, curE, true);
            } else {
              const newE = Math.min(100, Math.max(curS, curE + step));
              updateVisuals(curS, newE, true);
            }
          }
        };

        handleMin.addEventListener('keydown', (e) => handleKey(e, true));
        handleMax.addEventListener('keydown', (e) => handleKey(e, false));

        box.querySelectorAll('.bp-tab-btn[data-preset]').forEach(btn => {
          btn.onclick = (e) => {
            e.stopPropagation();
            const [pS, pE] = btn.dataset.preset.split('-').map(Number);
            updateVisuals(pS, pE, true);
          };
        });
      }, 0);

      return box;
    }

    if (node.type === 'frame_constraint') {
      box.innerHTML = `
        <div class="bp-param-row">
          <span class="bp-param-label">最大帧数限制:</span>
          <select class="bp-param-input" style="width:116px;" id="sel_max_${node.id}">
            <option value="0" ${node.params.maxFrames === 0 ? 'selected' : ''}>不限制</option>
            <option value="16" ${node.params.maxFrames === 16 ? 'selected' : ''}>16 帧 (超轻量)</option>
            <option value="24" ${node.params.maxFrames === 24 ? 'selected' : ''}>24 帧 (标准)</option>
            <option value="32" ${node.params.maxFrames === 32 ? 'selected' : ''}>32 帧 (高清)</option>
          </select>
        </div>
        <div class="bp-param-row">
          <span class="bp-param-label">抽帧跳步 (Step):</span>
          <select class="bp-param-input" style="width:116px;" id="sel_step_${node.id}">
            <option value="1" ${node.params.step === 1 ? 'selected' : ''}>1 (保留所有帧)</option>
            <option value="2" ${node.params.step === 2 ? 'selected' : ''}>2 (隔一取一)</option>
            <option value="3" ${node.params.step === 3 ? 'selected' : ''}>3 (隔二取一)</option>
          </select>
        </div>
      `;

      setTimeout(() => {
        const sMax = box.querySelector(`#sel_max_${node.id}`);
        const sStep = box.querySelector(`#sel_step_${node.id}`);
        if (sMax) sMax.onchange = (e) => this.model.updateNodeParams(node.id, { maxFrames: parseInt(e.target.value, 10) });
        if (sStep) sStep.onchange = (e) => this.model.updateNodeParams(node.id, { step: parseInt(e.target.value, 10) });
      }, 0);
      return box;
    }

    if (node.type === 'warp_bulge' || node.type === 'warp_pinch') {
      box.innerHTML = `
        <div class="bp-param-block">
          <div class="bp-param-header">
            <span class="bp-param-label">变形强度</span>
            <span class="bp-param-val">${node.params.strength}%</span>
          </div>
          <input type="range" class="bp-param-slider" min="10" max="100" value="${node.params.strength}">
        </div>
      `;
      const slider = box.querySelector('input');
      const valSpan = box.querySelector('.bp-param-val');
      slider.oninput = (e) => {
        valSpan.textContent = `${e.target.value}%`;
        this.model.updateNodeParams(node.id, { strength: parseInt(e.target.value, 10) });
      };
      return box;
    }

    if (node.type === 'meme_caption') {
      box.innerHTML = `
        <div style="margin-bottom:6px;">
          <input type="text" class="bp-param-input" placeholder="输入底部字幕文字" value="${node.params.bottomText || ''}">
        </div>
      `;
      const input = box.querySelector('input');
      input.oninput = (e) => {
        this.model.updateNodeParams(node.id, { bottomText: e.target.value });
      };
      return box;
    }

    if (node.type === 'merge_face') {
      box.innerHTML = `
        <div class="bp-param-block">
          <div class="bp-param-header">
            <span class="bp-param-label">左右分割比例</span>
            <span class="bp-param-val">${Math.round((node.params.splitRatio || 0.5) * 100)}%</span>
          </div>
          <input type="range" class="bp-param-slider" min="20" max="80" value="${Math.round((node.params.splitRatio || 0.5) * 100)}">
        </div>
      `;
      const slider = box.querySelector('input');
      const valSpan = box.querySelector('.bp-param-val');
      slider.oninput = (e) => {
        const r = parseInt(e.target.value, 10) / 100;
        valSpan.textContent = `${e.target.value}%`;
        this.model.updateNodeParams(node.id, { splitRatio: r });
      };
      return box;
    }

    if (node.type === 'output_export') {
      const preview = document.createElement('div');
      preview.className = 'bp-output-preview';
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 120;
      canvas.id = `preview_canvas_${node.id}`;
      preview.appendChild(canvas);
      box.appendChild(preview);

      const note = document.createElement('div');
      note.style.fontSize = '10px';
      note.style.color = '#8b95a5';
      note.style.textAlign = 'center';
      note.textContent = '连接至此节点即可实时预览';
      box.appendChild(note);
      return box;
    }

    return null;
  }

  renderWires() {
    // Clear old wires except drawingWirePath
    const existing = this.svg.querySelectorAll('.blueprint-wire');
    existing.forEach(w => w.remove());

    const containerRect = this.container.getBoundingClientRect();

    this.model.connections.forEach(conn => {
      // Find output pin
      const fromPinCircle = this.nodesLayer.querySelector(
        `[data-node-id="${conn.fromNode}"][data-pin-id="${conn.fromPin}"][data-pin-type="output"]`
      );
      // Find input pin
      const toPinCircle = this.nodesLayer.querySelector(
        `[data-node-id="${conn.toNode}"][data-pin-id="${conn.toPin}"][data-pin-type="input"]`
      );

      if (!fromPinCircle || !toPinCircle) return;

      const r1 = fromPinCircle.getBoundingClientRect();
      const r2 = toPinCircle.getBoundingClientRect();

      const x1 = (r1.left + r1.width / 2 - containerRect.left - this.pan.x) / this.zoom;
      const y1 = (r1.top + r1.height / 2 - containerRect.top - this.pan.y) / this.zoom;
      const x2 = (r2.left + r2.width / 2 - containerRect.left - this.pan.x) / this.zoom;
      const y2 = (r2.top + r2.height / 2 - containerRect.top - this.pan.y) / this.zoom;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'blueprint-wire');
      path.setAttribute('d', this.calculateBezierPath(x1, y1, x2, y2));
      path.dataset.connId = conn.id;

      // Click to delete connection
      path.onclick = (e) => {
        e.stopPropagation();
        this.model.disconnect(conn.id);
      };

      this.svg.appendChild(path);
    });
  }

  zoomToFit() {
    if (this.model.nodes.size === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.model.nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + 280);
      maxY = Math.max(maxY, n.y + 200);
    });

    const cw = this.container.clientWidth;
    const ch = this.container.clientHeight;
    const padding = 80;

    const scaleX = (cw - padding * 2) / (maxX - minX);
    const scaleY = (ch - padding * 2) / (maxY - minY);
    this.zoom = Math.max(0.4, Math.min(1.2, Math.min(scaleX, scaleY)));

    this.pan.x = (cw - (maxX - minX) * this.zoom) / 2 - minX * this.zoom;
    this.pan.y = (ch - (maxY - minY) * this.zoom) / 2 - minY * this.zoom;
    this.updateTransform();
    this.renderWires();
  }
}

window.BlueprintCanvas = BlueprintCanvas;
