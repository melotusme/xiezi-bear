import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();

function createMemoryStorage(maxItems = Infinity) {
  const store = new Map();
  return {
    getItem(k) {
      return store.has(k) ? store.get(k) : null;
    },
    setItem(k, v) {
      if (!store.has(k) && store.size >= maxItems) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      store.set(k, String(v));
    },
    removeItem(k) {
      store.delete(k);
    },
    clear() {
      store.clear();
    },
    get size() {
      return store.size;
    },
    keys() {
      return Array.from(store.keys());
    }
  };
}

function createFakeAudioContext(initialState = 'running') {
  const listeners = new Map();
  const sources = [];
  const gains = [];
  const ctx = {
    state: initialState,
    currentTime: 0,
    destination: { id: 'dest' },
    resumeCalls: 0,
    resume() {
      this.resumeCalls += 1;
      this.state = 'running';
      return Promise.resolve();
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    dispatch(type) {
      const set = listeners.get(type);
      if (set) set.forEach((fn) => fn());
    },
    createBuffer(channels, length, sampleRate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        duration: length / sampleRate,
        getChannelData(c) {
          return data[c];
        }
      };
    },
    createBufferSource() {
      const src = {
        buffer: null,
        onended: null,
        started: false,
        stopped: false,
        disconnected: false,
        connect() {},
        disconnect() {
          this.disconnected = true;
        },
        start() {
          this.started = true;
        },
        stop() {
          this.stopped = true;
        }
      };
      sources.push(src);
      return src;
    },
    createGain() {
      const g = {
        disconnected: false,
        gain: { setValueAtTime() {} },
        connect() {},
        disconnect() {
          this.disconnected = true;
        }
      };
      gains.push(g);
      return g;
    },
    decodeAudioData(arr, resolve) {
      const buf = ctx.createBuffer(1, 2400, 24000);
      buf.getChannelData(0).fill(0.5);
      if (resolve) resolve(buf);
      return Promise.resolve(buf);
    },
    _sources: sources,
    _gains: gains
  };
  return ctx;
}

function createBrowserSandbox(overrides = {}) {
  const localStorage = overrides.localStorage || createMemoryStorage();
  const sessionStorage = overrides.sessionStorage || createMemoryStorage();
  const docListeners = new Map();
  const doc = {
    visibilityState: 'visible',
    head: {
      appendChild(el) {
        if (overrides.onAppendScript) overrides.onAppendScript(el);
      }
    },
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        remove() {
          this.removed = true;
        }
      };
    },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, new Set());
      docListeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      const set = docListeners.get(type);
      if (set) set.delete(fn);
    },
    _listeners: docListeners
  };

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    AbortController,
    URL,
    localStorage,
    sessionStorage,
    document: doc,
    navigator: overrides.navigator || { onLine: true },
    fetch: overrides.fetch || (async () => ({ ok: false, status: 404 })),
    Audio: overrides.Audio,
    AudioContext: overrides.AudioContext,
    speechSynthesis: overrides.speechSynthesis,
    SpeechSynthesisUtterance: overrides.SpeechSynthesisUtterance
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return vm.createContext(sandbox);
}

function loadScriptInto(ctx, filename) {
  const code = fs.readFileSync(path.join(ROOT, filename), 'utf-8');
  vm.runInContext(code, ctx, { filename });
}

const SAMPLE_CHAR_DATA = {
  strokes: ['M 100 200 L 800 200 Z'],
  medians: [[[100, 200], [800, 200]]]
};

test('stroke-loader: builtin tier loads offline with zero network calls', async () => {
  let fetchCalls = 0;
  const ctx = createBrowserSandbox({
    navigator: { onLine: false },
    fetch: async () => {
      fetchCalls += 1;
      return { ok: false, status: 500 };
    }
  });
  loadScriptInto(ctx, 'stroke-data.js');
  loadScriptInto(ctx, 'stroke-loader.js');

  const data = await ctx.StrokeLoader.loadCharData('王');
  assert.equal(data.source, 'builtin');
  assert.equal(data.strokes.length, 4);
  assert.equal(fetchCalls, 0);
});

