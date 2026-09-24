/**
 * Blueprint Node Definitions
 * Clean, professional schemas without emoji characters or neon styling.
 */

const NODE_CATEGORIES = {
  INPUT: { name: '输入源 (Input)', color: '#10b981' },         // 翠绿 Emerald Green
  SYMMETRY: { name: '镜像对称 (Symmetry)', color: '#0ea5e9' }, // 青蓝 Cyan Sky
  COMPOSITION: { name: '拼接融合 (Composition)', color: '#3b82f6' }, // 经典蓝 Royal Blue
  COLOR: { name: '色彩滤镜 (Color & Filter)', color: '#d946ef' }, // 洋红/紫红 Fuchsia
  FRAME: { name: '帧数约束 (Frame Control)', color: '#f59e0b' }, // 琥珀黄 Amber
  WARP: { name: '扭曲变形 (Warp)', color: '#ea580c' },        // 橙红 Vermilion Orange
  MEME: { name: '文本字幕 (Text & FX)', color: '#64748b' },   // 冷石板灰 Slate Grey
  OUTPUT: { name: '终点输出 (Output)', color: '#e11d48' }     // 绯红 Crimson Red
};

const NODE_DEFINITIONS = {
  // --- 1. 输入类 ---
  'input_emoji': {
    type: 'input_emoji',
    title: 'QQ 表情输入',
    subtitle: 'QQ Face Input',
    category: 'INPUT',
    inputs: [],
    outputs: [{ id: 'out_frames', name: '动图帧 (Frames)', type: 'frames' }],
    defaultParams: {
      emojiId: '110' // 吓
    },
    async execute(inputs, params) {
      const res = await window.QQEmojiService.loadEmojiFrames(params.emojiId || '110');
      return { out_frames: res.frames };
    }
  },

  'input_file': {
    type: 'input_file',
    title: '本地图像导入',
    subtitle: 'Local Image/GIF Input',
    category: 'INPUT',
    inputs: [],
    outputs: [{ id: 'out_frames', name: '动图帧 (Frames)', type: 'frames' }],
    defaultParams: {
      fileData: null,
      fileName: '',
      fileSize: 0
    },
    async execute(inputs, params) {
      if (!params.fileData || !params.fileData.frames || params.fileData.frames.length === 0) {
        return { out_frames: [] };
      }
      return { out_frames: params.fileData.frames };
    }
  },

  // --- 2. 对称与镜像 (双对称 / 四对称) ---
  'symmetry_dual': {
    type: 'symmetry_dual',
    title: '双对称',
    subtitle: 'Dual Symmetry',
    category: 'SYMMETRY',
    inputs: [{ id: 'in_frames', name: '输入帧 (In)', type: 'frames' }],
    outputs: [{ id: 'out_frames', name: '对称帧 (Out)', type: 'frames' }],
    defaultParams: {
      keep: 'left' // 'left', 'top', 'right', 'bottom'
    },
    async execute(inputs, params) {
      if (!inputs.in_frames) return { out_frames: [] };
      return { out_frames: window.FunctionLibrary.mirrorDual(inputs.in_frames, params.keep || 'left') };
    }
  },

  'symmetry_quad': {
    type: 'symmetry_quad',
    title: '四对称',
    subtitle: 'Quad Symmetry',
    category: 'SYMMETRY',
    inputs: [{ id: 'in_frames', name: '输入帧 (In)', type: 'frames' }],
    outputs: [{ id: 'out_frames', name: '对称帧 (Out)', type: 'frames' }],
    defaultParams: {
      quadrant: 'top_left' // 'top_left', 'top_right', 'bottom_left', 'bottom_right'
    },
    async execute(inputs, params) {
      if (!inputs.in_frames) return { out_frames: [] };
      return { out_frames: window.FunctionLibrary.mirrorQuad(inputs.in_frames, params.quadrant || 'top_left') };
    }
  },

  // 兼容旧版保存的序列别名
  'mirror_symmetry': {
    type: 'symmetry_dual',
    title: '双对称',
    subtitle: 'Dual Symmetry',
    category: 'SYMMETRY',
    isAlias: true,
    inputs: [{ id: 'in_frames', name: '输入帧 (In)', type: 'frames' }],
    outputs: [{ id: 'out_frames', name: '对称帧 (Out)', type: 'frames' }],
    defaultParams: { keep: 'left' },
    async execute(inputs, params) {
      if (!inputs.in_frames) return { out_frames: [] };
      const keep = params.keep || (params.direction === 'right_to_left' ? 'right' : params.direction === 'top_to_bottom' ? 'top' : params.direction === 'bottom_to_top' ? 'bottom' : 'left');
      return { out_frames: window.FunctionLibrary.mirrorDual(inputs.in_frames, keep) };
    }
  },

  // --- 3. 缝合与拼接 ---
  'merge_face': {
    type: 'merge_face',
    title: '双表情阴阳脸缝合',
    subtitle: 'Merge Face (Left A + Right B)',
    category: 'COMPOSITION',
    inputs: [
      { id: 'left_frames', name: '左半脸 (Left)', type: 'frames' },
      { id: 'right_frames', name: '右半脸 (Right)', type: 'frames' }
    ],
    outputs: [{ id: 'out_frames', name: '缝合输出 (Out)', type: 'frames' }],
    defaultParams: {
      splitRatio: 0.5
    },
    async execute(inputs, params) {
      const res = window.FunctionLibrary.mergeFace(
        inputs.left_frames,
        inputs.right_frames,
        params.splitRatio !== undefined ? params.splitRatio : 0.5
      );
      return { out_frames: res };
    }
  },

  'overlay': {
    type: 'overlay',
    title: '画中画图层叠加',
    subtitle: 'Overlay Layer',
    category: 'COMPOSITION',
    inputs: [
      { id: 'base_frames', name: '底图 (Base)', type: 'frames' },
      { id: 'overlay_frames', name: '覆层 (Overlay)', type: 'frames' }
    ],
    outputs: [{ id: 'out_frames', name: '叠加输出 (Out)', type: 'frames' }],
    defaultParams: {
      scale: 60,
      x: 0,
      y: 0,
      rotation: 0,
      opacity: 100
    },
    async execute(inputs, params) {
      if (!inputs.base_frames) return { out_frames: [] };
      if (!inputs.overlay_frames || inputs.overlay_frames.length === 0) {
        return { out_frames: inputs.base_frames };
      }

      const bw = inputs.base_frames[0].canvas.width;
      const bh = inputs.base_frames[0].canvas.height;
      const ow = inputs.overlay_frames[0].canvas.width;
      const oh = inputs.overlay_frames[0].canvas.height;

      const scale = (params.scale !== undefined ? params.scale : 60) / 100;
      const targetW = Math.max(8, Math.round(ow * scale));
      const targetH = Math.max(8, Math.round(oh * scale));

      const baseX = Math.round((bw - targetW) / 2) + (params.x || 0);
      const baseY = Math.round((bh - targetH) / 2) + (params.y || 0);

      const res = window.FunctionLibrary.overlay(inputs.base_frames, inputs.overlay_frames, {
        x: baseX,
        y: baseY,
        width: targetW,
        height: targetH,
        rotation: params.rotation || 0,
        opacity: (params.opacity !== undefined ? params.opacity : 100) / 100,
        loop: true
      });
      return { out_frames: res };
    }
  },

  'sequence_append': {
    type: 'sequence_append',
    title: '时间轴前后串联',
    subtitle: 'Sequence Stitch',
    category: 'COMPOSITION',
    inputs: [
      { id: 'frames_a', name: '前序片段 (A)', type: 'frames' },
      { id: 'frames_b', name: '后序片段 (B)', type: 'frames' }
    ],
    outputs: [{ id: 'out_frames', name: '串联输出 (Out)', type: 'frames' }],
    defaultParams: {
      loopB: 1
    },
    async execute(inputs, params) {
      const res = window.FunctionLibrary.sequenceAppend(
        inputs.frames_a,
        inputs.frames_b,
        params.loopB || 1
      );
      return { out_frames: res };
    }
  },

  'side_by_side': {
    type: 'side_by_side',
    title: '双表情并排拼接',
    subtitle: 'Side by Side',
    category: 'COMPOSITION',
    inputs: [
      { id: 'frames_a', name: '表情 A', type: 'frames' },
      { id: 'frames_b', name: '表情 B', type: 'frames' }
    ],
    outputs: [{ id: 'out_frames', name: '并排输出 (Out)', type: 'frames' }],
    defaultParams: {
      direction: 'horizontal'
    },
    async execute(inputs, params) {
      const res = window.FunctionLibrary.sideBySide(
        inputs.frames_a,
        inputs.frames_b,
        params.direction || 'horizontal'
      );
      return { out_frames: res };
    }
  },

  // --- 4. 帧数与时间控制 ---
  'frame_constraint': {
    type: 'frame_constraint',
    title: '帧数裁剪与约束',
    subtitle: 'Frame Constraint & Resample',
    category: 'FRAME',
    inputs: [{ id: 'in_frames', name: '输入帧 (In)', type: 'frames' }],
    outputs: [{ id: 'out_frames', name: '约束帧 (Out)', type: 'frames' }],
    defaultParams: {
      maxFrames: 24, // 0表示不限
      step: 1,       // 抽帧步长
      speedMultiplier: 1.0,
      overrideDelay: 0
    },
    async execute(inputs, params) {
      if (!inputs.in_frames) return { out_frames: [] };
      const res = window.FunctionLibrary.frameConstraint(inputs.in_frames, params);
      return { out_frames: res };
    }
  },

  'frame_interval': {
    type: 'frame_interval',
    title: '帧数区间',
    subtitle: 'Frame Range Slice',
    category: 'FRAME',
    inputs: [{ id: 'in_frames', name: '输入帧 (In)', type: 'frames' }],
    outputs: [{ id: 'out_frames', name: '区间输出 (Out)', type: 'frames' }],
    defaultParams: {
      startPercent: 0,
      endPercent: 100
    },
    async execute(inputs, params) {
      if (!inputs.in_frames) return { out_frames: [] };
      return {
        out_frames: window.FunctionLibrary.frameInterval(
          inputs.in_frames,
          params.startPercent !== undefined ? params.startPercent : 0,
          params.endPercent !== undefined ? params.endPercent : 100
        )
      };
    }
  },

  'speed_adjust': {
    type: 'speed_adjust',
    title: '播放变速',
    subtitle: 'Playback Speed',
    category: 'FRAME',
    inputs: [{ id: 'in_frames', name: '输入帧 (In)', type: 'frames' }],
    outputs: [{ id: 'out_frames', name: '变速帧 (Out)', type: 'frames' }],
    defaultParams: {
      speed: 1.5
    },
    async execute(inputs, params) {
      if (!inputs.in_frames) return { out_frames: [] };
      return { out_frames: window.FunctionLibrary.speedAdjust(inputs.in_frames, params.speed || 1.0) };
    }
  },

  'boomerang': {
    type: 'boomerang',
    title: '往复循环',
    subtitle: 'Boomerang Loop',
    category: 'FRAME',
    inputs: [{ id: 'in_frames', name: '输入帧 (In)', type: 'frames' }],
    outputs: [{ id: 'out_frames', name: '循环帧 (Out)', type: 'frames' }],
    defaultParams: {},
    async execute(inputs) {
      if (!inputs.in_frames) return { out_frames: [] };
      return { out_frames: window.FunctionLibrary.boomerang(inputs.in_frames) };
    }
  },

  'reverse': {
    type: 'reverse',
    title: '全片倒放',
    subtitle: 'Reverse Playback',
    category: 'FRAME',
    inputs: [{ id: 'in_frames', name: '输入帧 (In)', type: 'frames' }],
    outputs: [{ id: 'out_frames', name: '倒放帧 (Out)', type: 'frames' }],
    defaultParams: {},
    async execute(inputs) {
      if (!inputs.in_frames) return { out_frames: [] };
      return { out_frames: window.FunctionLibrary.reverse(inputs.in_frames) };
    }
  },

  // --- 5. 变形 ---
  'warp_lens': {
    type: 'warp_lens',
    title: '透镜缩放',
    subtitle: 'Lens Zoom (-100% ~ 100%)',
    category: 'WARP',
    inputs: [{ id: 'in_frames', name: '输入帧 (In)', type: 'frames' }],
    outputs: [{ id: 'out_frames', name: '变形帧 (Out)', type: 'frames' }],
    defaultParams: {
      scale: 50, // -100% to 100% (负为凹透镜收缩捏脸，正为凸透镜放大膨胀)
      radius: 65,
      centerX: 50,
      centerY: 50
    },
    async execute(inputs, params) {
      if (!inputs.in_frames) return { out_frames: [] };
      const scaleVal = typeof params.scale !== 'undefined' ? params.scale : (typeof params.strength !== 'undefined' ? params.strength : 50);
      const cfg = {
        type: 'lens',
        strength: scaleVal / 100,
        radius: params.radius || 65,
        center: { x: (params.centerX || 50) / 100, y: (params.centerY || 50) / 100 }
      };
      return { out_frames: window.FunctionLibrary.warp(inputs.in_frames, cfg) };
    }
  },

  'warp_bulge': {
    type: 'warp_bulge',
    title: '凸透镜局部膨胀',
    subtitle: 'Bulge Distortion',
    category: 'WARP',
    isAlias: true,
    inputs: [{ id: 'in_frames', name: '输入帧 (In)', type: 'frames' }],
    outputs: [{ id: 'out_frames', name: '变形帧 (Out)', type: 'frames' }],
    defaultParams: {
      scale: 60,
      radius: 65,
      centerX: 50,
      centerY: 50
    },
    async execute(inputs, params) {
      if (!inputs.in_frames) return { out_frames: [] };
      const scaleVal = typeof params.scale !== 'undefined' ? params.scale : (params.strength || 60);
      const cfg = {
        type: 'lens',
        strength: scaleVal / 100,
        radius: params.radius || 65,
        center: { x: (params.centerX || 50) / 100, y: (params.centerY || 50) / 100 }
      };
      return { out_frames: window.FunctionLibrary.warp(inputs.in_frames, cfg) };
    }
  },

  'warp_pinch': {
    type: 'warp_pinch',
    title: '凹透镜局部收缩',
    subtitle: 'Pinch Distortion',
    category: 'WARP',
    isAlias: true,
    inputs: [{ id: 'in_frames', name: '输入帧 (In)', type: 'frames' }],
    outputs: [{ id: 'out_frames', name: '变形帧 (Out)', type: 'frames' }],
    defaultParams: {
      scale: -60,
      radius: 65,
      centerX: 50,
      centerY: 50
    },
    async execute(inputs, params) {
      if (!inputs.in_frames) return { out_frames: [] };
      const scaleVal = typeof params.scale !== 'undefined' ? params.scale : -(params.strength || 60);
      const cfg = {
        type: 'lens',
        strength: scaleVal / 100,
        radius: params.radius || 65,
        center: { x: (params.centerX || 50) / 100, y: (params.centerY || 50) / 100 }
      };
      return { out_frames: window.FunctionLibrary.warp(inputs.in_frames, cfg) };
    }
  },

  'warp_wave': {
    type: 'warp_wave',
    title: '周期波浪摇摆',
    subtitle: 'Wave & Wobble',
    category: 'WARP',
    inputs: [{ id: 'in_frames', name: '输入帧 (In)', type: 'frames' }],
    outputs: [{ id: 'out_frames', name: '波浪帧 (Out)', type: 'frames' }],
    defaultParams: {
      amplitude: 16,
      frequency: 0.05,
      animated: true
    },
    async execute(inputs, params) {
      if (!inputs.in_frames) return { out_frames: [] };
      const cfg = {
        type: 'wave',
        strength: 0.6,
        amplitude: params.amplitude || 16,
        frequency: params.frequency || 0.05,
        animated: params.animated !== false
      };
      return { out_frames: window.FunctionLibrary.warp(inputs.in_frames, cfg) };
    }
  },

  'warp_squash': {
    type: 'warp_squash',
    title: '弹簧果冻形变',
    subtitle: 'Squash & Stretch',
    category: 'WARP',
    inputs: [{ id: 'in_frames', name: '输入帧 (In)', type: 'frames' }],
    outputs: [{ id: 'out_frames', name: '果冻帧 (Out)', type: 'frames' }],
    defaultParams: {
      scaleX: 1.15,
      scaleY: 0.85,
      animated: true,
      strength: 0.6
    },
    async execute(inputs, params) {
      if (!inputs.in_frames) return { out_frames: [] };
      const cfg = {
        type: 'squash',
        scaleX: params.scaleX || 1.15,
        scaleY: params.scaleY || 0.85,
        strength: params.strength || 0.6,
        animated: params.animated !== false
      };
      return { out_frames: window.FunctionLibrary.warp(inputs.in_frames, cfg) };
    }
  },

  // --- 6. 二创特效 ---
  'meme_caption': {
    type: 'meme_caption',
    title: '描边文字字幕',
    subtitle: 'Caption Overlay',
    category: 'MEME',
    inputs: [{ id: 'in_frames', name: '输入帧 (In)', type: 'frames' }],
    outputs: [{ id: 'out_frames', name: '字幕输出 (Out)', type: 'frames' }],
    defaultParams: {
      topText: '',
      bottomText: '就这？',
      fontSize: 22,
      textColor: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidth: 4
    },
    async execute(inputs, params) {
      if (!inputs.in_frames) return { out_frames: [] };
      return { out_frames: window.FunctionLibrary.memeText(inputs.in_frames, params) };
    }
  },

  // --- 6. 色彩与滤镜 (Color & Filters) ---
  'color_adjust': {
    type: 'color_adjust',
    title: '色彩与滤镜调节',
    subtitle: 'Color & Filter Adjustment',
    category: 'COLOR',
    inputs: [{ id: 'in_frames', name: '输入帧 (In)', type: 'frames' }],
    outputs: [{ id: 'out_frames', name: '滤镜输出 (Out)', type: 'frames' }],
    defaultParams: {
      filter: 'none',       // 'none', 'grayscale', 'invert', 'sepia', 'cyberpunk', 'high_contrast', 'warm', 'cool'
      hueRotate: 0,         // 0 - 360
      saturation: 100,      // 0 - 200%
      brightness: 0,        // -100 - +100%
      contrast: 0,          // -100 - +100%
      invert: false
    },
    async execute(inputs, params) {
      if (!inputs.in_frames) return { out_frames: [] };
      return { out_frames: window.FunctionLibrary.colorAdjust(inputs.in_frames, params) };
    }
  },

  'rainbow_glitch': {
    type: 'rainbow_glitch',
    title: '色相循环变化',
    subtitle: 'Hue Cycle Animation',
    category: 'COLOR',
    inputs: [{ id: 'in_frames', name: '输入帧 (In)', type: 'frames' }],
    outputs: [{ id: 'out_frames', name: '滤镜输出 (Out)', type: 'frames' }],
    defaultParams: {},
    async execute(inputs) {
      if (!inputs.in_frames) return { out_frames: [] };
      return { out_frames: window.FunctionLibrary.rainbowGlitch(inputs.in_frames) };
    }
  },

  // --- 7. 输出与导出 ---
  'output_export': {
    type: 'output_export',
    title: '终点输出',
    subtitle: 'Pipeline Output',
    category: 'OUTPUT',
    inputs: [{ id: 'in_frames', name: '最终动图 (Frames)', type: 'frames' }],
    outputs: [],
    defaultParams: {
      resolution: 'original',
      colors: 128,
      preserveAlpha: true
    },
    async execute(inputs) {
      return { finalFrames: inputs.in_frames || [] };
    }
  }
};

window.NODE_CATEGORIES = NODE_CATEGORIES;
window.NODE_DEFINITIONS = NODE_DEFINITIONS;
