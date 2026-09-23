/**
 * QQ Face Studio - Main Application Controller
 * Manages Blueprint Canvas, Live Result Player, Emoji Library Drawer,
 * Clipboard Operations, and Pipeline JSON Export/Import.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const blueprintContainer = document.getElementById('blueprintContainer');
  const previewCanvas = document.getElementById('previewCanvas');
  const btnPlayPause = document.getElementById('btnPlayPause');
  const btnStepPrev = document.getElementById('btnStepPrev');
  const btnStepNext = document.getElementById('btnStepNext');
  const selectPlaySpeed = document.getElementById('selectPlaySpeed');
  const lblPreviewSize = document.getElementById('lblPreviewSize');
  const lblPreviewFrames = document.getElementById('lblPreviewFrames');
  const lblPreviewDuration = document.getElementById('lblPreviewDuration');
  const lblEvalStatus = document.getElementById('lblEvalStatus');

  // Floating toolbar
  const btnBarAddNode = document.getElementById('btnBarAddNode');
  const btnBarFitView = document.getElementById('btnBarFitView');
  const btnBarReEval = document.getElementById('btnBarReEval');
  const btnBarClear = document.getElementById('btnBarClear');

  // Header buttons
  const btnOpenEmojiDrawer = document.getElementById('btnOpenEmojiDrawer');
  const btnOpenNodePalette = document.getElementById('btnOpenNodePalette');
  const btnExportTop = document.getElementById('btnExportTop');
  const btnDoExport = document.getElementById('btnDoExport');
  const btnHeaderExportJson = document.getElementById('btnHeaderExportJson');
  const fileInputJson = document.getElementById('fileInputJson');

  // Clipboard & JSON buttons
  const btnCopyCurrentFrame = document.getElementById('btnCopyCurrentFrame');
  const btnDownloadJson = document.getElementById('btnDownloadJson');
  const btnCopyJson = document.getElementById('btnCopyJson');

  // Presets
  const btnPresetMirror = document.getElementById('btnPresetMirror');
  const btnPresetMerge = document.getElementById('btnPresetMerge');
  const btnPresetBulge = document.getElementById('btnPresetBulge');
  const btnPresetBoomerang = document.getElementById('btnPresetBoomerang');

  // Emoji Drawer
  const emojiDrawer = document.getElementById('emojiDrawer');
  const btnCloseEmojiDrawer = document.getElementById('btnCloseEmojiDrawer');
  const inputEmojiSearch = document.getElementById('inputEmojiSearch');
  const drawerEmojiGrid = document.getElementById('drawerEmojiGrid');

  // Node Palette Modal
  const nodePaletteModal = document.getElementById('nodePaletteModal');
  const btnCloseNodePalette = document.getElementById('btnCloseNodePalette');
  const paletteCategoryList = document.getElementById('paletteCategoryList');

  // Export Modal
  const exportModal = document.getElementById('exportModal');
  const btnCloseExportModal = document.getElementById('btnCloseExportModal');
  const selectExportSize = document.getElementById('selectExportSize');
  const selectExportColors = document.getElementById('selectExportColors');
  const checkExportAlpha = document.getElementById('checkExportAlpha');
  const exportProgressBar = document.getElementById('exportProgressBar');
  const lblExportProgress = document.getElementById('lblExportProgress');
  const exportProgressArea = document.getElementById('exportProgressArea');
  const exportResultArea = document.getElementById('exportResultArea');
  const imgExportPreview = document.getElementById('imgExportPreview');
  const lblExportFileSize = document.getElementById('lblExportFileSize');
  const lblWeChatStatus = document.getElementById('lblWeChatStatus');
  const btnDownloadLink = document.getElementById('btnDownloadLink');
  const btnModalCopyImage = document.getElementById('btnModalCopyImage');
  const btnModalCopyJson = document.getElementById('btnModalCopyJson');

  if (imgExportPreview) {
    imgExportPreview.draggable = true;
    imgExportPreview.addEventListener('dragstart', (e) => {
      const url = btnDownloadLink.href || imgExportPreview.src;
      const filename = btnDownloadLink.download || `qq_gif_${Date.now()}.gif`;
      if (url) {
        e.dataTransfer.setData('DownloadURL', `image/gif:${filename}:${url}`);
        e.dataTransfer.setData('text/uri-list', url);
        e.dataTransfer.effectAllowed = 'copy';
      }
    });
  }

  // Custom Confirm Clear Modal
  const confirmClearModal = document.getElementById('confirmClearModal');
  const btnCloseConfirmModal = document.getElementById('btnCloseConfirmModal');
  const btnCancelClear = document.getElementById('btnCancelClear');
  const btnConfirmClear = document.getElementById('btnConfirmClear');

  // Toast
  const toastNotification = document.getElementById('toastNotification');
  let toastTimer = null;

  function showToast(message) {
    if (!toastNotification) return;
    toastNotification.textContent = message;
    toastNotification.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastNotification.classList.remove('show');
    }, 2400);
  }
  window.showToast = showToast;

  // --- Initialize Core Services ---
  await window.QQEmojiService.init();

  const graphModel = new window.GraphModel();
  window.graphModel = graphModel;

  let targetEmojiNode = null; // If selecting emoji for a specific node

  const blueprintCanvas = new window.BlueprintCanvas(blueprintContainer, graphModel, {
    onSelectEmojiForNode: (node) => {
      targetEmojiNode = node;
      openEmojiDrawer();
    }
  });
  window.blueprintCanvas = blueprintCanvas;

  // --- Live Animated Player State ---
  let evaluatedFrames = [];
  let currentPlayIndex = 0;
  let isPlaying = true;
  let playTimer = null;
  let playSpeed = 1.0;
  let lastExportedBlob = null;

  function updateLivePlayer(frames) {
    evaluatedFrames = frames || [];
    currentPlayIndex = 0;
    lastExportedBlob = null; // Invalidate cached exported GIF on graph update

    if (evaluatedFrames.length === 0) {
      if (playTimer) clearTimeout(playTimer);
      lblPreviewSize.textContent = '-';
      lblPreviewFrames.textContent = '0 frames';
      lblPreviewDuration.textContent = '0 ms';

      previewCanvas.width = 128;
      previewCanvas.height = 128;
      const ctx = previewCanvas.getContext('2d');
      ctx.clearRect(0, 0, 128, 128);
      ctx.fillStyle = '#0f1117';
      ctx.fillRect(0, 0, 128, 128);
      return;
    }

    const fw = evaluatedFrames[0].canvas.width;
    const fh = evaluatedFrames[0].canvas.height;
    previewCanvas.width = fw;
    previewCanvas.height = fh;

    const totalDuration = evaluatedFrames.reduce((sum, f) => sum + (f.delay || 60), 0);
    lblPreviewSize.textContent = `${fw} x ${fh}`;
    lblPreviewFrames.textContent = `${evaluatedFrames.length} frames`;
    lblPreviewDuration.textContent = `${totalDuration} ms`;

    renderCurrentFrame();
    restartPlayLoop();
  }

  function renderCurrentFrame() {
    if (evaluatedFrames.length === 0) return;
    const frame = evaluatedFrames[currentPlayIndex];
    if (!frame) return;

    const ctx = previewCanvas.getContext('2d');
    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    ctx.drawImage(frame.canvas, 0, 0);

    // Also update mini preview in any output_export node
    graphModel.nodes.forEach(n => {
      if (n.type === 'output_export') {
        const mini = document.getElementById(`preview_canvas_${n.id}`);
        if (mini) {
          mini.width = frame.canvas.width;
          mini.height = frame.canvas.height;
          const mctx = mini.getContext('2d');
          mctx.clearRect(0, 0, mini.width, mini.height);
          mctx.drawImage(frame.canvas, 0, 0);
        }
      }
    });
  }

  function restartPlayLoop() {
    if (playTimer) clearTimeout(playTimer);
    if (!isPlaying || evaluatedFrames.length <= 1) return;

    const frame = evaluatedFrames[currentPlayIndex];
    const delay = Math.max(16, (frame ? frame.delay : 80) / playSpeed);

    playTimer = setTimeout(() => {
      if (!isPlaying || evaluatedFrames.length === 0) return;
      currentPlayIndex = (currentPlayIndex + 1) % evaluatedFrames.length;
      renderCurrentFrame();
      restartPlayLoop();
    }, delay);
  }

  // Hook model evaluation
  graphModel.onGraphExecuted = (finalFrames) => {
    updateLivePlayer(finalFrames);
  };

  // --- Player UI Controls ---

  const svgPauseIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
  const svgPlayIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;

  btnPlayPause.addEventListener('click', () => {
    isPlaying = !isPlaying;
    btnPlayPause.innerHTML = isPlaying ? svgPauseIcon : svgPlayIcon;
    btnPlayPause.title = isPlaying ? '暂停播放' : '继续播放';
    if (isPlaying) {
      restartPlayLoop();
    } else if (playTimer) {
      clearTimeout(playTimer);
    }
  });

  btnStepPrev.addEventListener('click', () => {
    if (evaluatedFrames.length === 0) return;
    isPlaying = false;
    btnPlayPause.innerHTML = svgPlayIcon;
    btnPlayPause.title = '继续播放';
    if (playTimer) clearTimeout(playTimer);
    currentPlayIndex = (currentPlayIndex - 1 + evaluatedFrames.length) % evaluatedFrames.length;
    renderCurrentFrame();
  });

  btnStepNext.addEventListener('click', () => {
    if (evaluatedFrames.length === 0) return;
    isPlaying = false;
    btnPlayPause.innerHTML = svgPlayIcon;
    btnPlayPause.title = '继续播放';
    if (playTimer) clearTimeout(playTimer);
    currentPlayIndex = (currentPlayIndex + 1) % evaluatedFrames.length;
    renderCurrentFrame();
  });

  if (selectPlaySpeed) {
    selectPlaySpeed.addEventListener('change', (e) => {
      playSpeed = parseFloat(e.target.value) || 1.0;
      restartPlayLoop();
    });
  }

  // --- Clipboard Copy Animated GIF Operations ---

  async function copyAnimatedGifToClipboard() {
    if (evaluatedFrames.length === 0) {
      showToast('未连接终点输出节点，无可用动图');
      return;
    }

    showToast('正在生成动图并写入剪贴板...');

    try {
      let gifBlob = lastExportedBlob;
      if (!gifBlob) {
        const preset = selectExportSize ? selectExportSize.value : 'original';
        let targetW = evaluatedFrames[0].canvas.width;
        let targetH = evaluatedFrames[0].canvas.height;
        if (preset === '240x240') { targetW = 240; targetH = 240; }
        else if (preset === '300x300') { targetW = 300; targetH = 300; }

        const colors = (selectExportColors && parseInt(selectExportColors.value, 10)) || 128;
        const preserveAlpha = checkExportAlpha ? checkExportAlpha.checked : true;

        const encodeResult = await window.GifEncoder.encode(evaluatedFrames, {
          width: targetW,
          height: targetH,
          maxColors: colors,
          preserveTransparency: preserveAlpha
        });
        gifBlob = encodeResult.blob;
        lastExportedBlob = gifBlob;
      }

      // Generate first frame PNG blob as a static fallback
      const curFrame = evaluatedFrames[currentPlayIndex] || evaluatedFrames[0];
      const pngBlob = await new Promise(resolve => curFrame.canvas.toBlob(resolve, 'image/png'));

      // Convert GIF blob to Base64 Data URL for HTML clipboard insertion
      const base64DataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(gifBlob);
      });

      const htmlContent = `<img src="${base64DataUrl}" alt="QQ GIF" />`;
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });

      let copied = false;

      // 1. Try modern Async Clipboard API
      // Note: Never include 'image/png' fallback here, because Windows clipboard generates CF_DIB
      // from PNG which strips alpha channel to black and makes QQ/WeChat paste a static image!
      if (navigator.clipboard && navigator.clipboard.write) {
        const supportsGif = typeof ClipboardItem !== 'undefined' &&
                            typeof ClipboardItem.supports === 'function' &&
                            ClipboardItem.supports('image/gif');

        if (supportsGif) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({
                'image/gif': gifBlob,
                'text/html': htmlBlob
              })
            ]);
            copied = true;
          } catch (eGif) {
            console.warn('Native image/gif write failed:', eGif);
          }
        }

        if (!copied) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({
                'text/html': htmlBlob
              })
            ]);
            copied = true;
          } catch (eHtml) {
            console.warn('text/html write failed:', eHtml);
          }
        }
      }

      // 2. Fallback via document.execCommand('copy') with rich HTML
      if (!copied) {
        try {
          const container = document.createElement('div');
          container.contentEditable = 'true';
          container.style.position = 'fixed';
          container.style.left = '-9999px';
          container.style.top = '-9999px';
          container.style.opacity = '0';
          const img = document.createElement('img');
          img.src = base64DataUrl;
          container.appendChild(img);
          document.body.appendChild(container);

          const range = document.createRange();
          range.selectNode(container);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          const execSuccess = document.execCommand('copy');
          document.body.removeChild(container);
          sel.removeAllRanges();

          if (execSuccess) copied = true;
        } catch (eExec) {
          console.warn('execCommand copy failed:', eExec);
        }
      }

      if (copied) {
        showToast('动图已写入剪贴板。若聊天软件粘贴受限，可直接按住动图【拖拽】进窗口发送');
      } else {
        showToast('剪贴板写入受限，请直接点击“下载 GIF 文件”或按住动图拖拽发送');
      }
    } catch (err) {
      console.error('复制动图出错:', err);
      showToast('复制动图失败: ' + err.message);
    }
  }

  if (btnCopyCurrentFrame) btnCopyCurrentFrame.addEventListener('click', copyAnimatedGifToClipboard);
  if (btnModalCopyImage) btnModalCopyImage.addEventListener('click', copyAnimatedGifToClipboard);

  // --- Pipeline JSON Export & Import ---

  function exportPipelineJSON() {
    const jsonObj = graphModel.toJSON();
    const jsonStr = JSON.stringify(jsonObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qq_gif_editor_pipeline_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('操作序列 JSON 文件已下载');
  }

  async function copyPipelineJSON() {
    const jsonObj = graphModel.toJSON();
    const jsonStr = JSON.stringify(jsonObj, null, 2);

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(jsonStr);
      } else {
        const ta = document.createElement('textarea');
        ta.value = jsonStr;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      showToast('操作序列 JSON 已复制到剪贴板');
    } catch (err) {
      console.warn('复制文本失败:', err);
      showToast('复制失败');
    }
  }

  if (btnHeaderExportJson) btnHeaderExportJson.addEventListener('click', exportPipelineJSON);
  if (btnDownloadJson) btnDownloadJson.addEventListener('click', exportPipelineJSON);
  if (btnCopyJson) btnCopyJson.addEventListener('click', copyPipelineJSON);
  if (btnModalCopyJson) btnModalCopyJson.addEventListener('click', copyPipelineJSON);

  // Import JSON file
  fileInputJson.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        graphModel.fromJSON(data);
        blueprintCanvas.render();
        setTimeout(() => blueprintCanvas.zoomToFit(), 100);
        showToast('已成功导入操作序列 JSON');
      } catch (err) {
        alert('无法解析 JSON 文件: ' + err.message);
      }
    };
    reader.readAsText(file);
    fileInputJson.value = '';
  });

  // --- Presets (预设方案) ---

  btnPresetMirror.addEventListener('click', () => {
    graphModel.nodes.clear();
    graphModel.connections = [];

    const inNode = graphModel.addNode('input_emoji', 80, 140, { emojiId: '110' });
    const mirrorNode = graphModel.addNode('symmetry_dual', 400, 140, { keep: 'left' });
    const outNode = graphModel.addNode('output_export', 720, 140);

    graphModel.connect(inNode.id, 'out_frames', mirrorNode.id, 'in_frames');
    graphModel.connect(mirrorNode.id, 'out_frames', outNode.id, 'in_frames');
    setTimeout(() => blueprintCanvas.zoomToFit(), 100);
  });

  btnPresetMerge.addEventListener('click', () => {
    graphModel.nodes.clear();
    graphModel.connections = [];

    const inA = graphModel.addNode('input_emoji', 80, 80, { emojiId: '14' });
    const inB = graphModel.addNode('input_emoji', 80, 260, { emojiId: '11' });
    const mergeNode = graphModel.addNode('merge_face', 400, 160, { splitRatio: 0.5 });
    const outNode = graphModel.addNode('output_export', 740, 160);

    graphModel.connect(inA.id, 'out_frames', mergeNode.id, 'left_frames');
    graphModel.connect(inB.id, 'out_frames', mergeNode.id, 'right_frames');
    graphModel.connect(mergeNode.id, 'out_frames', outNode.id, 'in_frames');
    setTimeout(() => blueprintCanvas.zoomToFit(), 100);
  });

  btnPresetBulge.addEventListener('click', () => {
    graphModel.nodes.clear();
    graphModel.connections = [];

    const inNode = graphModel.addNode('input_emoji', 80, 140, { emojiId: '182' });
    const warpNode = graphModel.addNode('warp_bulge', 380, 140, { strength: 65, radius: 60 });
    const frameNode = graphModel.addNode('frame_constraint', 680, 140, { maxFrames: 16 });
    const outNode = graphModel.addNode('output_export', 980, 140);

    graphModel.connect(inNode.id, 'out_frames', warpNode.id, 'in_frames');
    graphModel.connect(warpNode.id, 'out_frames', frameNode.id, 'in_frames');
    graphModel.connect(frameNode.id, 'out_frames', outNode.id, 'in_frames');
    setTimeout(() => blueprintCanvas.zoomToFit(), 100);
  });

  if (btnPresetBoomerang) {
    btnPresetBoomerang.addEventListener('click', () => {
      graphModel.nodes.clear();
      graphModel.connections = [];

      const inNode = graphModel.addNode('input_emoji', 80, 140, { emojiId: '277' });
      const boomNode = graphModel.addNode('boomerang', 400, 140);
      const outNode = graphModel.addNode('output_export', 720, 140);

      graphModel.connect(inNode.id, 'out_frames', boomNode.id, 'in_frames');
      graphModel.connect(boomNode.id, 'out_frames', outNode.id, 'in_frames');
      setTimeout(() => blueprintCanvas.zoomToFit(), 100);
    });
  }

  // --- Floating Toolbar Controls ---

  btnBarAddNode.addEventListener('click', () => openNodePalette());
  btnBarFitView.addEventListener('click', () => blueprintCanvas.zoomToFit());
  btnBarReEval.addEventListener('click', () => {
    graphModel.evaluate();
  });

  function openConfirmClearModal() {
    if (confirmClearModal) confirmClearModal.classList.add('show');
  }

  function closeConfirmClearModal() {
    if (confirmClearModal) confirmClearModal.classList.remove('show');
  }

  btnBarClear.addEventListener('click', () => {
    openConfirmClearModal();
  });

  if (btnCloseConfirmModal) btnCloseConfirmModal.addEventListener('click', closeConfirmClearModal);
  if (btnCancelClear) btnCancelClear.addEventListener('click', closeConfirmClearModal);
  if (confirmClearModal) {
    confirmClearModal.addEventListener('click', (e) => {
      if (e.target === confirmClearModal) closeConfirmClearModal();
    });
  }

  if (btnConfirmClear) {
    btnConfirmClear.addEventListener('click', () => {
      graphModel.nodes.clear();
      graphModel.connections = [];
      graphModel.notifyUpdate();
      updateLivePlayer([]);
      closeConfirmClearModal();
      showToast('画布已清空');
    });
  }

  // --- QQ Emoji Library Drawer ---

  function openEmojiDrawer() {
    emojiDrawer.classList.add('show');
    if (inputEmojiSearch) inputEmojiSearch.value = '';
    renderEmojiGrid(window.QQEmojiService.getCatalog());
  }

  function closeEmojiDrawer() {
    emojiDrawer.classList.remove('show');
    targetEmojiNode = null;
  }

  btnCloseEmojiDrawer.addEventListener('click', closeEmojiDrawer);
  if (btnOpenEmojiDrawer) {
    btnOpenEmojiDrawer.addEventListener('click', () => {
      targetEmojiNode = null;
      openEmojiDrawer();
    });
  }

  function renderEmojiGrid(list) {
    drawerEmojiGrid.innerHTML = '';
    list.forEach(item => {
      const el = document.createElement('div');
      el.className = 'drawer-emoji-item';

      const thumbUrl = window.QQEmojiService.getThumbnailUrl(item.id);
      el.innerHTML = `
        <img src="${thumbUrl}" alt="${item.name}" loading="lazy">
        <div class="drawer-emoji-name">${item.name}</div>
      `;

      el.onclick = () => {
        if (targetEmojiNode) {
          graphModel.updateNodeParams(targetEmojiNode.id, { emojiId: item.id });
          blueprintCanvas.renderNodes();
        } else {
          const center = blueprintCanvas.screenToCanvas(
            blueprintContainer.clientWidth / 2,
            blueprintContainer.clientHeight / 2
          );
          graphModel.addNode('input_emoji', center.x, center.y, { emojiId: item.id });
        }
        closeEmojiDrawer();
      };

      drawerEmojiGrid.appendChild(el);
    });
  }

  inputEmojiSearch.addEventListener('input', (e) => {
    const results = window.QQEmojiService.search(e.target.value);
    renderEmojiGrid(results);
  });

  // --- Node Palette Modal (添加节点菜单) ---

  function openNodePalette() {
    nodePaletteModal.classList.add('show');
    renderNodePalette();
  }

  function closeNodePalette() {
    nodePaletteModal.classList.remove('show');
  }

  if (btnOpenNodePalette) btnOpenNodePalette.addEventListener('click', openNodePalette);
  btnCloseNodePalette.addEventListener('click', closeNodePalette);

  function renderNodePalette() {
    paletteCategoryList.innerHTML = '';

    const categories = window.NODE_CATEGORIES;
    const defs = window.NODE_DEFINITIONS;

    Object.keys(categories).forEach(catKey => {
      const cat = categories[catKey];
      const items = Object.values(defs).filter(d => d.category === catKey && !d.isAlias);
      if (items.length === 0) return;

      const group = document.createElement('div');
      group.innerHTML = `
        <div class="palette-category-title" style="color:${cat.color};">
          ${cat.name}
        </div>
      `;

      const grid = document.createElement('div');
      grid.className = 'palette-items-grid';

      items.forEach(def => {
        const isOutput = def.type === 'output_export';
        const hasOutput = isOutput && Array.from(graphModel.nodes.values()).some(n => n.type === 'output_export');

        const card = document.createElement('div');
        card.className = 'palette-item-card';
        if (hasOutput) {
          card.classList.add('disabled');
          card.style.opacity = '0.45';
          card.style.cursor = 'not-allowed';
          card.title = '画布上已存在终点输出节点，仅允许放置一个';
        }
        card.style.borderLeft = `3px solid ${cat.color}`;
        card.innerHTML = `
          <div>
            <div class="palette-item-title">${def.title}${hasOutput ? ' <span style="font-size:10px; color:#94a3b8; font-weight:normal;">(已放置)</span>' : ''}</div>
            ${def.subtitle ? `<div class="palette-item-sub">${def.subtitle}</div>` : ''}
          </div>
        `;

        card.onclick = () => {
          if (hasOutput) {
            showToast('画布已存在终点输出节点，仅允许放置一个');
            return;
          }
          const center = blueprintCanvas.screenToCanvas(
            blueprintContainer.clientWidth / 2 + (Math.random() * 60 - 30),
            blueprintContainer.clientHeight / 2 + (Math.random() * 60 - 30)
          );
          const newNode = graphModel.addNode(def.type, center.x, center.y);
          if (newNode) closeNodePalette();
        };

        grid.appendChild(card);
      });

      group.appendChild(grid);
      paletteCategoryList.appendChild(group);
    });
  }

  // --- Export Modal & Generation ---

  function openExportModal() {
    if (evaluatedFrames.length === 0) {
      showToast('未连接终点输出节点，请先连接「终点输出」');
      return;
    }
    exportModal.classList.add('show');
    exportProgressArea.style.display = 'block';
    exportResultArea.style.display = 'none';
    exportProgressBar.style.width = '0%';
    lblExportProgress.textContent = '准备开始编码...';
    triggerExport();
  }

  if (btnExportTop) btnExportTop.addEventListener('click', openExportModal);
  btnDoExport.addEventListener('click', openExportModal);
  btnCloseExportModal.addEventListener('click', () => exportModal.classList.remove('show'));

  async function triggerExport() {
    const preset = selectExportSize.value;
    let targetW = evaluatedFrames[0].canvas.width;
    let targetH = evaluatedFrames[0].canvas.height;

    if (preset === '240x240') {
      targetW = 240; targetH = 240;
    } else if (preset === '300x300') {
      targetW = 300; targetH = 300;
    }

    const colors = parseInt(selectExportColors.value, 10) || 128;
    const preserveAlpha = checkExportAlpha.checked;

    try {
      const result = await window.GifEncoder.encode(evaluatedFrames, {
        width: targetW,
        height: targetH,
        maxColors: colors,
        preserveTransparency: preserveAlpha,
        onProgress: (current, total) => {
          const percent = Math.round((current / total) * 100);
          exportProgressBar.style.width = `${percent}%`;
          lblExportProgress.textContent = `生成中... (${current} / ${total} 帧, ${percent}%)`;
        }
      });

      lastExportedBlob = result.blob;

      exportProgressArea.style.display = 'none';
      exportResultArea.style.display = 'flex';

      imgExportPreview.src = result.url;
      lblExportFileSize.textContent = `${result.sizeKB} KB`;

      if (result.sizeKB > 1024) {
        lblWeChatStatus.textContent = '文件大于 1MB，建议减少调色板颜色或约束最大帧数';
        lblWeChatStatus.style.color = '#d97706';
      } else {
        lblWeChatStatus.textContent = '符合表情标准 (< 1MB)';
        lblWeChatStatus.style.color = '#10b981';
      }

      btnDownloadLink.href = result.url;
      btnDownloadLink.download = `qq_gif_editor_${Date.now()}.gif`;
    } catch (err) {
      alert('导出 GIF 出错: ' + err.message);
      exportModal.classList.remove('show');
    }
  }

  // --- Keyboard Shortcuts ---
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.code === 'Space') {
      e.preventDefault();
      btnPlayPause.click();
    } else if (e.code === 'ArrowRight') {
      btnStepNext.click();
    } else if (e.code === 'ArrowLeft') {
      btnStepPrev.click();
    } else if (e.code === 'Escape') {
      closeEmojiDrawer();
      closeNodePalette();
      closeConfirmClearModal();
      exportModal.classList.remove('show');
    }
  });

  // --- Initial Default State: Load Preset 1 ---
  btnPresetMirror.click();
});