test('stroke-loader: 404 on Tier 1 skips duplicate mirror and falls back to Tier 2', async () => {
  const requested = [];
  const ctx = createBrowserSandbox({
    fetch: async (url) => {
      requested.push(url);
      if (url.includes('hanzi-writer-data@2.0')) {
        return { ok: false, status: 404 };
      }
      if (url.includes('hanzi-writer-data-acjk@1.0.0')) {
        return { ok: true, status: 200, json: async () => SAMPLE_CHAR_DATA };
      }
      return { ok: false, status: 404 };
    }
  });
  loadScriptInto(ctx, 'stroke-loader.js');

  const data = await ctx.StrokeLoader.loadCharData('玥');
  assert.equal(data.source, 'hanzi-writer-data-acjk');
  const tier1Calls = requested.filter((u) => u.includes('hanzi-writer-data@2.0'));
  assert.equal(tier1Calls.length, 1, 'should skip second mirror after 404');
});

test('stroke-loader: fetchBodyWithTimeout aborts stalled response body stream', async () => {
  let aborted = false;
  const ctx = createBrowserSandbox({
    fetch: async (_url, opts) => ({
      ok: true,
      status: 200,
      json: () =>
        new Promise((_resolve, reject) => {
          opts.signal.addEventListener('abort', () => {
            aborted = true;
            reject(new Error('Aborted'));
          });
        })
    })
  });
  loadScriptInto(ctx, 'stroke-loader.js');

  await assert.rejects(
    () => ctx.StrokeLoader._internals.fetchBodyWithTimeout('https://example.test/a.json', 'json', 40),
    /Aborted/
  );
  assert.equal(aborted, true);
});

test('stroke-loader: ensureIdsMap and ensurePinyinReady recover after transient failure', async () => {
  let idsAttempt = 0;
  let scriptAttempt = 0;
  const ctx = createBrowserSandbox({
    fetch: async (url) => {
      if (url.includes('IDS.TXT')) {
        idsAttempt += 1;
        if (idsAttempt <= 3) return { ok: false, status: 503 };
        return { ok: true, status: 200, text: async () => 'U+73A5\t玥\t^⿰王月$(G)\n' };
      }
      return { ok: false, status: 404 };
    },
    onAppendScript(script) {
      scriptAttempt += 1;
      setTimeout(() => {
        if (scriptAttempt <= 3) {
          script.onerror();
        } else {
          ctx.pinyinPro = { pinyin: () => 'yue4' };
          script.onload();
        }
      }, 5);
    }
  });
  loadScriptInto(ctx, 'stroke-loader.js');

  const firstIds = await ctx.StrokeLoader._internals.ensureIdsMap();
  assert.equal(firstIds.size, 0);
  const secondIds = await ctx.StrokeLoader._internals.ensureIdsMap();
  assert.equal(secondIds.get('玥'), '⿰王月');

  const firstPy = await ctx.StrokeLoader.ensurePinyinReady();
  assert.equal(firstPy, false);
  const secondPy = await ctx.StrokeLoader.ensurePinyinReady();
  assert.equal(secondPy, true);
});

test('stroke-loader: concurrent inFlight dedup, persistent localStorage LRU & quota eviction', async () => {
  let fetchCount = 0;
  const storage = createMemoryStorage(4); // tight quota: index + 3 chars max
  const ctx = createBrowserSandbox({
    localStorage: storage,
    fetch: async () => {
      fetchCount += 1;
      await new Promise((r) => setTimeout(r, 15));
      return { ok: true, status: 200, json: async () => SAMPLE_CHAR_DATA };
    }
  });
  loadScriptInto(ctx, 'stroke-loader.js');

  const [a, b] = await Promise.all([
    ctx.StrokeLoader.loadCharData('汐'),
    ctx.StrokeLoader.loadCharData('汐')
  ]);
  assert.equal(fetchCount, 1, 'concurrent loads of same char must deduplicate');
  assert.deepEqual(a.strokes, b.strokes);

  // Load 4 more distinct chars to force LRU eviction under quota
  for (const ch of ['芃', '琂', '淏', '宸']) {
    await ctx.StrokeLoader.loadCharData(ch);
  }
  assert.ok(storage.getItem('xiezi_stroke_v1_宸'), 'newest char persisted');

  // Clear memory cache, go offline, and verify persisted char still loads offline
  ctx.StrokeLoader._internals.clearCaches();
  ctx.navigator.onLine = false;
  const offlineRes = await ctx.StrokeLoader.loadCharData('宸');
  assert.equal(offlineRes.strokes.length, 1);
});

