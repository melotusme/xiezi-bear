(() => {
  'use strict';

  const PRESET_CHARS = [
    '王', '李', '张', '林',
    '小', '明', '红', '华', '乐',
    '天', '文', '星', '一', '宝'
  ];

  const BUILTIN_AUDIO_CHARS = new Set(PRESET_CHARS);
  const BUILTIN_AUDIO_STROKES = new Set([
    '横', '竖', '撇', '捺', '点', '提',
    '竖钩', '横折', '横钩', '横折钩', '撇折', '撇点',
    '竖弯钩', '横撇', '竖提', '横折提', '折笔',
    '卧钩', '斜钩', '弯钩', '竖折', '竖弯',
    '竖折折钩', '横折弯钩', '横折折撇', '横撇弯钩', '横斜钩'
  ]);

  const DEFAULT_SAVED_NAMES = ['王小明', '李小红', '张小华', '林小乐'];
  const STORAGE_KEY_SAVED = 'hanzi_name_saved_list_v1';
  const STORAGE_KEY_LAST = 'hanzi_name_last_active_v1';

  const CHAR_META = {
    '王': { pinyin: 'wáng', tip: '三横间距均匀，底横最长', strokes: ['横', '横', '竖', '横'] },
    '李': { pinyin: 'lǐ', tip: '上木舒展盖下面，子字弯钩站中间', strokes: ['横', '竖', '撇', '捺', '横撇', '弯钩', '横'] },
    '张': { pinyin: 'zhāng', tip: '左弓窄长右长宽，最后一捺写舒展', strokes: ['横折', '横', '竖折折钩', '撇', '横', '竖提', '捺'] },
    '林': { pinyin: 'lín', tip: '双木并排好朋友，左木捺变小点点', strokes: ['横', '竖', '撇', '点', '横', '竖', '撇', '捺'] },
    '小': { pinyin: 'xiǎo', tip: '先写中间竖钩挺，左右两点对称美', strokes: ['竖钩', '撇', '点'] },
    '明': { pinyin: 'míng', tip: '左日窄小右月长，日字靠上写匀称', strokes: ['竖', '横折', '横', '横', '撇', '横折钩', '横', '横'] },
    '红': { pinyin: 'hóng', tip: '绞丝旁紧凑工字稳，底横平平托起来', strokes: ['撇折', '撇折', '提', '横', '竖', '横'] },
    '华': { pinyin: 'huá', tip: '上窄下宽十字稳，长横伸展竖居中', strokes: ['撇', '竖', '撇', '竖弯钩', '横', '竖'] },
    '乐': { pinyin: 'lè', tip: '竖折端正竖钩直，左右两点相呼应', strokes: ['撇', '竖折', '竖钩', '撇', '点'] },
    '天': { pinyin: 'tiān', tip: '上横短来下横长，撇捺舒展站稳当', strokes: ['横', '横', '撇', '捺'] },
    '文': { pinyin: 'wén', tip: '首点居中横略长，撇捺交叉在中央', strokes: ['点', '横', '撇', '捺'] },
    '星': { pinyin: 'xīng', tip: '上日方正下生稳，横画平行间距匀', strokes: ['竖', '横折', '横', '横', '撇', '横', '横', '竖', '横'] },
    '一': { pinyin: 'yī', tip: '起笔轻顿向右行，一横平直有力气', strokes: ['横'] },
    '宝': { pinyin: 'bǎo', tip: '宝盖宽宽盖住玉，最后一点别忘记', strokes: ['点', '点', '横钩', '横', '横', '竖', '横', '点'] }
  };

  const STAR_FILLED_SVG = `<svg viewBox="0 0 24 24" fill="#FFD15C" stroke="#E0A116" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.7 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/></svg>`;
  const STAR_EMPTY_SVG = `<svg viewBox="0 0 24 24" fill="#FFF7E2" stroke="#E8D2B5" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.7 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/></svg>`;

  const TOUCH_BASE_LENIENCY = 1.32;
  const DESKTOP_BASE_LENIENCY = 1.18;
  const TOUCH_LONG_VERTICAL_LENIENCY = 1.65;
  const DESKTOP_LONG_VERTICAL_LENIENCY = 1.5;
  const VERTICAL_STROKE_NAMES = new Set(['竖', '竖钩', '竖提', '弯钩']);

  function isCoarsePointer() {
    return Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }

  const state = {
    nameChars: ['王', '小', '明'],
    activeIndex: 0,
    mode: 'watch', // 'watch' | 'write'
    isSlow: true,
    showOutline: true,
    soundEnabled: true,
    completed: new Set(),
    writer: null,
    charData: null,
    currentStepIndex: -1,
    loadToken: 0,
    animToken: 0,
    animStatus: 'idle', // 'idle' | 'playing' | 'paused'
    pauseRequested: false,
    resumeIndex: 0,
    chipBufferMode: false,
    showcaseWriters: [],
    savedNames: [],
    lastBoardWidth: 0
  };

  // DOM 引用
  const el = {
    fullNameDisplay: document.getElementById('full-name-display'),
    openNamePickerBtn: document.getElementById('open-name-picker-btn'),
    speakNameBtn: document.getElementById('speak-name-btn'),
    animateAllBtn: document.getElementById('animate-all-btn'),
    openVoicePickerBtn: document.getElementById('open-voice-picker-btn'),
    currentVoiceBadge: document.getElementById('current-voice-badge'),
    soundToggle: document.getElementById('sound-toggle'),
    soundOnSvg: document.getElementById('sound-on-svg'),
    soundOffSvg: document.getElementById('sound-off-svg'),
    soundLabel: document.getElementById('sound-label'),
    charTabs: document.getElementById('char-tabs'),

    modeWatchBtn: document.getElementById('mode-watch-btn'),
    modeWriteBtn: document.getElementById('mode-write-btn'),
    currentCharBadge: document.getElementById('current-char-badge'),
    currentPinyin: document.getElementById('current-pinyin'),
    speakCharBtn: document.getElementById('speak-char-btn'),
    strokeProgressLabel: document.getElementById('stroke-progress-label'),
    hanziTarget: document.getElementById('hanzi-target'),
    feedbackToast: document.getElementById('feedback-toast'),

    watchControls: document.getElementById('watch-controls'),
    writeControls: document.getElementById('write-controls'),
    playAnimBtn: document.getElementById('play-anim-btn'),
    playIconSvg: document.getElementById('play-icon-svg'),
    pauseIconSvg: document.getElementById('pause-icon-svg'),
    playBtnText: document.getElementById('play-btn-text'),
    prevStrokeBtn: document.getElementById('prev-stroke-btn'),
    nextStrokeBtn: document.getElementById('next-stroke-btn'),
    speedToggleBtn: document.getElementById('speed-toggle-btn'),
    speedSlowSvg: document.getElementById('speed-slow-svg'),
    speedFastSvg: document.getElementById('speed-fast-svg'),
    speedToggleLabel: document.getElementById('speed-toggle-label'),

    resetWriteBtn: document.getElementById('reset-write-btn'),
    hintStrokeBtn: document.getElementById('hint-stroke-btn'),
    toggleOutlineBtn: document.getElementById('toggle-outline-btn'),
    outlineBtnText: document.getElementById('outline-btn-text'),

    bearMascot: document.getElementById('bear-mascot'),
    mascotTitle: document.getElementById('mascot-title'),
    mascotDesc: document.getElementById('mascot-desc'),
    nextCharBtn: document.getElementById('next-char-btn'),
    nextCharBtnText: document.getElementById('next-char-btn-text'),
    totalStrokesBadge: document.getElementById('total-strokes-badge'),
    currentTip: document.getElementById('current-tip'),
    strokeStepsGrid: document.getElementById('stroke-steps-grid'),

    namePickerModal: document.getElementById('name-picker-modal'),
    closeNamePickerBtn: document.getElementById('close-name-picker-btn'),
    savedNamesList: document.getElementById('saved-names-list'),
    nameInput: document.getElementById('name-input'),
    applyNameBtn: document.getElementById('apply-name-btn'),
    saveNameBtn: document.getElementById('save-name-btn'),
    clearSlotsBtn: document.getElementById('clear-slots-btn'),
    presetChips: document.getElementById('preset-chips'),

    voicePickerModal: document.getElementById('voice-picker-modal'),
    closeVoicePickerBtn: document.getElementById('close-voice-picker-btn'),
    voiceOptionsList: document.getElementById('voice-options-list'),
    systemVoiceSection: document.getElementById('system-voice-section'),
    systemVoiceSelect: document.getElementById('system-voice-select'),
    systemVoiceEmpty: document.getElementById('system-voice-empty'),

    showcaseModal: document.getElementById('showcase-modal'),
    closeShowcaseBtn: document.getElementById('close-showcase-btn'),
    showcaseGrid: document.getElementById('showcase-grid'),
    replayShowcaseBtn: document.getElementById('replay-showcase-btn'),

    celebrateModal: document.getElementById('celebrate-modal'),
    celebrateName: document.getElementById('celebrate-name'),
    practiceAgainBtn: document.getElementById('practice-again-btn'),
    closeCelebrateBtn: document.getElementById('close-celebrate-btn'),
    confettiCanvas: document.getElementById('confetti-canvas')
  };

  // 小熊互动状态
  let bearMoodTimer = null;
  function setBearMood(mood, title, desc, autoResetMs = 0) {
    clearTimeout(bearMoodTimer);
    el.bearMascot.classList.remove('state-idle', 'state-talking', 'state-happy', 'state-encourage');
    el.bearMascot.classList.add(`state-${mood}`);
    if (title) el.mascotTitle.textContent = title;
    if (desc) el.mascotDesc.textContent = desc;

    if (autoResetMs > 0) {
      bearMoodTimer = setTimeout(() => {
        el.bearMascot.classList.remove('state-happy', 'state-encourage');
        el.bearMascot.classList.add('state-idle');
      }, autoResetMs);
    }
  }

  // Web Audio 轻音效（优先复用 VoiceEngine 共享 AudioContext 及移动端解锁）
  let audioCtx = null;
  let audioUnlockBound = false;

  function getAudioCtx() {
    if (window.VoiceEngine && typeof window.VoiceEngine.getAudioCtx === 'function') {
      return window.VoiceEngine.getAudioCtx();
    }
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        try {
          audioCtx = new Ctx();
        } catch (_) {
          audioCtx = null;
        }
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function setupMobileAudioUnlock() {
    if (window.VoiceEngine && typeof window.VoiceEngine.unlockAudio === 'function') {
      window.VoiceEngine.unlockAudio();
      return;
    }
    if (audioUnlockBound || typeof document === 'undefined') return;
    audioUnlockBound = true;

    const unlock = () => {
      try {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const playSilentTick = () => {
          try {
            const buf = ctx.createBuffer(1, 1, 22050);
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(ctx.destination);
            src.start(0);
          } catch (_) {}
        };
        if (ctx.state === 'suspended') {
          ctx.resume()
            .then(() => {
              playSilentTick();
              if (ctx.state === 'running') cleanup();
            })
            .catch(() => {});
        } else {
          playSilentTick();
          if (ctx.state === 'running') cleanup();
        }
      } catch (_) {}
    };

    const cleanup = () => {
      document.removeEventListener('pointerdown', unlock, { capture: true });
      document.removeEventListener('touchstart', unlock, { capture: true });
    };

    document.addEventListener('pointerdown', unlock, { capture: true, passive: true });
    document.addEventListener('touchstart', unlock, { capture: true, passive: true });
  }

  function playTone(freq, duration = 0.12, type = 'sine', gainVal = 0.12, delay = 0) {
    if (!state.soundEnabled) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch (_) {}
  }

  function playCorrectSound() {
    playTone(587.33, 0.1, 'triangle', 0.12, 0);
    playTone(880, 0.15, 'triangle', 0.12, 0.07);
  }

  function playWrongSound() {
    playTone(250, 0.12, 'sine', 0.09, 0);
    playTone(200, 0.16, 'sine', 0.09, 0.08);
  }

  function playSuccessFanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => playTone(n, 0.2, 'triangle', 0.14, i * 0.09));
  }

  // 多音色语音播放（优先委托给 window.VoiceEngine，支持 5 档音色与开源真人读音）
  let currentAudio = null;

  function stopCurrentAudio() {
    if (window.VoiceEngine && typeof window.VoiceEngine.stop === 'function') {
      window.VoiceEngine.stop();
    }
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch (_) {}
      currentAudio = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  function getBestChineseVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    const zhVoices = voices.filter((v) => /zh|cmn/i.test(v.lang));
    if (!zhVoices.length) return null;
    const preferred = zhVoices.find((v) => /Xiaoxiao|Xiaoyi|Yunxi|Natural|Online|Google/i.test(v.name));
    return preferred || zhVoices[0];
  }

  function playAudioClip(src, timeoutMs = 2200) {
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      try {
        const audio = new Audio(src);
        currentAudio = audio;
        audio.onended = () => {
          if (currentAudio === audio) currentAudio = null;
          done();
        };
        audio.onerror = () => {
          if (currentAudio === audio) currentAudio = null;
          done();
        };
        const p = audio.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            if (currentAudio === audio) currentAudio = null;
            done();
          });
        }
        setTimeout(done, timeoutMs);
      } catch (_) {
        done();
      }
    });
  }

  function speakWithBrowserTTS(text, rate = 0.9) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window) || !text) {
        resolve();
        return;
      }
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'zh-CN';
        const bestVoice = getBestChineseVoice();
        if (bestVoice) utter.voice = bestVoice;
        utter.rate = rate;
        utter.pitch = 1.05;
        utter.onend = done;
        utter.onerror = done;
        window.speechSynthesis.speak(utter);
        setTimeout(done, 1800);
      } catch (_) {
        done();
      }
    });
  }

  function preloadVoiceChars(chars = state.nameChars) {
    if (window.VoiceEngine && typeof window.VoiceEngine.preloadChars === 'function') {
      window.VoiceEngine.preloadChars(chars);
    }
  }

  async function speakText(text) {
    if (!state.soundEnabled) {
      showToast('声音已关闭，点右上角打开哦');
      return;
    }
    if (window.VoiceEngine && typeof window.VoiceEngine.speakText === 'function') {
      const myToken = state.animToken;
      await window.VoiceEngine.speakText(text, () => myToken !== state.animToken);
      return;
    }
    stopCurrentAudio();
    const chars = Array.from(text || '');
    if (chars.length === 1 && BUILTIN_AUDIO_CHARS.has(chars[0])) {
      await playAudioClip(`audio/xiaoyi/char_${chars[0]}.mp3`);
      return;
    }
    if (chars.length > 1 && chars.every((c) => BUILTIN_AUDIO_CHARS.has(c))) {
      const myToken = state.animToken;
      for (const c of chars) {
        if (myToken !== state.animToken) return;
        await playAudioClip(`audio/xiaoyi/char_${c}.mp3`);
      }
      return;
    }
    await speakWithBrowserTTS(text, 0.88);
  }

  function speakStrokeSync(strokeName) {
    if (!state.soundEnabled || !strokeName) {
      return Promise.resolve();
    }
    if (window.VoiceEngine && typeof window.VoiceEngine.speakStroke === 'function') {
      return window.VoiceEngine.speakStroke(strokeName);
    }
    stopCurrentAudio();
    if (BUILTIN_AUDIO_STROKES.has(strokeName)) {
      return playAudioClip(`audio/xiaoyi/stroke_${strokeName}.mp3`, 1800);
    }
    return speakWithBrowserTTS(strokeName, 1.0);
  }

  function updatePlayButtonUI() {
    const coarse = isCoarsePointer();
    const keyHint = coarse ? '' : ' (空格)';
    if (el.playAnimBtn) {
      el.playAnimBtn.title = coarse ? '点击播放或暂停' : '按空格键也可播放或暂停';
    }
    if (state.animStatus === 'playing') {
      el.playIconSvg.classList.add('hidden');
      el.pauseIconSvg.classList.remove('hidden');
      el.playBtnText.textContent = state.pauseRequested ? '写完本笔停...' : `暂停${keyHint}`;
    } else if (state.animStatus === 'paused') {
      el.playIconSvg.classList.remove('hidden');
      el.pauseIconSvg.classList.add('hidden');
      el.playBtnText.textContent = `继续看${keyHint}`;
    } else {
      el.playIconSvg.classList.remove('hidden');
      el.pauseIconSvg.classList.add('hidden');
      el.playBtnText.textContent = `再看一遍${keyHint}`;
    }
  }

  let celebrateTimer = null;

  function cancelSpeechAndAnim() {
    clearTimeout(celebrateTimer);
    state.animToken += 1;
    state.animStatus = 'idle';
    state.pauseRequested = false;
    state.resumeIndex = 0;
    updatePlayButtonUI();
    stopCurrentAudio();
  }

  function classifyStrokeFromMedian(pts) {
    if (!pts || pts.length < 2) return '点';
    const segs = [];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const dx = pts[i + 1][0] - pts[i][0];
      const dy = pts[i + 1][1] - pts[i][1];
      const len = Math.hypot(dx, dy);
      if (len < 16) continue;
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      let d;
      if (ang >= -22 && ang <= 26) d = 'R';
      else if (ang > 26 && ang <= 72) d = 'UR';
      else if (ang > 72 && ang <= 112) d = 'U';
      else if (ang > 112 && ang <= 155) d = 'UL';
      else if (ang > 155 || ang < -155) d = 'L';
      else if (ang >= -155 && ang < -108) d = 'DL';
      else if (ang >= -108 && ang < -65) d = 'D';
      else d = 'DR';

      if (!segs.length || segs[segs.length - 1][0] !== d) {
        segs.push([d, len]);
      } else {
        segs[segs.length - 1][1] += len;
      }
    }

    if (segs.length > 1 && segs[0][1] < 80 && ['DR', 'DL', 'UR'].includes(segs[0][0]) && segs[1][1] > segs[0][1] * 1.3) {
      segs.shift();
    }
    while (segs.length > 1 && segs[segs.length - 1][1] < 36) {
      segs.pop();
    }
    if (!segs.length) return '点';

    const sumDir = (list, targets) => list.reduce((acc, [d, l]) => (targets.includes(d) ? acc + l : acc), 0);
    const totalLen = segs.reduce((acc, [, l]) => acc + l, 0);
    const dxAll = pts[pts.length - 1][0] - pts[0][0];
    const dyAll = pts[pts.length - 1][1] - pts[0][1];
    const overallAng = (Math.atan2(dyAll, dxAll) * 180) / Math.PI;

    if (dxAll > 40 && dyAll > 50 && overallAng >= 18 && !segs.some(([d, l]) => (d === 'D' || d === 'DL') && l > 50)) {
      return '提';
    }

    if (segs[0][0] === 'R' && segs[0][1] >= 55) {
      const rest = segs.slice(1);
      const restLen = rest.reduce((acc, [, l]) => acc + l, 0);
      if (!rest.length || restLen < 45) return '横';
      const dLen = sumDir(rest, ['D', 'DR']);
      const dlLen = sumDir(rest, ['DL']);
      const rLen = sumDir(rest, ['R']);
      const [lastD, lastL] = rest[rest.length - 1];
      if (dLen >= 55 && (lastD === 'UR' || lastD === 'U') && lastL >= 50) {
        return rLen >= 90 ? '横折弯钩' : '横折提';
      }
      if (dLen >= 55 && (lastD === 'UL' || lastD === 'L') && lastL >= 55 && dlLen < 120) {
        return '横折钩';
      }
      if (dlLen >= 160) return '横撇';
      if (dLen >= 75) return '横折';
      if (dlLen >= 45 && dLen < 60) return dlLen < 155 ? '横钩' : '横撇';
      if (rest.every(([d]) => d === 'R' || d === 'UR')) return '横';
    }

    if (segs[0][0] === 'DL') {
      if (sumDir(segs.slice(1), ['R', 'UR']) >= 75) return '撇折';
      if (sumDir(segs.slice(1), ['DR']) >= 150) return '撇点';
      return '撇';
    }

    if (segs[0][0] === 'D' || segs[0][0] === 'DR') {
      const [lastD, lastL] = segs[segs.length - 1];
      const dLen = sumDir(segs, ['D']);
      const dlLen = sumDir(segs, ['DL']);
      const drLen = sumDir(segs, ['DR']);
      const rMid = sumDir(segs.slice(1), ['R']);

      if (dLen >= 200 && lastD === 'DR' && lastL >= 220) return '撇点';
      if (rMid >= 80 && ['U', 'UR', 'UL'].includes(lastD)) {
        return lastD === 'UL' || dLen < 130 ? '卧钩' : '竖弯钩';
      }
      if (drLen >= 160 && (lastD === 'U' || lastD === 'UR') && rMid < 80) return '斜钩';
      if (segs[0][0] === 'D' && lastD === 'UR' && lastL >= 60) return '竖提';
      if (segs[0][0] === 'D' && (lastD === 'UL' || lastD === 'L') && lastL >= 55 && dlLen < 130) return '竖钩';
      if (dlLen >= 120 && rMid >= 75) return '撇折';
      if (segs[0][0] === 'D' && rMid >= 80 && drLen < 120) return '竖折';
      if (dlLen >= 120) return '撇';
      if (segs[0][0] === 'DR') {
        return rMid >= 70 || totalLen >= 340 ? '捺' : '点';
      }
      if (dLen >= 110 && Math.abs(dxAll) < dLen * 0.45) return '竖';
      if (totalLen < 220) return '点';
    }

    if (segs[0][0] === 'U' || segs[0][0] === 'UR') return '提';
    return totalLen < 200 ? '点' : '折笔';
  }

  function getStrokeName(char, strokeIdx) {
    const meta = CHAR_META[char];
    if (meta && meta.strokes && meta.strokes[strokeIdx]) {
      return meta.strokes[strokeIdx];
    }
    const median = state.charData && state.charData.medians && state.charData.medians[strokeIdx];
    if (!median || median.length < 2) return `第${strokeIdx + 1}画`;
    return classifyStrokeFromMedian(median);
  }

  // 提示气泡
  let toastTimer = null;
  function showToast(msg, variant = '') {
    clearTimeout(toastTimer);
    el.feedbackToast.textContent = msg;
    el.feedbackToast.className = `feedback-toast show ${variant}`.trim();
    toastTimer = setTimeout(() => {
      el.feedbackToast.classList.remove('show');
    }, 1800);
  }

  // 加密长直线段的中轴采样点，避免 HanziWriter 计算平均距离时因长竖笔采样稀疏产生误判
  function densifyMedianPoints(pts, maxStep = 45) {
    if (!Array.isArray(pts) || pts.length < 2) return pts;
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i += 1) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const segLen = Math.hypot(x1 - x0, y1 - y0);
      if (segLen > maxStep) {
        const steps = Math.ceil(segLen / maxStep);
        for (let s = 1; s < steps; s += 1) {
          const t = s / steps;
          out.push([
            Math.round((x0 + (x1 - x0) * t) * 10) / 10,
            Math.round((y0 + (y1 - y0) * t) * 10) / 10
          ]);
        }
      }
      out.push(pts[i]);
    }
    return out;
  }

  function prepareWriterCharData(charData) {
    if (!charData || !Array.isArray(charData.medians)) return charData;
    return {
      ...charData,
      medians: charData.medians.map((m) => densifyMedianPoints(m, 45))
    };
  }

  // 识别较长的竖向笔画（竖 / 竖钩 / 竖提 / 弯钩，或 Y 轴大幅向下且以竖为主的笔画）
  function analyzeVerticalStroke(pts, strokeName = '') {
    if (!Array.isArray(pts) || pts.length < 2) {
      return { isLongVertical: false };
    }
    const start = pts[0];
    const end = pts[pts.length - 1];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];

    let minYIdx = 0;
    for (let i = 1; i < pts.length; i += 1) {
      if (pts[i][1] <= pts[minYIdx][1]) minYIdx = i;
    }
    const bottom = pts[minYIdx];
    const shaftDx = bottom[0] - start[0];
    const shaftDy = bottom[1] - start[1];

    let shaftMinX = Infinity;
    let shaftMaxX = -Infinity;
    for (let i = 0; i <= minYIdx; i += 1) {
      shaftMinX = Math.min(shaftMinX, pts[i][0]);
      shaftMaxX = Math.max(shaftMaxX, pts[i][0]);
    }
    const shaftWidthX = shaftMaxX - shaftMinX;

    let tailLen = 0;
    for (let i = minYIdx + 1; i < pts.length; i += 1) {
      tailLen += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }

    const namedVertical = VERTICAL_STROKE_NAMES.has(strokeName);
    const hasLongDownwardSpan = dy <= -260 || shaftDy <= -280 || (namedVertical && shaftDy <= -235);
    const predominantlyVertical =
      Math.abs(dy) > 2.0 * Math.abs(dx) &&
      Math.abs(shaftDy) > 2.4 * Math.abs(shaftDx);
    const narrowShaft = shaftWidthX <= Math.max(110, Math.abs(shaftDy) * 0.22);
    const compactTail = tailLen <= Math.abs(shaftDy) * 0.42;

    const isLongVertical = Boolean(
      hasLongDownwardSpan && predominantlyVertical && narrowShaft && compactTail
    );

    return {
      isLongVertical,
      start,
      end,
      bottom,
      dx,
      dy,
      shaftDx,
      shaftDy,
      shaftWidthX,
      tailLen,
      denseShaft: isLongVertical ? densifyMedianPoints(pts.slice(0, minYIdx + 1), 35) : null
    };
  }

  function getBaseLeniency(coarse = isCoarsePointer()) {
    return coarse ? TOUCH_BASE_LENIENCY : DESKTOP_BASE_LENIENCY;
  }

  function getStrokeLeniency(charData, ch, strokeIdx, coarse = isCoarsePointer()) {
    const median = charData && charData.medians && charData.medians[strokeIdx];
    const strokeName = getStrokeName(ch, strokeIdx);
    const vertInfo = analyzeVerticalStroke(median, strokeName);
    if (vertInfo.isLongVertical) {
      return coarse ? TOUCH_LONG_VERTICAL_LENIENCY : DESKTOP_LONG_VERTICAL_LENIENCY;
    }
    return getBaseLeniency(coarse);
  }

  // 针对小朋友手指写长竖笔画（收笔略短、轻微弧度、竖钩/竖提小钩略轻）做专项宽容判定，
  // 同时严格拦截横画、自下而上倒插笔、撇捺斜画、短点误触或偏离走廊位置的错笔。
  function matchesLongVerticalFingerStroke(userPoints, vertInfo, coarse = isCoarsePointer()) {
    if (!vertInfo || !vertInfo.isLongVertical || !Array.isArray(userPoints) || userPoints.length < 2) {
      return false;
    }
    const pts = [userPoints[0]];
    for (let i = 1; i < userPoints.length; i += 1) {
      const prev = pts[pts.length - 1];
      if (userPoints[i].x !== prev.x || userPoints[i].y !== prev.y) {
        pts.push(userPoints[i]);
      }
    }
    if (pts.length < 2) return false;

    const first = pts[0];
    const last = pts[pts.length - 1];
    const overallDy = last.y - first.y;
    if (overallDy >= -120) return false;

    let userMinYIdx = 0;
    for (let i = 1; i < pts.length; i += 1) {
      if (pts[i].y <= pts[userMinYIdx].y) userMinYIdx = i;
    }
    const userBottom = pts[userMinYIdx];
    const userShaftDx = userBottom.x - first.x;
    const userShaftDy = userBottom.y - first.y;
    const targetShaftSpan = Math.abs(vertInfo.shaftDy);

    const minRequiredDownward = Math.max(135, targetShaftSpan * (coarse ? 0.45 : 0.52));
    if (-userShaftDy < minRequiredDownward) return false;

    if (Math.abs(userShaftDy) < 2.25 * Math.abs(userShaftDx)) return false;

    let shaftMinX = Infinity;
    let shaftMaxX = -Infinity;
    let upwardBacktrack = 0;
    for (let i = 0; i <= userMinYIdx; i += 1) {
      shaftMinX = Math.min(shaftMinX, pts[i].x);
      shaftMaxX = Math.max(shaftMaxX, pts[i].x);
      if (i > 0) {
        const stepDy = pts[i].y - pts[i - 1].y;
        if (stepDy > 0) upwardBacktrack += stepDy;
      }
    }
    if (shaftMaxX - shaftMinX > Math.max(145, Math.abs(userShaftDy) * 0.34)) return false;
    if (upwardBacktrack > Math.max(45, Math.abs(userShaftDy) * 0.16)) return false;

    let userTailLen = 0;
    for (let i = userMinYIdx + 1; i < pts.length; i += 1) {
      userTailLen += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    const maxAllowedTail = vertInfo.tailLen > 30
      ? Math.max(220, vertInfo.tailLen * 1.8)
      : Math.max(95, Math.abs(userShaftDy) * 0.22);
    if (userTailLen > maxAllowedTail) return false;

    const [targetStartX, targetStartY] = vertInfo.start;
    const targetBottomY = vertInfo.bottom[1];
    const maxStartXOffset = coarse ? 190 : 160;
    const maxStartAbove = coarse ? 175 : 145;
    const maxStartBelow = Math.max(coarse ? 205 : 170, targetShaftSpan * 0.32);

    if (Math.abs(first.x - targetStartX) > maxStartXOffset) return false;
    if (first.y > targetStartY + maxStartAbove || first.y < targetStartY - maxStartBelow) return false;
    if (userBottom.y < targetBottomY - (coarse ? 210 : 175)) return false;

    const denseShaft = vertInfo.denseShaft || [vertInfo.start, vertInfo.bottom];
    let distSum = 0;
    for (let i = 0; i <= userMinYIdx; i += 1) {
      const ux = pts[i].x;
      const uy = pts[i].y;
      let best = Infinity;
      for (let j = 0; j < denseShaft.length; j += 1) {
        const d = Math.hypot(ux - denseShaft[j][0], uy - denseShaft[j][1]);
        if (d < best) best = d;
      }
      distSum += best;
    }
    const avgShaftDist = distSum / (userMinYIdx + 1);
    if (avgShaftDist > (coarse ? 165 : 138)) return false;

    return true;
  }

  function isNonVerticalWrongAttempt(userPoints, vertInfo) {
    if (!vertInfo || !vertInfo.isLongVertical || !Array.isArray(userPoints) || userPoints.length < 2) {
      return false;
    }
    const first = userPoints[0];
    const last = userPoints[userPoints.length - 1];
    const overallDy = last.y - first.y;
    if (overallDy >= -95) return true;

    let minYIdx = 0;
    for (let i = 1; i < userPoints.length; i += 1) {
      if (userPoints[i].y <= userPoints[minYIdx].y) minYIdx = i;
    }
    const bottom = userPoints[minYIdx];
    const shaftDx = bottom.x - first.x;
    const shaftDy = bottom.y - first.y;
    if (Math.abs(shaftDy) < 2.0 * Math.abs(shaftDx)) return true;
    if (Math.abs(first.x - vertInfo.start[0]) > 210) return true;
    return false;
  }

  function attachLongVerticalQuizHook(writer, charData, ch) {
    const quiz = writer && writer._quiz;
    if (!quiz || quiz._longVerticalHooked || typeof quiz.endUserStroke !== 'function') return;
    quiz._longVerticalHooked = true;

    const origEndUserStroke = quiz.endUserStroke;
    quiz.endUserStroke = function patchedEndUserStroke() {
      const activeStroke = this._userStroke;
      const idx = this._currentStrokeIndex;
      const coarse = isCoarsePointer();

      if (this._options && charData && charData.medians && idx >= 0 && idx < charData.medians.length) {
        const strokeName = getStrokeName(ch, idx);
        const vertInfo = analyzeVerticalStroke(charData.medians[idx], strokeName);
        if (vertInfo.isLongVertical && activeStroke && Array.isArray(activeStroke.points)) {
          if (matchesLongVerticalFingerStroke(activeStroke.points, vertInfo, coarse)) {
            this._options.leniency = getStrokeLeniency(charData, ch, idx, coarse);
            const prevAutoPass = this._options.markStrokeCorrectAfterMisses;
            this._options.markStrokeCorrectAfterMisses = 1;
            try {
              return origEndUserStroke.call(this);
            } finally {
              this._options.markStrokeCorrectAfterMisses = prevAutoPass;
            }
          }
          if (isNonVerticalWrongAttempt(activeStroke.points, vertInfo)) {
            const prevLeniency = this._options.leniency;
            this._options.leniency = 0.95;
            try {
              return origEndUserStroke.call(this);
            } finally {
              this._options.leniency = prevLeniency;
            }
          }
        }
        this._options.leniency = getStrokeLeniency(charData, ch, idx, coarse);
      }
      return origEndUserStroke.call(this);
    };
  }

  // 笔画数据加载器（优先走 4 级开源 StrokeLoader：内置 -> hanzi-writer-data -> animCJK -> BabelStone IDS）
  function charDataLoader(char, onComplete, onError) {
    if (window.StrokeLoader && typeof window.StrokeLoader.loadCharData === 'function') {
      window.StrokeLoader.loadCharData(char)
        .then(onComplete)
        .catch((err) => {
          if (onError) onError(err);
        });
      return;
    }
    if (window.BUILTIN_STROKE_DATA && window.BUILTIN_STROKE_DATA[char]) {
      onComplete(window.BUILTIN_STROKE_DATA[char]);
      return;
    }
    fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${encodeURIComponent(char)}.json`)
      .then((res) => {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      })
      .then(onComplete)
      .catch((err) => {
        if (onError) onError(err);
      });
  }

  function getDisplayPinyin(ch) {
    if (CHAR_META[ch] && CHAR_META[ch].pinyin) {
      return CHAR_META[ch].pinyin;
    }
    if (window.StrokeLoader && typeof window.StrokeLoader.getCharPinyin === 'function') {
      return window.StrokeLoader.getCharPinyin(ch, '汉字') || '汉字';
    }
    return '汉字';
  }

  function refreshDisplayedPinyin() {
    renderNameTabs();
    const ch = state.nameChars[state.activeIndex];
    if (ch && el.currentPinyin) {
      el.currentPinyin.textContent = getDisplayPinyin(ch);
    }
  }

  function initPinyinEngine() {
    if (!window.StrokeLoader) return;
    if (typeof window.StrokeLoader.preloadPinyinPro === 'function') {
      window.StrokeLoader.preloadPinyinPro();
    }
    if (typeof window.StrokeLoader.ensurePinyinReady === 'function') {
      window.StrokeLoader.ensurePinyinReady()
        .then((ready) => {
          if (!ready) return;
          refreshDisplayedPinyin();
          preloadVoiceChars(state.nameChars);
        })
        .catch(() => {});
    }
  }

  function writerCharDataLoader(char, onComplete, onError) {
    charDataLoader(
      char,
      (data) => onComplete(prepareWriterCharData(data)),
      onError
    );
  }

  function getCharDataAsync(char) {
    return new Promise((resolve, reject) => {
      charDataLoader(char, resolve, reject);
    });
  }

  function extractHanzi(str) {
    const matches = (str || '').match(/[\u4e00-\u9fff]/g);
    return matches ? matches.slice(0, 3) : [];
  }

  // 本地存储：读取与保存名字列表
  function loadSavedState() {
    try {
      const rawList = localStorage.getItem(STORAGE_KEY_SAVED);
      if (rawList) {
        const parsed = JSON.parse(rawList);
        if (Array.isArray(parsed)) {
          state.savedNames = parsed.filter((n) => typeof n === 'string' && extractHanzi(n).length > 0);
        }
      } else {
        state.savedNames = [...DEFAULT_SAVED_NAMES];
        localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify(state.savedNames));
      }

      const last = localStorage.getItem(STORAGE_KEY_LAST);
      if (last) {
        const chars = extractHanzi(last);
        if (chars.length > 0) {
          state.nameChars = chars;
          el.nameInput.value = chars.join('');
        }
      }
    } catch (_) {
      state.savedNames = [...DEFAULT_SAVED_NAMES];
    }
  }

  function persistSavedNames() {
    try {
      localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify(state.savedNames));
    } catch (_) {}
  }

  // 弹窗管理
  function anyModalOpen() {
    return (
      !el.namePickerModal.classList.contains('hidden') ||
      (el.voicePickerModal && !el.voicePickerModal.classList.contains('hidden')) ||
      !el.showcaseModal.classList.contains('hidden') ||
      !el.celebrateModal.classList.contains('hidden')
    );
  }

  // 音色切换弹窗（换声音）
  let voicePreviewSeq = 0;

  function updateVoiceButtonUI() {
    if (!window.VoiceEngine || typeof window.VoiceEngine.getCurrentProfile !== 'function') return;
    const profile = window.VoiceEngine.getCurrentProfile();
    if (el.currentVoiceBadge) {
      el.currentVoiceBadge.textContent = profile.shortName || profile.name;
    }
    if (el.openVoicePickerBtn) {
      el.openVoicePickerBtn.title = `切换朗读音色（当前：${profile.name}）`;
    }
  }

  function clearPreviewingButtons() {
    if (!el.voiceOptionsList) return;
    el.voiceOptionsList.querySelectorAll('.voice-preview-btn.is-previewing').forEach((btn) => {
      btn.classList.remove('is-previewing');
    });
  }

  async function auditionVoice(voiceId, triggerBtn = null) {
    if (!state.soundEnabled) {
      showToast('声音已关闭，点右上角打开哦');
      return;
    }
    if (!window.VoiceEngine || typeof window.VoiceEngine.previewVoice !== 'function') return;
    voicePreviewSeq += 1;
    const mySeq = voicePreviewSeq;
    clearPreviewingButtons();
    if (triggerBtn) triggerBtn.classList.add('is-previewing');
    const sampleChar = state.nameChars[state.activeIndex] || '王';
    try {
      await window.VoiceEngine.previewVoice(voiceId, sampleChar);
    } finally {
      if (mySeq === voicePreviewSeq && triggerBtn) {
        triggerBtn.classList.remove('is-previewing');
      }
    }
  }

  function renderSystemVoices() {
    if (!el.systemVoiceSection || !el.systemVoiceSelect || !window.VoiceEngine) return;
    const isSystem = window.VoiceEngine.getVoiceId() === 'system';
    el.systemVoiceSection.classList.toggle('hidden', !isSystem);
    if (!isSystem) return;

    const voices = typeof window.VoiceEngine.getSystemVoices === 'function'
      ? window.VoiceEngine.getSystemVoices()
      : [];
    const currentURI = typeof window.VoiceEngine.getSystemVoiceURI === 'function'
      ? window.VoiceEngine.getSystemVoiceURI()
      : '';

    el.systemVoiceSelect.innerHTML = '';
    const autoOpt = document.createElement('option');
    autoOpt.value = '';
    autoOpt.textContent = '自动选择最佳中文语音';
    el.systemVoiceSelect.appendChild(autoOpt);

    voices.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v.voiceURI;
      opt.textContent = v.lang ? `${v.name} (${v.lang})` : v.name;
      el.systemVoiceSelect.appendChild(opt);
    });

    el.systemVoiceSelect.value = voices.some((v) => v.voiceURI === currentURI) ? currentURI : '';
    if (el.systemVoiceEmpty) {
      el.systemVoiceEmpty.classList.toggle('hidden', voices.length > 0);
    }
  }

  function renderVoiceOptions() {
    if (!el.voiceOptionsList || !window.VoiceEngine || typeof window.VoiceEngine.getProfiles !== 'function') return;
    const profiles = window.VoiceEngine.getProfiles();
    const activeId = window.VoiceEngine.getVoiceId();
    el.voiceOptionsList.innerHTML = '';

    profiles.forEach((profile) => {
      const isActive = profile.id === activeId;
      const card = document.createElement('div');
      card.className = `voice-card${isActive ? ' active' : ''}`;
      card.setAttribute('role', 'radio');
      card.setAttribute('aria-checked', String(isActive));
      card.tabIndex = 0;

      const iconWrap = document.createElement('div');
      iconWrap.className = 'voice-card-icon';
      iconWrap.setAttribute('aria-hidden', 'true');
      iconWrap.textContent = profile.icon || '🎙️';

      const body = document.createElement('div');
      body.className = 'voice-card-body';

      const titleRow = document.createElement('div');
      titleRow.className = 'voice-card-title-row';

      const nameEl = document.createElement('span');
      nameEl.className = 'voice-card-name';
      nameEl.textContent = profile.name;

      const tagEl = document.createElement('span');
      tagEl.className = `voice-tag voice-tag-${profile.id}`;
      tagEl.textContent = profile.tag;

      titleRow.appendChild(nameEl);
      titleRow.appendChild(tagEl);

      const descEl = document.createElement('p');
      descEl.className = 'voice-card-desc';
      descEl.textContent = profile.desc;

      body.appendChild(titleRow);
      body.appendChild(descEl);

      const actions = document.createElement('div');
      actions.className = 'voice-card-actions';

      const checkEl = document.createElement('span');
      checkEl.className = 'voice-check';
      checkEl.setAttribute('aria-hidden', 'true');
      checkEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

      const previewBtn = document.createElement('button');
      previewBtn.type = 'button';
      previewBtn.className = 'voice-preview-btn';
      previewBtn.setAttribute('aria-label', `试听${profile.name}`);
      previewBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg><span>试听</span>`;
      previewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        previewBtn.blur();
        auditionVoice(profile.id, previewBtn);
      });

      actions.appendChild(checkEl);
      actions.appendChild(previewBtn);

      const selectVoice = () => {
        window.VoiceEngine.setVoiceId(profile.id);
        updateVoiceButtonUI();
        preloadVoiceChars(state.nameChars);
        renderVoiceOptions();
        renderSystemVoices();
        if (state.soundEnabled) {
          auditionVoice(profile.id);
        } else {
          showToast(`已切换到「${profile.name}」`);
        }
      };

      card.addEventListener('click', selectVoice);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectVoice();
        }
      });

      card.appendChild(iconWrap);
      card.appendChild(body);
      card.appendChild(actions);
      el.voiceOptionsList.appendChild(card);
    });
  }

  function openVoicePicker() {
    if (!el.voicePickerModal) return;
    cancelSpeechAndAnim();
    renderVoiceOptions();
    renderSystemVoices();
    el.voicePickerModal.classList.remove('hidden');
  }

  function closeVoicePicker() {
    if (!el.voicePickerModal || el.voicePickerModal.classList.contains('hidden')) return;
    voicePreviewSeq += 1;
    clearPreviewingButtons();
    stopCurrentAudio();
    el.voicePickerModal.classList.add('hidden');
    syncBoardSizeIfChanged();
  }

  function openNamePicker() {
    cancelSpeechAndAnim();
    el.nameInput.value = state.nameChars.join('');
    state.chipBufferMode = false;
    renderSavedNames();
    renderPresetChips();
    el.namePickerModal.classList.remove('hidden');
  }

  function closeNamePicker() {
    el.namePickerModal.classList.add('hidden');
    syncBoardSizeIfChanged();
  }

  function renderSavedNames() {
    el.savedNamesList.innerHTML = '';
    if (state.savedNames.length === 0) {
      const hint = document.createElement('span');
      hint.className = 'saved-empty-hint';
      hint.textContent = '还没有保存的名字，在下面输入后点“保存名字”吧';
      el.savedNamesList.appendChild(hint);
      return;
    }

    const activeStr = state.nameChars.join('');
    state.savedNames.forEach((nameStr) => {
      const pill = document.createElement('div');
      pill.className = `saved-name-pill${nameStr === activeStr ? ' active' : ''}`;
      pill.setAttribute('role', 'button');
      pill.tabIndex = 0;
      pill.title = `练习「${nameStr}」`;

      const textSpan = document.createElement('span');
      textSpan.textContent = nameStr;

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'saved-name-del';
      delBtn.title = `删除「${nameStr}」`;
      delBtn.setAttribute('aria-label', `删除 ${nameStr}`);
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.savedNames = state.savedNames.filter((n) => n !== nameStr);
        persistSavedNames();
        renderSavedNames();
      });

      const selectHandler = () => {
        pill.blur();
        playTone(660, 0.08, 'sine', 0.08);
        closeNamePicker();
        applyName(extractHanzi(nameStr));
      };

      pill.addEventListener('click', selectHandler);
      pill.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          selectHandler();
        }
      });

      pill.appendChild(textSpan);
      pill.appendChild(delBtn);
      el.savedNamesList.appendChild(pill);
    });
  }

  function renderPresetChips() {
    el.presetChips.innerHTML = '';
    const inputChars = extractHanzi(el.nameInput.value);
    PRESET_CHARS.forEach((ch) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'char-chip';
      if (inputChars.includes(ch)) {
        btn.classList.add('in-name');
      }
      btn.textContent = ch;
      btn.title = `点选「${ch}」`;
      btn.addEventListener('click', () => {
        btn.blur();
        handleChipClick(ch);
      });
      el.presetChips.appendChild(btn);
    });
  }

  function handleChipClick(ch) {
    playTone(660, 0.08, 'sine', 0.08);
    let current = extractHanzi(el.nameInput.value);
    if (!state.chipBufferMode && current.length >= 3) {
      current = [ch];
      state.chipBufferMode = true;
    } else if (current.length < 3) {
      current.push(ch);
      state.chipBufferMode = current.length < 3;
    } else {
      current = [ch];
      state.chipBufferMode = true;
    }
    el.nameInput.value = current.join('');
    renderPresetChips();

    if (current.length === 3) {
      state.chipBufferMode = false;
      closeNamePicker();
      applyName(current);
    }
  }

  function saveCurrentName() {
    const chars = extractHanzi(el.nameInput.value);
    if (!chars.length) {
      showToast('请先输入汉字哦', 'warn');
      return;
    }
    const nameStr = chars.join('');
    state.savedNames = [nameStr, ...state.savedNames.filter((n) => n !== nameStr)];
    persistSavedNames();
    renderSavedNames();
    playCorrectSound();
    closeNamePicker();
    applyName(chars);
    showToast(`已保存「${nameStr}」`, 'good');
  }

  function applyName(chars) {
    if (!chars.length) {
      showToast('请输入至少 1 个汉字哦', 'warn');
      return;
    }
    state.nameChars = chars;
    state.activeIndex = 0;
    state.completed.clear();
    el.nameInput.value = chars.join('');
    try {
      localStorage.setItem(STORAGE_KEY_LAST, chars.join(''));
    } catch (_) {}
    renderSavedNames();
    renderPresetChips();
    renderNameTabs();
    preloadVoiceChars(chars);
    if (window.StrokeLoader && typeof window.StrokeLoader.ensurePinyinReady === 'function') {
      window.StrokeLoader.ensurePinyinReady()
        .then((ready) => {
          if (ready) refreshDisplayedPinyin();
        })
        .catch(() => {});
    }
    loadActiveCharacter();
  }

  // 渲染 3 个汉字大萌卡
  function renderNameTabs() {
    el.fullNameDisplay.textContent = state.nameChars.join('');
    el.charTabs.innerHTML = '';

    state.nameChars.forEach((ch, idx) => {
      const pinyin = getDisplayPinyin(ch);
      const isActive = idx === state.activeIndex;
      const isDone = state.completed.has(idx);

      const tab = document.createElement('button');
      tab.type = 'button';
      tab.role = 'tab';
      tab.ariaSelected = String(isActive);
      tab.className = `char-tab${isActive ? ' active' : ''}${isDone ? ' completed' : ''}`;
      tab.innerHTML = `
        <span class="char-tab-glyph">${ch}</span>
        <span class="char-tab-info">
          <span class="char-tab-order">第 ${idx + 1} 个字</span>
          <span class="char-tab-pinyin">${pinyin}</span>
        </span>
        <span class="char-tab-star">${isDone ? STAR_FILLED_SVG : STAR_EMPTY_SVG}</span>
      `;
      tab.addEventListener('click', () => {
        tab.blur();
        if (state.activeIndex === idx) return;
        state.activeIndex = idx;
        renderNameTabs();
        loadActiveCharacter();
      });
      el.charTabs.appendChild(tab);
    });
  }

  // 生成每一步的笔顺小卡（含笔画名）
  function renderStrokeSteps(charData) {
    el.strokeStepsGrid.innerHTML = '';
    if (!charData || !charData.strokes) return;

    const ch = state.nameChars[state.activeIndex];
    const total = charData.strokes.length;
    el.totalStrokesBadge.textContent = `共 ${total} 画`;

    charData.strokes.forEach((_, idx) => {
      const strokeName = getStrokeName(ch, idx);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'stroke-step-card';
      card.dataset.strokeIdx = String(idx);
      card.title = `第 ${idx + 1} 画：${strokeName}`;

      const prevPaths = charData.strokes
        .slice(0, idx)
        .map((d) => `<path d="${d}" fill="#D6C6B4"></path>`)
        .join('');
      const currPath = `<path d="${charData.strokes[idx]}" fill="#FF7477"></path>`;

      let startDot = '';
      if (charData.medians && charData.medians[idx] && charData.medians[idx][0]) {
        const [sx, sy] = charData.medians[idx][0];
        startDot = `<circle cx="${sx}" cy="${sy}" r="50" fill="#FFD86B" stroke="#E05256" stroke-width="18"></circle>`;
      }

      card.innerHTML = `
        <span class="stroke-step-num">${idx + 1}</span>
        <svg class="stroke-step-svg" viewBox="0 0 1024 1024" aria-hidden="true">
          <g transform="scale(1, -1) translate(0, -900)">
            ${prevPaths}
            ${currPath}
            ${startDot}
          </g>
        </svg>
        <span class="stroke-step-name">${strokeName}</span>
      `;

      card.addEventListener('click', () => {
        card.blur();
        if (state.mode !== 'watch') {
          setMode('watch');
        }
        jumpToStroke(idx);
      });

      el.strokeStepsGrid.appendChild(card);
    });
  }

  function highlightStrokeStep(idx) {
    state.currentStepIndex = idx;
    const cards = el.strokeStepsGrid.querySelectorAll('.stroke-step-card');
    cards.forEach((c, i) => {
      c.classList.toggle('active', i === idx);
    });
    if (idx >= 0 && state.charData) {
      const ch = state.nameChars[state.activeIndex];
      const strokeName = getStrokeName(ch, idx);
      el.strokeProgressLabel.textContent = `第 ${idx + 1} / ${state.charData.strokes.length} 画 · ${strokeName}`;
      const activeCard = cards[idx];
      if (activeCard) {
        activeCard.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      }
    }
  }

  function getBoardSize() {
    return el.hanziTarget.clientWidth || 320;
  }

  function getDrawingWidth(coarse = isCoarsePointer()) {
    return coarse ? 26 : 20;
  }

  function getAnimSpeedValue() {
    return state.isSlow ? 0.7 : 1.5;
  }

  // 加载当前选中的汉字（支持尺寸变化重绘时保留测验进度）
  async function loadActiveCharacter(options = {}) {
    const resumeStrokeIdx =
      typeof options.resumeStrokeIdx === 'number' && options.resumeStrokeIdx > 0
        ? options.resumeStrokeIdx
        : 0;
    cancelSpeechAndAnim();
    state.loadToken += 1;
    const myToken = state.loadToken;
    const ch = state.nameChars[state.activeIndex];
    const meta = CHAR_META[ch] || { tip: '跟着红线一笔一画慢慢写' };

    el.currentCharBadge.textContent = ch;
    el.currentPinyin.textContent = getDisplayPinyin(ch);
    el.currentTip.textContent = meta.tip;
    el.nextCharBtn.classList.add('hidden');
    el.strokeProgressLabel.textContent = '准备中...';
    el.hanziTarget.innerHTML = '';
    state.currentStepIndex = -1;

    try {
      const charData = await getCharDataAsync(ch);
      if (myToken !== state.loadToken) return;

      state.charData = charData;
      renderStrokeSteps(charData);

      el.hanziTarget.innerHTML = '';
      const size = getBoardSize();
      state.lastBoardWidth = size;
      const coarse = isCoarsePointer();
      const boardPadding = Math.round(Math.max(14, Math.min(20, size * 0.055)));

      state.writer = HanziWriter.create(el.hanziTarget, ch, {
        width: size,
        height: size,
        padding: boardPadding,
        showOutline: state.mode === 'watch' ? true : state.showOutline,
        showCharacter: state.mode === 'watch',
        strokeAnimationSpeed: getAnimSpeedValue(),
        delayBetweenStrokes: state.isSlow ? 320 : 140,
        strokeColor: '#3E2E26',
        outlineColor: '#EBD9C5',
        radicalColor: '#FF7477',
        drawingColor: '#5CB8F5',
        drawingWidth: getDrawingWidth(coarse),
        leniency: getBaseLeniency(coarse),
        highlightColor: '#FF7477',
        showHintAfterMisses: 2,
        highlightOnComplete: true,
        charDataLoader: writerCharDataLoader
      });

      const createdSvg = el.hanziTarget.querySelector('svg');
      if (createdSvg && !createdSvg.getAttribute('viewBox')) {
        createdSvg.setAttribute('viewBox', `0 0 ${size} ${size}`);
      }

      if (state.mode === 'watch') {
        playFullAnimation();
      } else {
        startQuiz(resumeStrokeIdx);
      }
    } catch (_) {
      el.strokeProgressLabel.textContent = '暂无笔画数据';
      showToast(`暂时找不到「${ch}」的笔画数据`, 'warn');
    }
  }

  function animateSingleStrokeAsync(idx) {
    return new Promise((resolve) => {
      if (!state.writer) {
        resolve();
        return;
      }
      state.writer.animateStroke(idx, {
        onComplete: resolve
      });
    });
  }

  async function runStrokeSequence(startIndex = 0) {
    if (!state.writer || !state.charData) return;
    const total = state.charData.strokes.length;
    const ch = state.nameChars[state.activeIndex];

    state.animToken += 1;
    const myAnimToken = state.animToken;
    state.animStatus = 'playing';
    state.pauseRequested = false;
    updatePlayButtonUI();

    if (startIndex === 0) {
      state.writer.hideCharacter();
      state.writer.showOutline();
    }

    const pauseGapMs = state.isSlow ? 140 : 120;

    for (let i = startIndex; i < total; i += 1) {
      if (myAnimToken !== state.animToken) return;
      const strokeName = getStrokeName(ch, i);
      highlightStrokeStep(i);
      setBearMood(
        state.isSlow ? 'talking' : 'idle',
        `第 ${i + 1} 笔：${strokeName}`,
        `仔细看「${ch}」的第 ${i + 1} 笔怎么走哦！`
      );

      const tasks = [animateSingleStrokeAsync(i)];
      if (state.isSlow) {
        tasks.push(speakStrokeSync(strokeName));
      }
      await Promise.all(tasks);

      if (myAnimToken !== state.animToken) return;

      // 写完当前这一笔后，若有暂停请求，立即停下
      if (state.pauseRequested) {
        state.pauseRequested = false;
        if (i + 1 >= total) {
          state.animStatus = 'idle';
          state.resumeIndex = 0;
          el.strokeProgressLabel.textContent = `看完了（共 ${total} 画）`;
          setBearMood('happy', '看完啦！', '点上面“自己写”，亲手描一遍吧！', 1800);
        } else {
          state.animStatus = 'paused';
          state.resumeIndex = i + 1;
          el.strokeProgressLabel.textContent = `已暂停 · 已写 ${i + 1} / ${total} 画`;
          setBearMood(
            'idle',
            '先歇一会儿',
            isCoarsePointer() ? '点“继续看”，接着看下一笔！' : '按空格或“继续看”，接着看下一笔！'
          );
        }
        updatePlayButtonUI();
        return;
      }

      if (i + 1 < total) {
        await new Promise((r) => setTimeout(r, pauseGapMs));
        if (myAnimToken !== state.animToken) return;
        if (state.pauseRequested) {
          state.pauseRequested = false;
          state.animStatus = 'paused';
          state.resumeIndex = i + 1;
          el.strokeProgressLabel.textContent = `已暂停 · 已写 ${i + 1} / ${total} 画`;
          setBearMood(
            'idle',
            '先歇一会儿',
            isCoarsePointer() ? '点“继续看”，接着看下一笔！' : '按空格或“继续看”，接着看下一笔！'
          );
          updatePlayButtonUI();
          return;
        }
      }
    }

    if (myAnimToken === state.animToken) {
      state.animStatus = 'idle';
      state.pauseRequested = false;
      state.resumeIndex = 0;
      el.strokeProgressLabel.textContent = `看完了（共 ${total} 画）`;
      setBearMood('happy', '看明白啦！', '切换到“自己写”，试着写出小星星吧！', 1800);
      updatePlayButtonUI();
    }
  }

  function playFullAnimation() {
    runStrokeSequence(0);
  }

  function togglePlayPause() {
    if (!state.writer || !state.charData || state.mode !== 'watch') return;
    if (state.animStatus === 'playing') {
      if (!state.pauseRequested) {
        state.pauseRequested = true;
        updatePlayButtonUI();
        showToast('写完这一笔就停下哦');
      }
    } else if (state.animStatus === 'paused') {
      runStrokeSequence(state.resumeIndex);
    } else {
      runStrokeSequence(0);
    }
  }

  function jumpToStroke(idx) {
    if (!state.writer || !state.charData) return;
    cancelSpeechAndAnim();
    const total = state.charData.strokes.length;
    const clamped = Math.max(0, Math.min(total - 1, idx));
    const ch = state.nameChars[state.activeIndex];
    const strokeName = getStrokeName(ch, clamped);
    highlightStrokeStep(clamped);
    setBearMood('talking', `第 ${clamped + 1} 笔：${strokeName}`, '这一笔再看仔细一点哦！', 1200);
    state.writer.hideCharacter();
    state.writer.showOutline();
    state.writer.animateStroke(clamped);
    if (state.isSlow && state.soundEnabled) {
      speakStrokeSync(strokeName);
    }
  }

  function startQuiz(startStrokeIdx = 0) {
    if (!state.writer || !state.charData) return;
    const charData = state.charData;
    const writer = state.writer;
    const total = charData.strokes.length;
    const clampedStart = Math.max(0, Math.min(total - 1, startStrokeIdx));
    const ch = state.nameChars[state.activeIndex];
    const startStrokeName = getStrokeName(ch, clampedStart);
    highlightStrokeStep(clampedStart);
    el.nextCharBtn.classList.add('hidden');
    setBearMood(
      'idle',
      `轮到你写「${ch}」啦`,
      `第 ${clampedStart + 1} 笔是「${startStrokeName}」，沿着浅色字帖描一描！`
    );

    if (state.showOutline) {
      writer.showOutline();
    } else {
      writer.hideOutline();
    }

    const initialLeniency = getStrokeLeniency(charData, ch, clampedStart);

    const quizPromise = writer.quiz({
      quizStartStrokeNum: clampedStart,
      leniency: initialLeniency,
      drawingWidth: getDrawingWidth(),
      onCorrectStroke: (strokeData) => {
        playCorrectSound();
        const nextIdx = strokeData.strokeNum + 1;
        if (nextIdx < total) {
          if (writer._options) {
            writer._options.leniency = getStrokeLeniency(charData, ch, nextIdx);
          }
          const nextName = getStrokeName(ch, nextIdx);
          highlightStrokeStep(nextIdx);
          setBearMood('happy', '真棒！写对啦！', `下一笔是第 ${nextIdx + 1} 笔「${nextName}」`, 900);
          showToast('这一笔真漂亮！', 'good');
        }
      },
      onMistake: () => {
        playWrongSound();
        const idx = Math.max(0, state.currentStepIndex);
        const sName = getStrokeName(ch, idx);
        const isVert = VERTICAL_STROKE_NAMES.has(sName);
        setBearMood(
          'encourage',
          '没关系，再来一次',
          isVert
            ? `第 ${idx + 1} 笔是「${sName}」，从上往下直直画哦！`
            : `第 ${idx + 1} 笔是「${sName}」，看看红色闪光哦！`,
          1200
        );
        showToast(isVert ? '从上往下慢慢画竖哦' : '看看闪光提示再试一次', 'warn');
      },
      onComplete: () => {
        playSuccessFanfare();
        highlightStrokeStep(total - 1);
        el.strokeProgressLabel.textContent = `写完啦！（共 ${total} 画）`;
        state.completed.add(state.activeIndex);
        renderNameTabs();

        setBearMood('happy', `「${ch}」获得小星星！`, '你写得太工整啦，小熊为你鼓掌！', 2200);
        showToast(`「${ch}」写完啦！获得一颗星星！`, 'good');

        if (state.completed.size >= state.nameChars.length) {
          launchConfetti();
          el.celebrateName.textContent = state.nameChars.join('');
          clearTimeout(celebrateTimer);
          celebrateTimer = setTimeout(() => {
            el.celebrateModal.classList.remove('hidden');
          }, 550);
        } else {
          const nextIdx = findNextPendingChar();
          el.nextCharBtnText.textContent = `太棒啦！去写第 ${nextIdx + 1} 个字「${state.nameChars[nextIdx]}」`;
          el.nextCharBtn.classList.remove('hidden');
        }
      }
    });

    if (quizPromise && typeof quizPromise.then === 'function') {
      quizPromise
        .then(() => {
          if (state.writer === writer) {
            attachLongVerticalQuizHook(writer, charData, ch);
          }
        })
        .catch(() => {});
    } else {
      attachLongVerticalQuizHook(writer, charData, ch);
    }
  }

  function findNextPendingChar() {
    const after = state.nameChars.findIndex((_, i) => i > state.activeIndex && !state.completed.has(i));
    if (after !== -1) return after;
    const any = state.nameChars.findIndex((_, i) => !state.completed.has(i));
    return any !== -1 ? any : (state.activeIndex + 1) % state.nameChars.length;
  }

  function setMode(mode) {
    state.mode = mode;
    const isWatch = mode === 'watch';
    el.modeWatchBtn.classList.toggle('active', isWatch);
    el.modeWriteBtn.classList.toggle('active', !isWatch);
    el.modeWatchBtn.setAttribute('aria-selected', String(isWatch));
    el.modeWriteBtn.setAttribute('aria-selected', String(!isWatch));
    el.watchControls.classList.toggle('hidden', !isWatch);
    el.writeControls.classList.toggle('hidden', isWatch);
    loadActiveCharacter();
  }

  function updateSpeedUI() {
    el.speedSlowSvg.classList.toggle('hidden', !state.isSlow);
    el.speedFastSvg.classList.toggle('hidden', state.isSlow);
    el.speedToggleLabel.textContent = state.isSlow ? '慢读报笔顺' : '快看笔顺';
  }

  // 连看 3 个字弹窗
  function openShowcase() {
    cancelSpeechAndAnim();
    el.showcaseModal.classList.remove('hidden');
    el.showcaseGrid.innerHTML = '';
    state.showcaseWriters = [];

    for (const ch of state.nameChars) {
      const box = document.createElement('div');
      box.className = 'showcase-box';
      el.showcaseGrid.appendChild(box);
      const writer = HanziWriter.create(box, ch, {
        width: 144,
        height: 144,
        padding: 10,
        showOutline: true,
        showCharacter: false,
        strokeAnimationSpeed: 1.15,
        delayBetweenStrokes: 170,
        strokeColor: '#3E2E26',
        radicalColor: '#FF7477',
        outlineColor: '#EBD9C5',
        charDataLoader
      });
      state.showcaseWriters.push(writer);
    }
    playShowcaseSequence();
  }

  function playShowcaseSequence() {
    const writers = state.showcaseWriters;
    writers.forEach((w) => w.hideCharacter());
    let idx = 0;
    function next() {
      if (idx >= writers.length || el.showcaseModal.classList.contains('hidden')) return;
      writers[idx].animateCharacter({
        onComplete: () => {
          idx += 1;
          setTimeout(next, 240);
        }
      });
    }
    next();
  }

  // 礼花庆祝动画
  function launchConfetti() {
    const canvas = el.confettiCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#FF7477', '#FFD86B', '#4CD2A4', '#5CB8F5', '#FFAD7A'];
    const pieces = Array.from({ length: 110 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.4,
      w: 9 + Math.random() * 8,
      h: 7 + Math.random() * 6,
      vx: (Math.random() - 0.5) * 4,
      vy: 3 + Math.random() * 4.5,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.2,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));

    let frame = 0;
    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vRot;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      frame += 1;
      if (frame < 160) {
        requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    requestAnimationFrame(tick);
  }

  // 事件绑定
  function bindEvents() {
    el.openNamePickerBtn.addEventListener('click', () => {
      el.openNamePickerBtn.blur();
      openNamePicker();
    });
    el.closeNamePickerBtn.addEventListener('click', closeNamePicker);
    el.namePickerModal.addEventListener('click', (e) => {
      if (e.target === el.namePickerModal) closeNamePicker();
    });

    if (el.openVoicePickerBtn) {
      el.openVoicePickerBtn.addEventListener('click', () => {
        el.openVoicePickerBtn.blur();
        openVoicePicker();
      });
    }
    if (el.closeVoicePickerBtn) {
      el.closeVoicePickerBtn.addEventListener('click', closeVoicePicker);
    }
    if (el.voicePickerModal) {
      el.voicePickerModal.addEventListener('click', (e) => {
        if (e.target === el.voicePickerModal) closeVoicePicker();
      });
    }
    if (el.systemVoiceSelect) {
      el.systemVoiceSelect.addEventListener('change', (e) => {
        if (!window.VoiceEngine || typeof window.VoiceEngine.setSystemVoiceURI !== 'function') return;
        window.VoiceEngine.setSystemVoiceURI(e.target.value);
        if (state.soundEnabled) {
          auditionVoice('system');
        }
      });
    }
    if ('speechSynthesis' in window) {
      const handleVoicesChanged = () => {
        if (el.voicePickerModal && !el.voicePickerModal.classList.contains('hidden')) {
          renderSystemVoices();
        }
      };
      if (typeof window.speechSynthesis.addEventListener === 'function') {
        window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
      } else {
        window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
      }
    }

    el.applyNameBtn.addEventListener('click', () => {
      state.chipBufferMode = false;
      const chars = extractHanzi(el.nameInput.value);
      if (!chars.length) {
        showToast('请输入至少 1 个汉字哦', 'warn');
        return;
      }
      closeNamePicker();
      applyName(chars);
    });

    el.saveNameBtn.addEventListener('click', saveCurrentName);

    el.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        state.chipBufferMode = false;
        const chars = extractHanzi(el.nameInput.value);
        if (chars.length) {
          closeNamePicker();
          applyName(chars);
        }
      }
    });

    el.nameInput.addEventListener('input', renderPresetChips);

    el.clearSlotsBtn.addEventListener('click', () => {
      el.nameInput.value = '';
      state.chipBufferMode = true;
      renderPresetChips();
      el.nameInput.focus();
    });

    el.speakNameBtn.addEventListener('click', () => {
      el.speakNameBtn.blur();
      speakText(state.nameChars.join(''));
    });

    el.speakCharBtn.addEventListener('click', () => {
      el.speakCharBtn.blur();
      speakText(state.nameChars[state.activeIndex]);
    });

    el.animateAllBtn.addEventListener('click', () => {
      el.animateAllBtn.blur();
      openShowcase();
    });

    el.modeWatchBtn.addEventListener('click', () => {
      el.modeWatchBtn.blur();
      setMode('watch');
    });

    el.modeWriteBtn.addEventListener('click', () => {
      el.modeWriteBtn.blur();
      setMode('write');
    });

    el.playAnimBtn.addEventListener('click', () => {
      el.playAnimBtn.blur();
      togglePlayPause();
    });

    // 空格键播放 / 写完当前一笔后暂停（捕获阶段拦截，避免误触其他按钮）
    const isSpaceWatchActive = (e) => {
      if (e.code !== 'Space' && e.key !== ' ') return false;
      const activeTag = document.activeElement ? document.activeElement.tagName : '';
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return false;
      if (anyModalOpen()) return false;
      return state.mode === 'watch';
    };

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeNamePicker();
        closeVoicePicker();
        el.showcaseModal.classList.add('hidden');
        el.celebrateModal.classList.add('hidden');
        return;
      }
      if (!isSpaceWatchActive(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      togglePlayPause();
    }, true);

    window.addEventListener('keyup', (e) => {
      if (!isSpaceWatchActive(e)) return;
      e.preventDefault();
      e.stopPropagation();
    }, true);

    el.prevStrokeBtn.addEventListener('click', () => {
      el.prevStrokeBtn.blur();
      const target = state.currentStepIndex <= 0 ? 0 : state.currentStepIndex - 1;
      jumpToStroke(target);
    });

    el.nextStrokeBtn.addEventListener('click', () => {
      el.nextStrokeBtn.blur();
      if (!state.charData) return;
      const total = state.charData.strokes.length;
      const target = state.currentStepIndex < 0 ? 0 : Math.min(total - 1, state.currentStepIndex + 1);
      jumpToStroke(target);
    });

    el.speedToggleBtn.addEventListener('click', () => {
      el.speedToggleBtn.blur();
      state.isSlow = !state.isSlow;
      updateSpeedUI();
      if (state.mode === 'watch') {
        loadActiveCharacter();
      }
    });

    el.resetWriteBtn.addEventListener('click', () => {
      el.resetWriteBtn.blur();
      if (state.writer) startQuiz();
    });

    el.hintStrokeBtn.addEventListener('click', () => {
      el.hintStrokeBtn.blur();
      if (!state.writer || !state.charData) return;
      const idx = Math.max(0, state.currentStepIndex);
      if (idx < state.charData.strokes.length) {
        const ch = state.nameChars[state.activeIndex];
        const sName = getStrokeName(ch, idx);
        state.writer.highlightStroke(idx);
        setBearMood('talking', `第 ${idx + 1} 笔：${sName}`, '跟着红线画这一笔吧！', 1200);
        speakStrokeSync(sName);
      }
    });

    el.toggleOutlineBtn.addEventListener('click', () => {
      el.toggleOutlineBtn.blur();
      state.showOutline = !state.showOutline;
      el.outlineBtnText.textContent = state.showOutline ? '描红开' : '描红关';
      if (state.writer) {
        if (state.showOutline) state.writer.showOutline();
        else state.writer.hideOutline();
      }
    });

    el.nextCharBtn.addEventListener('click', () => {
      el.nextCharBtn.blur();
      state.activeIndex = findNextPendingChar();
      renderNameTabs();
      loadActiveCharacter();
    });

    el.soundToggle.addEventListener('click', () => {
      el.soundToggle.blur();
      state.soundEnabled = !state.soundEnabled;
      el.soundOnSvg.classList.toggle('hidden', !state.soundEnabled);
      el.soundOffSvg.classList.toggle('hidden', state.soundEnabled);
      el.soundLabel.textContent = state.soundEnabled ? '有声' : '静音';
      if (!state.soundEnabled) stopCurrentAudio();
    });

    el.closeShowcaseBtn.addEventListener('click', () => {
      el.showcaseModal.classList.add('hidden');
      syncBoardSizeIfChanged();
    });
    el.showcaseModal.addEventListener('click', (e) => {
      if (e.target === el.showcaseModal) {
        el.showcaseModal.classList.add('hidden');
        syncBoardSizeIfChanged();
      }
    });
    el.replayShowcaseBtn.addEventListener('click', playShowcaseSequence);

    el.practiceAgainBtn.addEventListener('click', () => {
      el.celebrateModal.classList.add('hidden');
      state.completed.clear();
      state.activeIndex = 0;
      renderNameTabs();
      loadActiveCharacter();
    });

    el.closeCelebrateBtn.addEventListener('click', () => {
      el.celebrateModal.classList.add('hidden');
      openNamePicker();
    });

    // 窗口旋转 / 尺寸自适应（仅当米字格宽度实际变化 >= 8px 且无弹窗打开时重绘，忽略手机软键盘高度变化）
    let resizeTimer = null;
    const scheduleBoardResizeCheck = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        updatePlayButtonUI();
        syncBoardSizeIfChanged();
      }, 180);
    };

    window.addEventListener('resize', scheduleBoardResizeCheck, { passive: true });
    window.addEventListener('orientationchange', scheduleBoardResizeCheck, { passive: true });

    if (window.matchMedia) {
      const coarseMql = window.matchMedia('(pointer: coarse)');
      if (typeof coarseMql.addEventListener === 'function') {
        coarseMql.addEventListener('change', updatePlayButtonUI);
      }
    }
  }

  function syncBoardSizeIfChanged() {
    if (anyModalOpen() || !state.writer || !state.charData) return;
    const newWidth = getBoardSize();
    if (!newWidth || Math.abs(newWidth - state.lastBoardWidth) < 8) return;

    const isActiveQuiz =
      state.mode === 'write' &&
      state.writer._quiz &&
      state.writer._quiz._isActive &&
      state.currentStepIndex > 0;
    loadActiveCharacter({
      resumeStrokeIdx: isActiveQuiz ? state.currentStepIndex : 0
    });
  }

  // 初始化
  setupMobileAudioUnlock();
  loadSavedState();
  initPinyinEngine();
  updateVoiceButtonUI();
  preloadVoiceChars(state.nameChars);
  updateSpeedUI();
  updatePlayButtonUI();
  renderSavedNames();
  renderPresetChips();
  renderNameTabs();
  bindEvents();
  loadActiveCharacter();
})();
