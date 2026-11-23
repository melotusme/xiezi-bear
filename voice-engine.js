((global) => {
  'use strict';

  const STORAGE_KEY_VOICE = 'hanzi_name_voice_v1';
  const STORAGE_KEY_SYS_VOICE = 'hanzi_name_sys_voice_v1';

  const BUILTIN_AUDIO_CHARS = new Set([
    '王', '李', '张', '林',
    '小', '明', '红', '华', '乐',
    '天', '文', '星', '一', '宝'
  ]);

  const BUILTIN_AUDIO_STROKES = new Set([
    '横', '竖', '撇', '捺', '点', '提',
    '竖钩', '横折', '横钩', '横折钩', '撇折', '撇点',
    '竖弯钩', '横撇', '竖提', '横折提', '折笔',
    '卧钩', '斜钩', '弯钩', '竖折', '竖弯',
    '竖折折钩', '横折弯钩', '横折折撇', '横撇弯钩', '横斜钩'
  ]);

  // 内置兜底拼音（在 pinyin-pro 尚未加载完成或离线时即可立即使用）
  const BUILTIN_CHAR_PINYIN = {
    '王': 'wang2', '李': 'li3', '张': 'zhang1', '林': 'lin2',
    '小': 'xiao3', '明': 'ming2', '红': 'hong2', '华': 'hua2', '乐': 'le4',
    '天': 'tian1', '文': 'wen2', '星': 'xing1', '一': 'yi1', '宝': 'bao3'
  };

  // 27 种笔画名称用到的 12 个基础汉字音节
  const BUILTIN_STROKE_CHAR_PINYIN = {
    '横': 'heng2',
    '竖': 'shu4',
    '撇': 'pie3',
    '捺': 'na4',
    '点': 'dian3',
    '提': 'ti2',
    '钩': 'gou1',
    '折': 'zhe2',
    '弯': 'wan1',
    '卧': 'wo4',
    '斜': 'xie2',
    '笔': 'bi3'
  };

  const VOICE_PROFILES = [
    {
      id: 'human',
      name: '开源真人',
      shortName: '开源真人',
      icon: '🎙️',
      tag: '开源录音',
      desc: 'Shtooka 录音室真人普通话（CC-BY-SA），覆盖 2 万+汉字与全部笔画'
    },
    {
      id: 'yunxia',
      name: '小熊童声',
      shortName: '小熊童声',
      icon: '🐻',
      tag: '可爱童声',
      desc: '软萌活泼童声报笔画，生僻字自动衔接开源真人发音'
    },
    {
      id: 'xiaoyi',
      name: '温柔姐姐',
      shortName: '温柔姐姐',
      icon: '🌸',
      tag: '亲切女声',
      desc: '温暖明快女声讲笔顺，生僻字自动衔接开源真人发音'
    },
    {
      id: 'yunxi',
      name: '阳光哥哥',
      shortName: '阳光哥哥',
      icon: '☀️',
      tag: '温暖男声',
      desc: '清朗自然男声伴读，生僻字自动衔接开源真人发音'
    },
    {
      id: 'system',
      name: '系统语音',
      shortName: '系统语音',
      icon: '📱',
      tag: '本机离线',
      desc: '调用本机浏览器自带中文语音，完全离线可用'
    }
  ];

  const LOCAL_PACK_IDS = new Set(['yunxia', 'xiaoyi', 'yunxi']);
  const PROFILE_MAP = new Map(VOICE_PROFILES.map((p) => [p.id, p]));

  const CDN_FETCH_TIMEOUT_MS = 4500;
  const TRIM_THRESHOLD_DB = -38;
  const TRIM_MARGIN_MS = 20;
  const STROKE_SYLLABLE_GAP_SEC = 0.025;
  const NAME_CHAR_GAP_SEC = 0.07;

  let currentVoiceId = loadStoredVoiceId();
  let currentSysVoiceURI = loadStoredSysVoiceURI();

  let audioCtx = null;
  let audioUnlockBound = false;
  let playToken = 0;
  let currentHtmlAudio = null;
  const activeSources = new Set();

  // 缓存：{ buffer: AudioBuffer, gain: number } | null
  const syllableBufferCache = new Map();
  // 缓存成功加载过的直接 URL（用于无 Web Audio 时的 HTMLAudio 降级）
  const syllableUrlCache = new Map();

  function safeStorageGet(key, fallback = '') {
    try {
      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(key);
        return val !== null ? val : fallback;
      }
    } catch (_) {}
    return fallback;
  }

  function safeStorageSet(key, val) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, val);
      }
    } catch (_) {}
  }

  function loadStoredVoiceId() {
    const stored = safeStorageGet(STORAGE_KEY_VOICE, 'human');
    return PROFILE_MAP.has(stored) ? stored : 'human';
  }

  function loadStoredSysVoiceURI() {
    return safeStorageGet(STORAGE_KEY_SYS_VOICE, '');
  }

  function getProfiles() {
    return VOICE_PROFILES.map((p) => ({ ...p }));
  }

  function getVoiceId() {
    return currentVoiceId;
  }

  function getCurrentProfile() {
    const found = PROFILE_MAP.get(currentVoiceId) || VOICE_PROFILES[0];
    return { ...found };
  }

  function setVoiceId(id) {
    if (!PROFILE_MAP.has(id)) return getCurrentProfile();
    currentVoiceId = id;
    safeStorageSet(STORAGE_KEY_VOICE, id);
    return getCurrentProfile();
  }

  function getSystemVoiceURI() {
    return currentSysVoiceURI;
  }

  function setSystemVoiceURI(uri) {
    currentSysVoiceURI = typeof uri === 'string' ? uri : '';
    safeStorageSet(STORAGE_KEY_SYS_VOICE, currentSysVoiceURI);
    return currentSysVoiceURI;
  }

  function getSystemVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    const raw = window.speechSynthesis.getVoices() || [];
    const zh = raw.filter((v) => /zh|cmn/i.test(v.lang || ''));
    const score = (v) => {
      const name = v.name || '';
      if (/Xiaoxiao|Xiaoyi|Yunxi|Yunxia|Natural|Online/i.test(name)) return 0;
      if (/Tingting|Sinji|Meijia|Google/i.test(name)) return 1;
      if (/zh-CN|zh_CN/i.test(v.lang || '')) return 2;
      return 3;
    };
    return zh
      .slice()
      .sort((a, b) => score(a) - score(b))
      .map((v) => ({
        voiceURI: v.voiceURI || v.name,
        name: v.name,
        lang: v.lang,
        localService: Boolean(v.localService),
        default: Boolean(v.default)
      }));
  }

  function resolveBestSpeechVoice() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const raw = window.speechSynthesis.getVoices() || [];
    const zh = raw.filter((v) => /zh|cmn/i.test(v.lang || ''));
    if (!zh.length) return null;
    if (currentSysVoiceURI) {
      const exact = zh.find((v) => v.voiceURI === currentSysVoiceURI || v.name === currentSysVoiceURI);
      if (exact) return exact;
    }
    const preferred = zh.find((v) => /Xiaoxiao|Xiaoyi|Yunxi|Yunxia|Natural|Online|Google|Tingting/i.test(v.name || ''));
    return preferred || zh[0];
  }

  // Web Audio 上下文管理与移动端静音解锁
  function getAudioCtx() {
    if (typeof window === 'undefined') return null;
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

  function unlockAudio() {
    const ctx = getAudioCtx();
    if (typeof document !== 'undefined' && !audioUnlockBound) {
      audioUnlockBound = true;
      const unlock = () => {
        try {
          const c = getAudioCtx();
          if (!c) return;
          const playSilentTick = () => {
            try {
              const buf = c.createBuffer(1, 1, 22050);
              const src = c.createBufferSource();
              src.buffer = buf;
              src.connect(c.destination);
              src.start(0);
            } catch (_) {}
          };
          if (c.state === 'suspended') {
            c.resume()
              .then(() => {
                playSilentTick();
                if (c.state === 'running') cleanup();
              })
              .catch(() => {});
          } else {
            playSilentTick();
            if (c.state === 'running') cleanup();
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
    return ctx;
  }

  function stop() {
    playToken += 1;
    if (currentHtmlAudio) {
      try {
        currentHtmlAudio.pause();
        currentHtmlAudio.currentTime = 0;
      } catch (_) {}
      currentHtmlAudio = null;
    }
    activeSources.forEach((src) => {
      try {
        src.onended = null;
        src.stop();
        src.disconnect();
      } catch (_) {}
    });
    activeSources.clear();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
  }

  // 拼音标准化（转小写、ü -> v、确保声调 1-5）
  function normalizePinyinNum(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let s = raw.trim().toLowerCase();
    s = s.replace(/ü/g, 'v').replace(/u:/g, 'v');
    s = s.replace(/[^a-z0-5]/g, '');
    if (!s) return '';
    const match = /^([a-z]+)([0-5])?$/.exec(s);
    if (!match) return '';
    const base = match[1];
    let tone = match[2] || '5';
    if (tone === '0') tone = '5';
    return `${base}${tone}`;
  }

  // hugolpz/audio-cmn (Shtooka CC-BY-SA) URL 构造与已知命名修正
  function getAudioCmnUrls(pinyinNum) {
    const norm = normalizePinyinNum(pinyinNum);
    if (!norm) return [];
    // 实测 hugolpz/audio-cmn 仓库中 ju4 文件名为 cmn-jv4.mp3
    const filePy = norm === 'ju4' ? 'jv4' : norm;
    return [
      `https://fastly.jsdelivr.net/gh/hugolpz/audio-cmn@master/64k/syllabs/cmn-${filePy}.mp3`,
      `https://cdn.jsdelivr.net/gh/hugolpz/audio-cmn@master/64k/syllabs/cmn-${filePy}.mp3`,
      `https://raw.githubusercontent.com/hugolpz/audio-cmn/master/64k/syllabs/cmn-${filePy}.mp3`
    ];
  }

  // davinfifield/mp3-chinese-pinyin-sound (Unlicense) 兜底 URL 构造（v -> uu）
  function getDavinfifieldUrls(pinyinNum) {
    const norm = normalizePinyinNum(pinyinNum);
    if (!norm) return [];
    const davinPy = norm
      .replace(/^lve/, 'luue')
      .replace(/^nve/, 'nuue')
      .replace(/^lv/, 'luu')
      .replace(/^nv/, 'nuu')
      .replace(/v/g, 'uu');
    const urls = [
      `https://fastly.jsdelivr.net/gh/davinfifield/mp3-chinese-pinyin-sound@master/mp3/${davinPy}.mp3`,
      `https://cdn.jsdelivr.net/gh/davinfifield/mp3-chinese-pinyin-sound@master/mp3/${davinPy}.mp3`
    ];
    // davinfifield 轻声较少，若为 5 声再补一个 1 声兜底
    if (davinPy.endsWith('5')) {
      const base = davinPy.slice(0, -1);
      urls.push(`https://fastly.jsdelivr.net/gh/davinfifield/mp3-chinese-pinyin-sound@master/mp3/${base}1.mp3`);
    }
    return urls;
  }

  function getStrokeSyllables(strokeName) {
    if (!strokeName || typeof strokeName !== 'string') return [];
    const chars = Array.from(strokeName);
    const out = [];
    for (const ch of chars) {
      let py = BUILTIN_STROKE_CHAR_PINYIN[ch] || BUILTIN_CHAR_PINYIN[ch] || '';
      if (!py && global.StrokeLoader && typeof global.StrokeLoader.getCharPinyinNum === 'function') {
        py = global.StrokeLoader.getCharPinyinNum(ch) || '';
      }
      const norm = normalizePinyinNum(py);
      if (!norm) return [];
      out.push(norm);
    }
    return out;
  }

  async function ensurePinyinReadyWithTimeout(timeoutMs = 1500) {
    const loader = global.StrokeLoader;
    if (!loader || typeof loader.ensurePinyinReady !== 'function') return;
    try {
      await Promise.race([
        loader.ensurePinyinReady(),
        new Promise((resolve) => setTimeout(resolve, timeoutMs))
      ]);
    } catch (_) {}
  }

  function resolveCharPinyinsSync(chars) {
    if (!chars || !chars.length) return [];
    const loader = global.StrokeLoader;
    let fromLoader = null;
    if (loader) {
      if (chars.length > 1 && typeof loader.getNamePinyinNums === 'function') {
        try {
          fromLoader = loader.getNamePinyinNums(chars);
        } catch (_) {
          fromLoader = null;
        }
      } else if (chars.length === 1 && typeof loader.getCharPinyinNum === 'function') {
        try {
          const single = loader.getCharPinyinNum(chars[0]);
          if (single) fromLoader = [single];
        } catch (_) {
          fromLoader = null;
        }
      }
    }

    return chars.map((ch, idx) => {
      const candidate = Array.isArray(fromLoader) && fromLoader[idx] ? normalizePinyinNum(fromLoader[idx]) : '';
      if (candidate) return candidate;
      return normalizePinyinNum(BUILTIN_CHAR_PINYIN[ch] || BUILTIN_STROKE_CHAR_PINYIN[ch] || '');
    });
  }

  async function resolveCharPinyins(chars) {
    let list = resolveCharPinyinsSync(chars);
    if (list.some((p) => !p)) {
      await ensurePinyinReadyWithTimeout(1500);
      list = resolveCharPinyinsSync(chars);
    }
    return list;
  }

  // 裁剪音频首尾静音（RMS < -38dB）并加 5ms 微淡入淡出，消除卡顿与爆音
  function trimAudioBuffer(ctx, buffer, thresholdDb = TRIM_THRESHOLD_DB, marginMs = TRIM_MARGIN_MS) {
    if (!ctx || !buffer || !buffer.length) {
      return { buffer, gain: 1 };
    }
    const sr = buffer.sampleRate || 24000;
    const ch0 = buffer.getChannelData(0);
    const len = ch0.length;
    const win = Math.max(1, Math.round(sr * 0.005)); // 5ms 滑窗
    const thresh = Math.pow(10, thresholdDb / 20);

    let firstActive = -1;
    let lastActive = -1;
    let peak = 0;

    for (let i = 0; i < len; i += win) {
      const end = Math.min(len, i + win);
      let sumSq = 0;
      for (let j = i; j < end; j += 1) {
        const v = ch0[j];
        const av = Math.abs(v);
        if (av > peak) peak = av;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / (end - i));
      if (rms >= thresh) {
        if (firstActive === -1) firstActive = i;
        lastActive = end;
      }
    }

    // 柔和音量均衡（若兜底源如 davinfifield 录得过轻，则适当增益到清晰响度）
    const gain = peak > 0.01 && peak < 0.28 ? Math.min(4.5, 0.72 / peak) : 1;

    if (firstActive === -1 || lastActive <= firstActive) {
      return { buffer, gain };
    }

    const marginSamples = Math.round((sr * marginMs) / 1000);
    const start = Math.max(0, firstActive - marginSamples);
    const stopIdx = Math.min(len, lastActive + marginSamples);
    const trimmedLen = stopIdx - start;

    if (trimmedLen <= 0 || trimmedLen >= len - win * 2) {
      return { buffer, gain };
    }

    const numChannels = buffer.numberOfChannels || 1;
    const out = ctx.createBuffer(numChannels, trimmedLen, sr);
    const fadeSamples = Math.min(Math.round(sr * 0.005), Math.floor(trimmedLen / 4));

    for (let c = 0; c < numChannels; c += 1) {
      const srcData = buffer.getChannelData(c);
      const dstData = out.getChannelData(c);
      for (let i = 0; i < trimmedLen; i += 1) {
        let sample = srcData[start + i];
        if (fadeSamples > 0) {
          if (i < fadeSamples) sample *= i / fadeSamples;
          else if (i >= trimmedLen - fadeSamples) sample *= (trimmedLen - 1 - i) / fadeSamples;
        }
        dstData[i] = sample;
      }
    }

    return { buffer: out, gain };
  }

  async function fetchArrayBufferWithTimeout(url, timeoutMs = CDN_FETCH_TIMEOUT_MS) {
    if (typeof fetch !== 'function') return null;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      const res = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        signal: ctrl ? ctrl.signal : undefined
      });
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      return arr && arr.byteLength > 256 ? arr : null;
    } catch (_) {
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function decodeMp3Buffer(ctx, arrayBuf) {
    if (!ctx || !arrayBuf) return null;
    // 复制一份，防止旧版浏览器 detach buffer
    const copy = arrayBuf.slice(0);
    try {
      return await new Promise((resolve, reject) => {
        const ret = ctx.decodeAudioData(copy, resolve, reject);
        if (ret && typeof ret.then === 'function') {
          ret.then(resolve, reject);
        }
      });
    } catch (_) {
      return null;
    }
  }

  function loadHumanSyllableBuffer(pinyinNum) {
    const norm = normalizePinyinNum(pinyinNum);
    if (!norm) return Promise.resolve(null);
    if (syllableBufferCache.has(norm)) {
      return syllableBufferCache.get(norm);
    }

    const promise = (async () => {
      const ctx = getAudioCtx();
      const candidates = [
        ...getAudioCmnUrls(norm),
        ...getDavinfifieldUrls(norm)
      ];
      for (const url of candidates) {
        const arr = await fetchArrayBufferWithTimeout(url);
        if (!arr) continue;
        syllableUrlCache.set(norm, url);
        if (ctx) {
          const decoded = await decodeMp3Buffer(ctx, arr);
          if (decoded) {
            return trimAudioBuffer(ctx, decoded, TRIM_THRESHOLD_DB, TRIM_MARGIN_MS);
          }
        }
      }
      // 失败时不永久缓存 null，允许网络恢复后重试
      syllableBufferCache.delete(norm);
      return null;
    })();

    syllableBufferCache.set(norm, promise);
    return promise;
  }

  function playHtmlAudio(src, myToken, timeoutMs = 2400) {
    return new Promise((resolve) => {
      if (myToken !== playToken || typeof Audio === 'undefined') {
        resolve(false);
        return;
      }
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      try {
        const audio = new Audio(src);
        currentHtmlAudio = audio;
        const timer = setTimeout(() => {
          if (currentHtmlAudio === audio) currentHtmlAudio = null;
          done(true);
        }, timeoutMs);

        audio.onended = () => {
          clearTimeout(timer);
          if (currentHtmlAudio === audio) currentHtmlAudio = null;
          done(true);
        };
        audio.onerror = () => {
          clearTimeout(timer);
          if (currentHtmlAudio === audio) currentHtmlAudio = null;
          done(false);
        };
        const p = audio.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            clearTimeout(timer);
            if (currentHtmlAudio === audio) currentHtmlAudio = null;
            done(false);
          });
        }
      } catch (_) {
        done(false);
      }
    });
  }

  async function playHumanSyllableSequence(syllables, gapSec, myToken, isCancelledFn) {
    if (!syllables || !syllables.length) return false;
    const isCancelled = () => myToken !== playToken || (typeof isCancelledFn === 'function' && isCancelledFn());
    if (isCancelled()) return true;

    const ctx = getAudioCtx();
    if (ctx) {
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch (_) {}
      }
      const entries = await Promise.all(syllables.map((sy) => loadHumanSyllableBuffer(sy)));
      if (isCancelled()) return true;

      if (entries.every((e) => e && e.buffer)) {
        return await new Promise((resolve) => {
          let settled = false;
          const finish = (ok) => {
            if (settled) return;
            settled = true;
            resolve(ok);
          };

          const startAt = ctx.currentTime + 0.015;
          let cursor = startAt;
          let remaining = entries.length;
          const created = [];

          for (let i = 0; i < entries.length; i += 1) {
            const { buffer, gain } = entries[i];
            const src = ctx.createBufferSource();
            src.buffer = buffer;

            if (gain !== 1) {
              const gainNode = ctx.createGain();
              gainNode.gain.setValueAtTime(gain, cursor);
              src.connect(gainNode);
              gainNode.connect(ctx.destination);
            } else {
              src.connect(ctx.destination);
            }

            activeSources.add(src);
            created.push(src);

            src.onended = () => {
              activeSources.delete(src);
              remaining -= 1;
              if (remaining <= 0) finish(true);
            };

            try {
              src.start(cursor);
            } catch (_) {
              activeSources.delete(src);
              remaining -= 1;
            }
            cursor += buffer.duration + gapSec;
          }

          if (remaining <= 0) {
            finish(true);
            return;
          }

          const totalMs = Math.max(400, Math.round((cursor - startAt) * 1000) + 350);
          setTimeout(() => {
            created.forEach((s) => activeSources.delete(s));
            finish(true);
          }, totalMs);
        });
      }
    }

    // 若无 Web Audio 或解码失败，尝试直接用 HTMLAudio 播放已验证 URL
    let playedAny = false;
    for (const sy of syllables) {
      if (isCancelled()) return true;
      const urls = syllableUrlCache.has(sy)
        ? [syllableUrlCache.get(sy)]
        : [...getAudioCmnUrls(sy), ...getDavinfifieldUrls(sy)];
      let ok = false;
      for (const u of urls) {
        if (isCancelled()) return true;
        ok = await playHtmlAudio(u, myToken, 1800);
        if (ok) {
          syllableUrlCache.set(sy, u);
          playedAny = true;
          break;
        }
      }
      if (!ok) return false;
    }
    return playedAny;
  }

  function speakWithSystemTTS(text, myToken, rate = 0.92) {
    return new Promise((resolve) => {
      if (myToken !== playToken || typeof window === 'undefined' || !('speechSynthesis' in window) || !text) {
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
        const best = resolveBestSpeechVoice();
        if (best) utter.voice = best;
        utter.rate = rate;
        utter.pitch = 1.0;
        utter.onend = done;
        utter.onerror = done;
        window.speechSynthesis.speak(utter);
        setTimeout(done, Math.max(1800, text.length * 700));
      } catch (_) {
        done();
      }
    });
  }

  function preloadChars(chars) {
    const list = Array.isArray(chars) ? chars : Array.from(chars || '');
    if (!list.length) return;
    // 后台预热汉字音节 + 基础高频笔画音节
    resolveCharPinyins(list).then((pinyins) => {
      pinyins.forEach((py) => {
        if (py) loadHumanSyllableBuffer(py).catch(() => {});
      });
    }).catch(() => {});

    if (currentVoiceId === 'human') {
      Object.values(BUILTIN_STROKE_CHAR_PINYIN).forEach((py) => {
        loadHumanSyllableBuffer(py).catch(() => {});
      });
    }
  }

  async function speakTextWithVoice(voiceId, text, myToken, isCancelledFn) {
    const isCancelled = () => myToken !== playToken || (typeof isCancelledFn === 'function' && isCancelledFn());
    const chars = Array.from(text || '').filter((c) => /\S/.test(c));
    if (!chars.length || isCancelled()) return;

    if (voiceId === 'system') {
      await speakWithSystemTTS(chars.join(''), myToken, 0.9);
      return;
    }

    // 本地语音包（yunxia / xiaoyi / yunxi）：若全部属于 14 个内置预设字，直接播放同音色本地 MP3
    if (LOCAL_PACK_IDS.has(voiceId) && chars.every((c) => BUILTIN_AUDIO_CHARS.has(c))) {
      for (const ch of chars) {
        if (isCancelled()) return;
        const ok = await playHtmlAudio(`audio/${voiceId}/char_${ch}.mp3`, myToken, 1600);
        if (!ok) break;
      }
      return;
    }

    // 开源真人模式（以及本地包遇到非预设任意汉字时）：统一使用开源真人 Shtooka 音节库无缝拼接
    const pinyins = await resolveCharPinyins(chars);
    if (isCancelled()) return;
    if (pinyins.length === chars.length && pinyins.every(Boolean)) {
      const ok = await playHumanSyllableSequence(pinyins, NAME_CHAR_GAP_SEC, myToken, isCancelledFn);
      if (ok || isCancelled()) return;
    }

    // 离线降级：若为单字且有本地包文件则退回 xiaoyi，否则系统语音
    const fallbackPack = LOCAL_PACK_IDS.has(voiceId) ? voiceId : 'xiaoyi';
    if (chars.every((c) => BUILTIN_AUDIO_CHARS.has(c))) {
      for (const ch of chars) {
        if (isCancelled()) return;
        await playHtmlAudio(`audio/${fallbackPack}/char_${ch}.mp3`, myToken, 1600);
      }
      return;
    }

    await speakWithSystemTTS(chars.join(''), myToken, 0.9);
  }

  async function speakStrokeWithVoice(voiceId, strokeName, myToken) {
    if (!strokeName || myToken !== playToken) return;

    if (voiceId === 'system') {
      await speakWithSystemTTS(strokeName, myToken, 1.0);
      return;
    }

    if (LOCAL_PACK_IDS.has(voiceId) && BUILTIN_AUDIO_STROKES.has(strokeName)) {
      const ok = await playHtmlAudio(`audio/${voiceId}/stroke_${strokeName}.mp3`, myToken, 1800);
      if (ok || myToken !== playToken) return;
    }

    if (voiceId === 'human') {
      const sylls = getStrokeSyllables(strokeName);
      if (sylls.length > 0) {
        const ok = await playHumanSyllableSequence(sylls, STROKE_SYLLABLE_GAP_SEC, myToken);
        if (ok || myToken !== playToken) return;
      }
      // 离线降级到温暖女声 xiaoyi 本地笔画包
      if (BUILTIN_AUDIO_STROKES.has(strokeName)) {
        const ok = await playHtmlAudio(`audio/xiaoyi/stroke_${strokeName}.mp3`, myToken, 1800);
        if (ok || myToken !== playToken) return;
      }
    }

    await speakWithSystemTTS(strokeName, myToken, 1.0);
  }

  async function speakText(text, isCancelledFn) {
    stop();
    const myToken = playToken;
    await speakTextWithVoice(currentVoiceId, text, myToken, isCancelledFn);
  }

  async function speakStroke(strokeName) {
    stop();
    const myToken = playToken;
    await speakStrokeWithVoice(currentVoiceId, strokeName, myToken);
  }

  async function previewVoice(voiceId, sampleChar = '王') {
    const targetId = PROFILE_MAP.has(voiceId) ? voiceId : currentVoiceId;
    stop();
    const myToken = playToken;
    const ch = (Array.from(sampleChar || '')[0]) || '王';

    await speakTextWithVoice(targetId, ch, myToken);
    if (myToken !== playToken) return;

    await new Promise((resolve) => setTimeout(resolve, 140));
    if (myToken !== playToken) return;

    await speakStrokeWithVoice(targetId, '横折钩', myToken);
  }

  const VoiceEngine = {
    VOICE_PROFILES,
    getProfiles,
    getCurrentProfile,
    getVoiceId,
    setVoiceId,
    getSystemVoices,
    getSystemVoiceURI,
    setSystemVoiceURI,
    getAudioCtx,
    unlockAudio,
    stop,
    preloadChars,
    speakText,
    speakStroke,
    previewVoice,
    // 便于自动化测试校验拼音与 URL 映射
    _internals: {
      normalizePinyinNum,
      getAudioCmnUrls,
      getDavinfifieldUrls,
      getStrokeSyllables,
      trimAudioBuffer,
      BUILTIN_AUDIO_CHARS,
      BUILTIN_AUDIO_STROKES
    }
  };

  global.VoiceEngine = VoiceEngine;
})(typeof window !== 'undefined' ? window : globalThis);