test('voice-engine: pinyin normalization, URL mapping & stroke syllables', () => {
  const ctx = createBrowserSandbox();
  loadScriptInto(ctx, 'voice-engine.js');
  const { normalizePinyinNum, getAudioCmnUrls, getDavinfifieldUrls, getStrokeSyllables, encodeLocalAudioPath } =
    ctx.VoiceEngine._internals;

  assert.equal(normalizePinyinNum('LÜ3'), 'lv3');
  assert.equal(normalizePinyinNum('de0'), 'de5');
  assert.match(getAudioCmnUrls('ju4')[0], /cmn-jv4\.mp3$/);
  assert.match(getDavinfifieldUrls('lv3')[0], /\/luu3\.mp3$/);
  assert.deepEqual(Array.from(getStrokeSyllables('横折钩')), ['heng2', 'zhe2', 'gou1']);
  assert.equal(
    encodeLocalAudioPath('yunxia', 'char', '王'),
    `audio/yunxia/char_${encodeURIComponent('王')}.mp3`
  );
});

test('voice-engine: onSystemVoicesChanged notifies and unsubscribes cleanly', () => {
  let voicesChangedCb = null;
  let voices = [];
  const ctx = createBrowserSandbox({
    speechSynthesis: {
      getVoices: () => voices,
      addEventListener: (ev, fn) => {
        if (ev === 'voiceschanged') voicesChangedCb = fn;
      },
      cancel() {}
    }
  });
  loadScriptInto(ctx, 'voice-engine.js');

  const received = [];
  const unsub = ctx.VoiceEngine.onSystemVoicesChanged((list) => received.push(list));
  voices = [{ voiceURI: 'zh-1', name: 'Tingting', lang: 'zh-CN', localService: true, default: true }];
  voicesChangedCb();
  assert.equal(received.length, 1);
  assert.equal(received[0][0].name, 'Tingting');

  unsub();
  voicesChangedCb();
  assert.equal(received.length, 1, 'should not fire after unsubscribe');
});

test('voice-engine: iOS interrupted AudioContext triggers resume and re-arms unlock', () => {
  const fakeCtx = createFakeAudioContext('interrupted');
  const ctx = createBrowserSandbox({
    AudioContext: function () {
      return fakeCtx;
    }
  });
  loadScriptInto(ctx, 'voice-engine.js');

  assert.equal(ctx.VoiceEngine._internals.needsAudioResume(fakeCtx), true);
  ctx.VoiceEngine.unlockAudio();
  assert.equal(fakeCtx.resumeCalls, 1);
  assert.equal(fakeCtx.state, 'running');

  // Simulate iOS interrupting AudioContext later
  fakeCtx.state = 'interrupted';
  fakeCtx.dispatch('statechange');
  assert.ok(ctx.document._listeners.get('pointerdown')?.size >= 1, 'unlock gesture listener re-armed');
});

