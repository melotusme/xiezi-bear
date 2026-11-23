(() => {
  'use strict';

  const CACHE_PREFIX = 'xiezi_stroke_v1_';
  const FETCH_TIMEOUT_MS = 6500;
  const IDS_FETCH_TIMEOUT_MS = 10000;
  const MAX_IDS_DEPTH = 3;

  const HANZI_WRITER_URLS = (enc) => [
    `https://fastly.jsdelivr.net/npm/hanzi-writer-data@2.0/${enc}.json`,
    `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${enc}.json`
  ];

  const ACJK_JSON_URLS = (enc) => [
    `https://fastly.jsdelivr.net/npm/hanzi-writer-data-acjk@1.0.0/animCJK/ZhHans/${enc}.json`,
    `https://cdn.jsdelivr.net/npm/hanzi-writer-data-acjk@1.0.0/animCJK/ZhHans/${enc}.json`
  ];

  const ACJK_SVG_URLS = (cp) => [
    `https://cdn.statically.io/gh/parsimonhi/animCJK/master/svgsZhHans/${cp}.svg`,
    `https://raw.githubusercontent.com/parsimonhi/animCJK/master/svgsZhHans/${cp}.svg`
  ];

  const BABELSTONE_IDS_URLS = [
    'https://fastly.jsdelivr.net/gh/mandel59/babelstone-ids@main/IDS.TXT',
    'https://cdn.jsdelivr.net/gh/mandel59/babelstone-ids@main/IDS.TXT',
    'https://raw.githubusercontent.com/mandel59/babelstone-ids/main/IDS.TXT'
  ];

  const PINYIN_PRO_URLS = [
    'https://fastly.jsdelivr.net/npm/pinyin-pro@3.26.0/dist/index.js',
    'https://cdn.jsdelivr.net/npm/pinyin-pro@3.26.0/dist/index.js',
    'https://unpkg.com/pinyin-pro@3.26.0/dist/index.js'
  ];

  // Radical/component variant normalization for BabelStone IDS lookups
  const RADICAL_NORMALIZE = {
    '𤣩': '王',
    '⺩': '王',
    '⺮': '竹',
    '⻌': '辶',
    '⻍': '辶',
    '⻎': '辶',
    '⺼': '月',
    '⺝': '月',
    '⺾': '艹',
    '⺿': '艹',
    '⻀': '艹',
    '⺅': '亻',
    '⺘': '扌',
    '⺡': '氵',
    '⺣': '灬',
    '⺤': '爫',
    '⺥': '爪',
    '⺭': '礻',
    '⻊': '足',
    '⻖': '阝',
    '⻕': '阝',
    '⺖': '忄',
    '⺨': '犭',
    '⺪': '疋',
    '⺫': '罒',
    '⺰': '纟',
    '⺳': '网',
    '⺶': '羊',
    '⺷': '羊',
    '⺸': '羊',
    '⺹': '耂',
    '⻂': '衤',
    '⻈': '讠',
    '⻉': '贝',
    '⻋': '车',
    '⻐': '钅',
    '⻙': '韦',
    '⻛': '风',
    '⻜': '飞',
    '⻝': '食',
    '⻟': '饣',
    '⻠': '饣',
    '⻢': '马',
    '⻥': '鱼',
    '⻦': '鸟',
    '⻧': '卤',
    '⻨': '麦',
    '⻩': '黄',
    '⻪': '黾',
    '⻫': '齐',
    '⻬': '齐',
    '⻭': '齿',
    '⻮': '齿',
    '⻯': '龙',
    '⻰': '龙',
    '⻱': '龟',
    '⻲': '龟',
    '⻳': '龟',
    '⺍': '小',
    '⺄': '乙',
    '⺉': '刂',
    '⺋': '卩',
    '⺐': '尤',
    '⺒': '巳',
    '⺓': '幺',
    '⺔': '彐',
    '⺕': '彑',
    '⺗': '心',
    '⺜': '日',
    '⺟': '母',
    '⺠': '民',
    '⺢': '水',
    '⺧': '牛',
    '⻃': '西',
    '⻄': '西',
    '⻆': '角',
    '⻇': '角',
    '⻔': '门',
    '⻗': '雨',
    '⻘': '青',
    '⻤': '鬼',
    '朩': '木'
  };

  const NARROW_LEFT_RADICALS = new Set([
    '氵', '亻', '扌', '木', '王', '火', '禾', '女', '忄', '讠', '钅', '纟',
    '阝', '礻', '衤', '犭', '冫', '彳', '弓', '巾', '日', '目', '口', '土',
    '石', '虫', '车', '马', '鱼', '鸟', '立', '歹', '舟', '贝', '见', '饣',
    '月', '山', '米', '足', '耳', '舟', '车', '革', '骨', '牛', '牜', '片',
    '牙', '矛', '矢', '豆', '酉', '采', '里', '身', '角', '言'
  ]);

  const NARROW_RIGHT_RADICALS = new Set(['刂', '阝', '卩', '彡', '戈', '寸', '力', '欠', '攵', '斤', '斗', '殳', '页', '鸟']);

  const FLAT_TOP_RADICALS = new Set([
    '艹', '宀', '⺮', '竹', '雨', '穴', '亠', '冖', '爫', '爪', '罒', '四',
    '山', '夕', '人', '八', '大', '小', '十', '土', '日', '白', '田', '耂'
  ]);

  const FLAT_BOTTOM_RADICALS = new Set(['心', '灬', '皿', '贝', '土', '女', '子', '寸', '木', '水', '火', '日', '口', '力', '大', '小']);

  const IDS_ARITY = {
    '⿰': 2,
    '⿱': 2,
    '⿲': 3,
    '⿳': 3,
    '⿴': 2,
    '⿵': 2,
    '⿶': 2,
    '⿷': 2,
    '⿸': 2,
    '⿹': 2,
    '⿺': 2,
    '⿻': 2,
    '⿾': 1,
    '⿿': 1
  };

  const charCache = new Map();
  const inFlight = new Map();
  let idsMapPromise = null;
  let pinyinPromise = null;

  function firstCodePointChar(input) {
    const chars = Array.from(String(input || '').trim());
    return chars.length ? chars[0] : '';
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function isValidCharData(data) {
    if (!data || !Array.isArray(data.strokes) || !Array.isArray(data.medians)) {
      return false;
    }
    if (data.strokes.length === 0 || data.strokes.length !== data.medians.length) {
      return false;
    }
    for (let i = 0; i < data.strokes.length; i += 1) {
      const s = data.strokes[i];
      const m = data.medians[i];
      if (typeof s !== 'string' || s.length < 3 || s.includes('NaN')) return false;
      if (!Array.isArray(m) || m.length < 2) return false;
      for (let j = 0; j < m.length; j += 1) {
        const pt = m[j];
        if (!Array.isArray(pt) || pt.length < 2 || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) {
          return false;
        }
      }
    }
    return true;
  }

  function readSessionCache(ch) {
    try {
      if (typeof sessionStorage === 'undefined') return null;
      const raw = sessionStorage.getItem(CACHE_PREFIX + ch);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return isValidCharData(parsed) ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function writeSessionCache(ch, data) {
    try {
      if (typeof sessionStorage === 'undefined') return;
      const payload = {
        strokes: data.strokes,
        medians: data.medians,
        source: data.source || 'remote'
      };
      if (Array.isArray(data.radStrokes)) {
        payload.radStrokes = data.radStrokes;
      }
      sessionStorage.setItem(CACHE_PREFIX + ch, JSON.stringify(payload));
    } catch (_) {
      // Ignore quota / private mode errors
    }
  }

  async function fetchWithTimeout(url, timeoutMs) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timer = null;
    if (controller) {
      timer = setTimeout(() => controller.abort(), timeoutMs);
    }
    try {
      const res = await fetch(url, controller ? { signal: controller.signal } : undefined);
      return res;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function fetchFromMirrors(urls, mode = 'json', timeoutMs = FETCH_TIMEOUT_MS, skipMirrorsOn404 = true) {
    let lastError = null;
    for (let i = 0; i < urls.length; i += 1) {
      try {
        const res = await fetchWithTimeout(urls[i], timeoutMs);
        if (res.ok) {
          return mode === 'json' ? await res.json() : await res.text();
        }
        if (res.status === 404 && skipMirrorsOn404) {
          return null;
        }
        lastError = new Error(`HTTP ${res.status}`);
      } catch (err) {
        lastError = err;
      }
    }
    if (lastError) {
      return null;
    }
    return null;
  }

  // --- SVG Path Tokenizer & Affine Transformer ---

  const PATH_TOKEN_RE = /([MmZzLlHhVvCcSsQqTtAa])|([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;

  const CMD_ARG_COUNTS = {
    M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0
  };

  function parseSvgPathToAbsolute(d) {
    const tokens = [];
    let match;
    PATH_TOKEN_RE.lastIndex = 0;
    while ((match = PATH_TOKEN_RE.exec(d)) !== null) {
      if (match[1]) {
        tokens.push({ type: 'cmd', val: match[1] });
      } else {
        tokens.push({ type: 'num', val: parseFloat(match[2]) });
      }
    }

    const out = [];
    let i = 0;
    let cx = 0;
    let cy = 0;
    let sx = 0;
    let sy = 0;
    let activeCmd = '';

    while (i < tokens.length) {
      if (tokens[i].type === 'cmd') {
        activeCmd = tokens[i].val;
        i += 1;
      } else if (!activeCmd) {
        i += 1;
        continue;
      }

      const upper = activeCmd.toUpperCase();
      const isRel = activeCmd !== upper;
      const argCount = CMD_ARG_COUNTS[upper];

      if (upper === 'Z') {
        out.push({ cmd: 'Z', args: [] });
        cx = sx;
        cy = sy;
        activeCmd = '';
        continue;
      }

      if (argCount === undefined || i + argCount > tokens.length) {
        break;
      }

      const nums = [];
      let valid = true;
      for (let k = 0; k < argCount; k += 1) {
        if (tokens[i + k].type !== 'num' || !Number.isFinite(tokens[i + k].val)) {
          valid = false;
          break;
        }
        nums.push(tokens[i + k].val);
      }
      if (!valid) {
        break;
      }
      i += argCount;

      if (upper === 'M') {
        const x = isRel ? cx + nums[0] : nums[0];
        const y = isRel ? cy + nums[1] : nums[1];
        out.push({ cmd: 'M', args: [x, y] });
        cx = x;
        cy = y;
        sx = x;
        sy = y;
        // Subsequent coordinate pairs after M/m are implicit L/l
        activeCmd = isRel ? 'l' : 'L';
      } else if (upper === 'L') {
        const x = isRel ? cx + nums[0] : nums[0];
        const y = isRel ? cy + nums[1] : nums[1];
        out.push({ cmd: 'L', args: [x, y] });
        cx = x;
        cy = y;
      } else if (upper === 'H') {
        const x = isRel ? cx + nums[0] : nums[0];
        out.push({ cmd: 'L', args: [x, cy] });
        cx = x;
      } else if (upper === 'V') {
        const y = isRel ? cy + nums[0] : nums[0];
        out.push({ cmd: 'L', args: [cx, y] });
        cy = y;
      } else if (upper === 'C') {
        const a = isRel
          ? [cx + nums[0], cy + nums[1], cx + nums[2], cy + nums[3], cx + nums[4], cy + nums[5]]
          : nums;
        out.push({ cmd: 'C', args: a });
        cx = a[4];
        cy = a[5];
      } else if (upper === 'S') {
        const a = isRel
          ? [cx + nums[0], cy + nums[1], cx + nums[2], cy + nums[3]]
          : nums;
        out.push({ cmd: 'S', args: a });
        cx = a[2];
        cy = a[3];
      } else if (upper === 'Q') {
        const a = isRel
          ? [cx + nums[0], cy + nums[1], cx + nums[2], cy + nums[3]]
          : nums;
        out.push({ cmd: 'Q', args: a });
        cx = a[2];
        cy = a[3];
      } else if (upper === 'T') {
        const x = isRel ? cx + nums[0] : nums[0];
        const y = isRel ? cy + nums[1] : nums[1];
        out.push({ cmd: 'T', args: [x, y] });
        cx = x;
        cy = y;
      } else if (upper === 'A') {
        const x = isRel ? cx + nums[5] : nums[5];
        const y = isRel ? cy + nums[6] : nums[6];
        out.push({ cmd: 'A', args: [nums[0], nums[1], nums[2], nums[3], nums[4], x, y] });
        cx = x;
        cy = y;
      }
    }

    return out;
  }

  function transformSvgPath(d, scaleX, scaleY, tx, ty) {
    const cmds = parseSvgPathToAbsolute(d);
    const parts = [];
    const flipArc = scaleX * scaleY < 0;

    for (let i = 0; i < cmds.length; i += 1) {
      const { cmd, args } = cmds[i];
      if (cmd === 'Z') {
        parts.push('Z');
      } else if (cmd === 'A') {
        const rx = round1(Math.abs(args[0] * scaleX));
        const ry = round1(Math.abs(args[1] * scaleY));
        const rot = flipArc ? -args[2] : args[2];
        const largeArc = args[3];
        const sweep = flipArc ? (args[4] ? 0 : 1) : args[4];
        const x = round1(args[5] * scaleX + tx);
        const y = round1(args[6] * scaleY + ty);
        parts.push(`A ${rx} ${ry} ${rot} ${largeArc} ${sweep} ${x} ${y}`);
      } else {
        const transformed = [];
        for (let j = 0; j < args.length; j += 2) {
          transformed.push(round1(args[j] * scaleX + tx));
          transformed.push(round1(args[j + 1] * scaleY + ty));
        }
        parts.push(`${cmd} ${transformed.join(' ')}`);
      }
    }
    return parts.join(' ');
  }

  function extractPolylineFromPath(d, scaleX, scaleY, tx, ty) {
    const cmds = parseSvgPathToAbsolute(d);
    const pts = [];
    const pushPt = (x, y) => {
      const nx = Math.round(x * scaleX + tx);
      const ny = Math.round(y * scaleY + ty);
      const prev = pts[pts.length - 1];
      if (!prev || prev[0] !== nx || prev[1] !== ny) {
        pts.push([nx, ny]);
      }
    };

    for (let i = 0; i < cmds.length; i += 1) {
      const { cmd, args } = cmds[i];
      if (cmd === 'M' || cmd === 'L' || cmd === 'T') {
        pushPt(args[0], args[1]);
      } else if (cmd === 'Q' || cmd === 'S') {
        pushPt(args[0], args[1]);
        pushPt(args[2], args[3]);
      } else if (cmd === 'C') {
        pushPt(args[2], args[3]);
        pushPt(args[4], args[5]);
      } else if (cmd === 'A') {
        pushPt(args[5], args[6]);
      }
    }
    return pts;
  }

  // --- Tier 3: animCJK SVG -> HanziWriter JSON converter ---

  function parseAnimCjkSvg(svgText, cp) {
    if (typeof svgText !== 'string' || !svgText.includes('<svg')) return null;

    const strokeMap = new Map();
    const medianMap = new Map();
    const pathTagRe = /<path\b([^>]*?)\/?>/gi;
    const idRe = /\bid\s*=\s*["']([^"']+)["']/i;
    const dRe = /\bd\s*=\s*["']([^"']+)["']/i;
    const clipRe = /\bclip-path\s*=\s*["']url\(#([^"']+)\)["']/i;
    const styleDelayRe = /--d\s*:/i;
    const strokeIdPattern = new RegExp(`^z${cp}d(\\d+)$`);
    const clipIdPattern = new RegExp(`^z${cp}c(\\d+)$`);

    const fallbackMedians = [];
    let tagMatch;
    while ((tagMatch = pathTagRe.exec(svgText)) !== null) {
      const attrs = tagMatch[1];
      const dMatch = dRe.exec(attrs);
      if (!dMatch) continue;
      const dVal = dMatch[1].trim();
      if (!dVal) continue;

      const idMatch = idRe.exec(attrs);
      if (idMatch) {
        const sm = strokeIdPattern.exec(idMatch[1]);
        if (sm) {
          strokeMap.set(parseInt(sm[1], 10), dVal);
          continue;
        }
      }

      const clipMatch = clipRe.exec(attrs);
      if (clipMatch) {
        const cm = clipIdPattern.exec(clipMatch[1]);
        if (cm) {
          medianMap.set(parseInt(cm[1], 10), dVal);
          continue;
        }
      }

      if (styleDelayRe.test(attrs) || /\bdata-median\b/i.test(attrs)) {
        fallbackMedians.push(dVal);
      }
    }

    if (strokeMap.size === 0) return null;
    const strokeKeys = Array.from(strokeMap.keys()).sort((a, b) => a - b);

    // animCJK uses viewBox 0 0 1024 1024 Y-down; HanziWriter uses 1024x1024 Y-up with y_hw = 900 - y_svg
    const strokes = strokeKeys.map((k) => transformSvgPath(strokeMap.get(k), 1, -1, 0, 900));

    let medians = [];
    if (medianMap.size === strokeKeys.length) {
      medians = strokeKeys.map((k) => extractPolylineFromPath(medianMap.get(k), 1, -1, 0, 900));
    } else if (fallbackMedians.length === strokeKeys.length) {
      medians = fallbackMedians.map((dVal) => extractPolylineFromPath(dVal, 1, -1, 0, 900));
    } else {
      return null;
    }

    const result = { strokes, medians, source: 'animcjk-svg' };
    return isValidCharData(result) ? result : null;
  }

  // --- Tier 4: BabelStone IDS Component Composition ---

  function pickPreferredIds(candidates) {
    let fallback = '';
    for (let i = 0; i < candidates.length; i += 1) {
      const raw = candidates[i].trim();
      const m = /^\^([^$]+)\$(?:\(([^)]*)\))?/.exec(raw);
      if (!m) continue;
      let seq = m[1].replace(/\u303e/g, '').trim();
      const regions = m[2] || '';
      if (!seq || seq.includes('？') || seq.includes('{')) continue;
      const chars = Array.from(seq);
      if (chars.length < 2 || !IDS_ARITY[chars[0]]) continue;
      if (regions.includes('G')) {
        return seq;
      }
      if (!fallback) fallback = seq;
    }
    return fallback;
  }

  async function ensureIdsMap() {
    if (!idsMapPromise) {
      idsMapPromise = (async () => {
        const text = await fetchFromMirrors(BABELSTONE_IDS_URLS, 'text', IDS_FETCH_TIMEOUT_MS, false);
        const map = new Map();
        if (!text) return map;
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i += 1) {
          const line = lines[i];
          if (!line || line[0] === '#' || line[0] === '\ufeff') continue;
          const parts = line.split('\t');
          if (parts.length < 3) continue;
          const ch = parts[1];
          const seq = pickPreferredIds(parts.slice(2));
          if (ch && seq) {
            map.set(ch, seq);
          }
        }
        return map;
      })();
    }
    return idsMapPromise;
  }

  function parseIdsAst(seq) {
    const tokens = Array.from(seq);
    let pos = 0;

    function parseNode() {
      if (pos >= tokens.length) return null;
      const tok = tokens[pos];
      pos += 1;
      const arity = IDS_ARITY[tok];
      if (!arity) {
        return { type: 'char', char: tok };
      }
      const children = [];
      for (let i = 0; i < arity; i += 1) {
        const child = parseNode();
        if (!child) return null;
        children.push(child);
      }
      return { type: 'op', op: tok, children };
    }

    const root = parseNode();
    if (!root || pos !== tokens.length) return null;
    return root;
  }

  function getLeafChar(node) {
    if (!node) return '';
    if (node.type === 'char') return RADICAL_NORMALIZE[node.char] || node.char;
    return '';
  }

  function computeCharBbox(data) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    const visitPt = (x, y) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    };

    for (let i = 0; i < data.strokes.length; i += 1) {
      const cmds = parseSvgPathToAbsolute(data.strokes[i]);
      for (let j = 0; j < cmds.length; j += 1) {
        const { cmd, args } = cmds[j];
        if (cmd === 'Z') continue;
        if (cmd === 'A') {
          visitPt(args[5], args[6]);
        } else {
          for (let k = 0; k < args.length; k += 2) {
            visitPt(args[k], args[k + 1]);
          }
        }
      }
    }

    for (let i = 0; i < data.medians.length; i += 1) {
      const med = data.medians[i];
      for (let j = 0; j < med.length; j += 1) {
        visitPt(med[j][0], med[j][1]);
      }
    }

    if (!Number.isFinite(minX)) {
      return { minX: 60, maxX: 964, minY: -60, maxY: 840 };
    }
    return { minX, maxX, minY, maxY };
  }

  function fitDataToSlot(data, slot) {
    const bbox = computeCharBbox(data);
    const rawW = bbox.maxX - bbox.minX;
    const rawH = bbox.maxY - bbox.minY;
    const effW = Math.max(rawW, 120);
    const effH = Math.max(rawH, 120);

    const slotW = slot.x1 - slot.x0;
    const slotH = slot.y1 - slot.y0;

    // Cap enlargement slightly so naturally narrow/flat radicals (like 氵 or 艹) don't bloat
    const sx = Math.min(slotW / effW, 1.12);
    const sy = Math.min(slotH / effH, 1.12);

    const fittedW = rawW * sx;
    const fittedH = rawH * sy;
    const tx = slot.x0 + (slotW - fittedW) / 2 - bbox.minX * sx;
    const ty = slot.y0 + (slotH - fittedH) / 2 - bbox.minY * sy;

    return {
      strokes: data.strokes.map((s) => transformSvgPath(s, sx, sy, tx, ty)),
      medians: data.medians.map((m) =>
        m.map(([x, y]) => [Math.round(x * sx + tx), Math.round(y * sy + ty)])
      )
    };
  }

  function getSlotsForOp(op, children) {
    // HW Y-up visual box: x in [55, 969], y in [-60, 845] (higher Y is TOP)
    const FULL = { x0: 55, x1: 969, y0: -60, y1: 845 };
    const leftLeaf = getLeafChar(children[0]);
    const rightLeaf = getLeafChar(children[1]);

    switch (op) {
      case '⿰': {
        if (NARROW_LEFT_RADICALS.has(leftLeaf)) {
          return [
            { x0: 55, x1: 365, y0: -55, y1: 840 },
            { x0: 385, x1: 965, y0: -55, y1: 840 }
          ];
        }
        if (NARROW_RIGHT_RADICALS.has(rightLeaf)) {
          return [
            { x0: 55, x1: 635, y0: -55, y1: 840 },
            { x0: 655, x1: 965, y0: -55, y1: 840 }
          ];
        }
        return [
          { x0: 55, x1: 495, y0: -55, y1: 840 },
          { x0: 520, x1: 965, y0: -55, y1: 840 }
        ];
      }
      case '⿱': {
        if (FLAT_TOP_RADICALS.has(leftLeaf)) {
          return [
            { x0: 85, x1: 940, y0: 545, y1: 850 },
            { x0: 65, x1: 960, y0: -60, y1: 520 }
          ];
        }
        if (FLAT_BOTTOM_RADICALS.has(rightLeaf)) {
          return [
            { x0: 80, x1: 945, y0: 255, y1: 845 },
            { x0: 65, x1: 960, y0: -60, y1: 235 }
          ];
        }
        return [
          { x0: 75, x1: 950, y0: 410, y1: 845 },
          { x0: 75, x1: 950, y0: -60, y1: 385 }
        ];
      }
      case '⿲':
        return [
          { x0: 50, x1: 330, y0: -55, y1: 840 },
          { x0: 355, x1: 660, y0: -55, y1: 840 },
          { x0: 685, x1: 970, y0: -55, y1: 840 }
        ];
      case '⿳':
        return [
          { x0: 85, x1: 940, y0: 565, y1: 845 },
          { x0: 80, x1: 945, y0: 255, y1: 540 },
          { x0: 70, x1: 955, y0: -60, y1: 230 }
        ];
      case '⿸':
        return [FULL, { x0: 300, x1: 950, y0: -55, y1: 585 }];
      case '⿹':
        return [FULL, { x0: 75, x1: 690, y0: -55, y1: 585 }];
      case '⿺':
        return [FULL, { x0: 325, x1: 950, y0: 175, y1: 830 }];
      case '⿵':
        return [FULL, { x0: 225, x1: 800, y0: -45, y1: 605 }];
      case '⿶':
        return [FULL, { x0: 215, x1: 810, y0: 145, y1: 830 }];
      case '⿷':
        return [FULL, { x0: 275, x1: 935, y0: 75, y1: 725 }];
      case '⿴':
        return [FULL, { x0: 220, x1: 805, y0: 105, y1: 685 }];
      case '⿻':
        return [FULL, FULL];
      case '⿾':
      case '⿿':
        return [FULL];
      default:
        return children.map(() => FULL);
    }
  }

  async function resolveDirectTiers(ch) {
    // Tier 0: Built-in offline preset data
    if (typeof window !== 'undefined' && window.BUILTIN_STROKE_DATA && window.BUILTIN_STROKE_DATA[ch]) {
      const builtin = window.BUILTIN_STROKE_DATA[ch];
      if (isValidCharData(builtin)) {
        return { ...builtin, source: 'builtin' };
      }
    }

    const enc = encodeURIComponent(ch);

    // Tier 1: hanzi-writer-data@2.0
    const hwData = await fetchFromMirrors(HANZI_WRITER_URLS(enc), 'json', FETCH_TIMEOUT_MS, true);
    if (isValidCharData(hwData)) {
      return { ...hwData, source: 'hanzi-writer-data' };
    }

    // Tier 2: hanzi-writer-data-acjk@1.0.0 (animCJK ZhHans native HW JSON)
    const acjkJson = await fetchFromMirrors(ACJK_JSON_URLS(enc), 'json', FETCH_TIMEOUT_MS, true);
    if (isValidCharData(acjkJson)) {
      return { ...acjkJson, source: 'hanzi-writer-data-acjk' };
    }

    // Tier 3: Live upstream parsimonhi/animCJK SVGs (svgsZhHans)
    const cp = ch.codePointAt(0);
    if (cp) {
      const svgText = await fetchFromMirrors(ACJK_SVG_URLS(cp), 'text', FETCH_TIMEOUT_MS, true);
      if (svgText) {
        const parsed = parseAnimCjkSvg(svgText, cp);
        if (parsed) return parsed;
      }
    }

    return null;
  }

  async function resolveIdsNode(node, depth, visited) {
    if (!node) return null;

    if (node.type === 'char') {
      const rawCh = node.char;
      const normCh = RADICAL_NORMALIZE[rawCh] || rawCh;
      if (visited.has(normCh)) return null;

      if (charCache.has(normCh)) return charCache.get(normCh);
      const direct = await resolveDirectTiers(normCh);
      if (direct) {
        charCache.set(normCh, direct);
        return direct;
      }
      if (rawCh !== normCh) {
        const rawDirect = await resolveDirectTiers(rawCh);
        if (rawDirect) {
          charCache.set(rawCh, rawDirect);
          return rawDirect;
        }
      }
      if (depth >= MAX_IDS_DEPTH) return null;
      return composeViaIds(normCh, depth + 1, visited);
    }

    const slots = getSlotsForOp(node.op, node.children);
    const resolvedChildren = [];
    for (let i = 0; i < node.children.length; i += 1) {
      const childData = await resolveIdsNode(node.children[i], depth + 1, visited);
      if (!childData) return null;
      resolvedChildren.push(childData);
    }

    if (node.op === '⿾' && resolvedChildren.length === 1) {
      const bbox = computeCharBbox(resolvedChildren[0]);
      const mirrorTx = bbox.minX + bbox.maxX;
      return {
        strokes: resolvedChildren[0].strokes.map((s) => transformSvgPath(s, -1, 1, mirrorTx, 0)),
        medians: resolvedChildren[0].medians.map((m) => m.map(([x, y]) => [Math.round(-x + mirrorTx), y])),
        source: 'ids-composed'
      };
    }

    if (node.op === '⿿' && resolvedChildren.length === 1) {
      const bbox = computeCharBbox(resolvedChildren[0]);
      const tx = bbox.minX + bbox.maxX;
      const ty = bbox.minY + bbox.maxY;
      return {
        strokes: resolvedChildren[0].strokes.map((s) => transformSvgPath(s, -1, -1, tx, ty)),
        medians: resolvedChildren[0].medians.map((m) =>
          m.map(([x, y]) => [Math.round(-x + tx), Math.round(-y + ty)])
        ),
        source: 'ids-composed'
      };
    }

    const fitted = resolvedChildren.map((childData, idx) => fitDataToSlot(childData, slots[idx]));

    // PRC stroke order: for ⿺ with 辶 or 廴, inner component is written before the outer wrap
    const firstLeaf = getLeafChar(node.children[0]);
    const order =
      node.op === '⿺' && (firstLeaf === '辶' || firstLeaf === '廴') && fitted.length === 2
        ? [fitted[1], fitted[0]]
        : fitted;

    const strokes = [];
    const medians = [];
    for (let i = 0; i < order.length; i += 1) {
      strokes.push(...order[i].strokes);
      medians.push(...order[i].medians);
    }

    const composed = { strokes, medians, source: 'ids-composed' };
    return isValidCharData(composed) ? composed : null;
  }

  async function composeViaIds(ch, depth, visited) {
    if (depth > MAX_IDS_DEPTH || visited.has(ch)) return null;
    const idsMap = await ensureIdsMap();
    const seq = idsMap.get(ch);
    if (!seq) return null;

    const ast = parseIdsAst(seq);
    if (!ast) return null;

    const nextVisited = new Set(visited);
    nextVisited.add(ch);
    return resolveIdsNode(ast, depth, nextVisited);
  }

  async function loadCharData(char) {
    const ch = firstCodePointChar(char);
    if (!ch) {
      throw new Error('Empty character');
    }

    if (charCache.has(ch)) {
      return charCache.get(ch);
    }

    const cached = readSessionCache(ch);
    if (cached) {
      charCache.set(ch, cached);
      return cached;
    }

    if (inFlight.has(ch)) {
      return inFlight.get(ch);
    }

    const task = (async () => {
      let data = await resolveDirectTiers(ch);
      if (!data) {
        data = await composeViaIds(ch, 0, new Set());
      }
      if (!isValidCharData(data)) {
        throw new Error(`No stroke data found for "${ch}"`);
      }
      charCache.set(ch, data);
      if (data.source !== 'builtin') {
        writeSessionCache(ch, data);
      }
      return data;
    })();

    inFlight.set(ch, task);
    try {
      return await task;
    } finally {
      inFlight.delete(ch);
    }
  }

  // --- Pinyin Helpers (pinyin-pro@3.26.0, MIT) ---

  function getPinyinApi() {
    const root = typeof window !== 'undefined' ? window : globalThis;
    if (root && root.pinyinPro && typeof root.pinyinPro.pinyin === 'function') {
      return root.pinyinPro;
    }
    return null;
  }

  function loadScriptOnce(url) {
    return new Promise((resolve) => {
      if (typeof document === 'undefined' || !document.head) {
        resolve(false);
        return;
      }
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.crossOrigin = 'anonymous';
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      const timer = setTimeout(() => {
        script.remove();
        done(false);
      }, 8000);
      script.onload = () => {
        clearTimeout(timer);
        done(Boolean(getPinyinApi()));
      };
      script.onerror = () => {
        clearTimeout(timer);
        script.remove();
        done(false);
      };
      document.head.appendChild(script);
    });
  }

  function ensurePinyinReady() {
    if (getPinyinApi()) {
      return Promise.resolve(true);
    }
    if (!pinyinPromise) {
      pinyinPromise = (async () => {
        if (typeof document === 'undefined') {
          return Boolean(getPinyinApi());
        }
        for (let i = 0; i < PINYIN_PRO_URLS.length; i += 1) {
          const ok = await loadScriptOnce(PINYIN_PRO_URLS[i]);
          if (ok) return true;
        }
        return false;
      })();
    }
    return pinyinPromise;
  }

  function preloadPinyinPro() {
    return ensurePinyinReady();
  }

  function getCharPinyin(char, fallback = '') {
    const ch = firstCodePointChar(char);
    if (!ch) return fallback;
    const api = getPinyinApi();
    if (!api) return fallback;
    try {
      const py = String(api.pinyin(ch, { toneType: 'symbol' }) || '').trim();
      if (!py || py === ch) return fallback;
      return py;
    } catch (_) {
      return fallback;
    }
  }

  function getCharPinyinNum(char) {
    const ch = firstCodePointChar(char);
    if (!ch) return '';
    const api = getPinyinApi();
    if (!api) return '';
    try {
      const py = String(api.pinyin(ch, { toneType: 'num', v: true }) || '')
        .trim()
        .toLowerCase();
      if (!py || py === ch) return '';
      return py;
    } catch (_) {
      return '';
    }
  }

  function getNamePinyinNums(chars) {
    const list = Array.isArray(chars) ? chars.map((c) => firstCodePointChar(c)).filter(Boolean) : Array.from(String(chars || '').trim());
    if (!list.length) return [];
    const api = getPinyinApi();
    if (!api) return [];
    try {
      const res = api.pinyin(list.join(''), {
        surname: 'head',
        toneType: 'num',
        v: true,
        type: 'array'
      });
      if (!Array.isArray(res)) return [];
      return res.map((py, idx) => {
        const clean = String(py || '').trim().toLowerCase();
        return clean && clean !== list[idx] ? clean : '';
      });
    } catch (_) {
      return [];
    }
  }

  const StrokeLoader = {
    loadCharData,
    getCharPinyin,
    getCharPinyinNum,
    getNamePinyinNums,
    preloadPinyinPro,
    ensurePinyinReady
  };

  if (typeof window !== 'undefined') {
    window.StrokeLoader = StrokeLoader;
  } else if (typeof globalThis !== 'undefined') {
    globalThis.StrokeLoader = StrokeLoader;
  }
})();