test('voice-engine: playHtmlAudio timeout pauses audio and returns false; stop() settles immediately', async () => {
  const createdAudios = [];
  class FakeAudio {
    constructor(src) {
      this.src = src;
      this.paused = false;
      this.currentTime = 0;
      createdAudios.push(this);
    }
    play() {
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
  }

  const ctx = createBrowserSandbox({ Audio: FakeAudio });
  loadScriptInto(ctx, 'voice-engine.js');

  // 1. Timeout must pause runaway audio and resolve false
  const timedOut = await ctx.VoiceEngine._internals.playHtmlAudio('audio/yunxia/char_a.mp3', 0, 30);
  assert.equal(timedOut, false);
  assert.equal(createdAudios[0].paused, true, 'timed-out audio must be paused');

  // 2. stop() must settle pending playHtmlAudio immediately (not wait 5000ms)
  const start = Date.now();
  const pending = ctx.VoiceEngine._internals.playHtmlAudio('audio/yunxia/char_b.mp3', 0, 5000);
  ctx.VoiceEngine.stop();
  const result = await pending;
  assert.equal(result, false);
  assert.ok(Date.now() - start < 500, 'stop() must settle playHtmlAudio immediately');
  assert.equal(createdAudios[1].paused, true);
});

test('voice-engine: stop() settles pending Web Audio & System TTS immediately', async () => {
  const fakeAudioCtx = createFakeAudioContext('running');
  let spoken = 0;
  let cancelled = 0;
  const ctx = createBrowserSandbox({
    AudioContext: function () {
      return fakeAudioCtx;
    },
    fetch: async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(512)
    }),
    speechSynthesis: {
      speaking: false,
      pending: false,
      getVoices: () => [],
      speak() {
        spoken += 1;
        this.speaking = true;
      },
      cancel() {
        cancelled += 1;
        this.speaking = false;
      }
    },
    SpeechSynthesisUtterance: class {
      constructor(text) {
        this.text = text;
      }
    }
  });
  loadScriptInto(ctx, 'voice-engine.js');

  // Web Audio local pack playback cancelled via stop()
  ctx.VoiceEngine.setVoiceId('yunxia');
  const startWebAudio = Date.now();
  const p1 = ctx.VoiceEngine.speakStroke('横');
  await new Promise((r) => setTimeout(r, 25));
  ctx.VoiceEngine.stop();
  await p1;
  assert.ok(Date.now() - startWebAudio < 400, 'stop() must settle Web Audio playback promptly');

  // System TTS cancelled via stop()
  ctx.VoiceEngine.setVoiceId('system');
  const startTts = Date.now();
  const p2 = ctx.VoiceEngine.speakText('王小明');
  await new Promise((r) => setTimeout(r, 15));
  ctx.VoiceEngine.stop();
  await p2;
  assert.ok(spoken >= 1 && cancelled >= 1);
  assert.ok(Date.now() - startTts < 400, 'stop() must settle System TTS promptly');
});

test('voice-engine: 404 on audio-cmn skips remaining mirrors and tries davinfifield', async () => {
  const requested = [];
  const fakeAudioCtx = createFakeAudioContext('running');
  const ctx = createBrowserSandbox({
    AudioContext: function () {
      return fakeAudioCtx;
    },
    fetch: async (url) => {
      requested.push(url);
      if (url.includes('hugolpz/audio-cmn')) {
        return { ok: false, status: 404 };
      }
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new ArrayBuffer(512)
      };
    }
  });
  loadScriptInto(ctx, 'voice-engine.js');

  const entry = await ctx.VoiceEngine._internals.loadHumanSyllableBuffer('wang2');
  assert.ok(entry && entry.buffer);
  const cmnCalls = requested.filter((u) => u.includes('hugolpz/audio-cmn'));
  const davinCalls = requested.filter((u) => u.includes('davinfifield'));
  assert.equal(cmnCalls.length, 1, 'should short-circuit remaining audio-cmn mirrors on 404');
  assert.equal(davinCalls.length, 1);
});

test('voice-engine: default voice is xiaoxiao and migrates legacy human default once', () => {
  // 1. Fresh user defaults to xiaoxiao
  const ctxFresh = createBrowserSandbox();
  loadScriptInto(ctxFresh, 'voice-engine.js');
  assert.equal(ctxFresh.VoiceEngine.getVoiceId(), 'xiaoxiao');
  assert.equal(ctxFresh.VoiceEngine.getProfiles()[0].id, 'xiaoxiao');

  // 2. Existing user stuck on legacy default 'human' is migrated once to 'xiaoxiao'
  const legacyStorage = createMemoryStorage();
  legacyStorage.setItem('hanzi_name_voice_v1', 'human');
  const ctxLegacy = createBrowserSandbox({ localStorage: legacyStorage });
  loadScriptInto(ctxLegacy, 'voice-engine.js');
  assert.equal(ctxLegacy.VoiceEngine.getVoiceId(), 'xiaoxiao');
  assert.equal(legacyStorage.getItem('hanzi_name_voice_v1'), 'xiaoxiao');
  assert.equal(legacyStorage.getItem('hanzi_name_voice_migrated_v2'), '1');

  // 3. Explicit user choice (including 'human' after migration or 'yunxia') is preserved
  ctxLegacy.VoiceEngine.setVoiceId('human');
  const ctxExplicitHuman = createBrowserSandbox({ localStorage: legacyStorage });
  loadScriptInto(ctxExplicitHuman, 'voice-engine.js');
  assert.equal(ctxExplicitHuman.VoiceEngine.getVoiceId(), 'human');

  const yunxiaStorage = createMemoryStorage();
  yunxiaStorage.setItem('hanzi_name_voice_v1', 'yunxia');
  const ctxYunxia = createBrowserSandbox({ localStorage: yunxiaStorage });
  loadScriptInto(ctxYunxia, 'voice-engine.js');
  assert.equal(ctxYunxia.VoiceEngine.getVoiceId(), 'yunxia');
});

test('voice-engine: loadLocalAudioBuffer trims silence and preloadChars/preloadStrokes warm local pack', async () => {
  const requested = [];
  const fakeAudioCtx = createFakeAudioContext('running');
  // Decode a buffer with leading/trailing silence around active speech
  fakeAudioCtx.decodeAudioData = (_arr, resolve) => {
    const sr = 24000;
    const len = sr; // 1.0s
    const buf = fakeAudioCtx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    // Active region from 0.25s to 0.55s
    for (let i = Math.round(sr * 0.25); i < Math.round(sr * 0.55); i += 1) {
      data[i] = 0.4;
    }
    if (resolve) resolve(buf);
    return Promise.resolve(buf);
  };

  const ctx = createBrowserSandbox({
    AudioContext: function () {
      return fakeAudioCtx;
    },
    fetch: async (url) => {
      requested.push(url);
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new ArrayBuffer(512)
      };
    }
  });
  loadScriptInto(ctx, 'voice-engine.js');

  const entry = await ctx.VoiceEngine._internals.loadLocalAudioBuffer('audio/xiaoxiao/stroke_%E6%A8%AA.mp3');
  assert.ok(entry && entry.buffer);
  assert.ok(entry.buffer.length < 24000, 'leading/trailing silence should be trimmed from local audio');

  requested.length = 0;
  ctx.VoiceEngine.preloadChars(['王', '小']);
  ctx.VoiceEngine.preloadStrokes(['横', '竖', '横']);
  await new Promise((r) => setTimeout(r, 20));

  assert.ok(requested.some((u) => u === `audio/xiaoxiao/char_${encodeURIComponent('王')}.mp3`));
  assert.ok(requested.some((u) => u === `audio/xiaoxiao/char_${encodeURIComponent('小')}.mp3`));
  assert.ok(requested.some((u) => u === `audio/xiaoxiao/stroke_${encodeURIComponent('竖')}.mp3`));
  // '横' was already cached above, so preloadStrokes should reuse cache without refetching it
  assert.equal(requested.filter((u) => u.includes(`stroke_${encodeURIComponent('横')}`)).length, 0);
});

test('build.mjs: injects content hashes in dist/index.html and writes complete _headers', () => {
  execFileSync(process.execPath, [path.join(ROOT, 'build.mjs')], { cwd: ROOT });

  const distHtml = fs.readFileSync(path.join(ROOT, 'dist', 'index.html'), 'utf-8');
  for (const asset of ['styles.css', 'app.js', 'stroke-loader.js', 'voice-engine.js', 'stroke-data.js']) {
    assert.match(distHtml, new RegExp(`${asset.replace('.', '\\.')}\\?v=[a-f0-9]{8}`), `expected hash for ${asset}`);
  }

  const distHeaders = fs.readFileSync(path.join(ROOT, 'dist', '_headers'), 'utf-8');
  assert.match(distHeaders, /^\/app\.js$/m);
  assert.match(distHeaders, /^\/styles\.css$/m);
  assert.match(distHeaders, /^\/audio\/\*$/m);
  assert.match(distHeaders, /^\/index\.html$/m);
});
