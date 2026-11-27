import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

const files = [
  'index.html',
  'styles.css',
  'app.js',
  'hanzi-writer.min.js',
  'stroke-data.js',
  'stroke-loader.js',
  'voice-engine.js',
  'favicon.svg',
  'manifest.webmanifest'
];

function shortFileHash(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
}

const hashedAssets = [
  'styles.css',
  'app.js',
  'hanzi-writer.min.js',
  'stroke-data.js',
  'stroke-loader.js',
  'voice-engine.js',
  'favicon.svg',
  'manifest.webmanifest'
];

const assetHashes = {};
for (const file of files) {
  const srcPath = path.join(root, file);
  const dstPath = path.join(dist, file);
  fs.copyFileSync(srcPath, dstPath);
  if (hashedAssets.includes(file)) {
    assetHashes[file] = shortFileHash(srcPath);
  }
}

// Inject short content hashes (?v=<hash>) into dist/index.html for reliable cache busting
const distIndexPath = path.join(dist, 'index.html');
let indexHtml = fs.readFileSync(distIndexPath, 'utf-8');
for (const [asset, hash] of Object.entries(assetHashes)) {
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const attrRe = new RegExp(`((?:href|src)=["'])(?:\\./)?${escaped}(?:\\?v=[a-f0-9]+)?(["'])`, 'g');
  indexHtml = indexHtml.replace(attrRe, `$1${asset}?v=${hash}$2`);
}
fs.writeFileSync(distIndexPath, indexHtml, 'utf-8');

fs.cpSync(path.join(root, 'audio'), path.join(dist, 'audio'), { recursive: true });

function countFilesRecursive(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += countFilesRecursive(full);
    } else if (entry.isFile()) {
      total += 1;
    }
  }
  return total;
}

const headers = `/audio/*
  Cache-Control: public, max-age=31536000, immutable

/hanzi-writer.min.js
  Cache-Control: public, max-age=31536000, immutable

/app.js
  Cache-Control: public, max-age=3600, must-revalidate

/styles.css
  Cache-Control: public, max-age=3600, must-revalidate

/stroke-data.js
  Cache-Control: public, max-age=3600, must-revalidate

/stroke-loader.js
  Cache-Control: public, max-age=3600, must-revalidate

/voice-engine.js
  Cache-Control: public, max-age=3600, must-revalidate

/favicon.svg
  Cache-Control: public, max-age=86400

/manifest.webmanifest
  Content-Type: application/manifest+json; charset=utf-8
  Cache-Control: public, max-age=3600, must-revalidate

/index.html
  Cache-Control: public, max-age=0, must-revalidate

/
  Cache-Control: public, max-age=0, must-revalidate
`;

fs.writeFileSync(path.join(dist, '_headers'), headers, 'utf-8');
console.log('Built dist/ successfully with', countFilesRecursive(path.join(dist, 'audio')), 'audio files.');

function parseByteRange(rangeHeader, totalSize) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match) return null;
  const [, startStr, endStr] = match;
  if (!startStr && !endStr) return null;

  let start;
  let end;
  if (!startStr) {
    // Suffix byte range: bytes=-N (last N bytes)
    const suffix = parseInt(endStr, 10);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, totalSize - suffix);
    end = totalSize - 1;
  } else {
    start = parseInt(startStr, 10);
    end = endStr ? Math.min(parseInt(endStr, 10), totalSize - 1) : totalSize - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= totalSize || start > end) {
    return null;
  }
  return { start, end };
}

if (process.argv.includes('--serve')) {
  const port = Number(process.env.PORT) || 3000;
  const distRoot = path.resolve(dist);
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.mp3': 'audio/mpeg'
  };

  const server = http.createServer((req, res) => {
    const method = (req.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
      res.end('Method Not Allowed');
      return;
    }

    let urlPath = '/';
    try {
      urlPath = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad Request');
      return;
    }

    const relPath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    let filePath = path.resolve(distRoot, relPath);

    if (!filePath.startsWith(distRoot + path.sep) && filePath !== distRoot) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      if (!path.extname(filePath)) {
        filePath = path.join(distRoot, 'index.html');
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const pipeFile = (streamOpts) => {
      if (method === 'HEAD') {
        res.end();
        return;
      }
      const stream = fs.createReadStream(filePath, streamOpts);
      stream.on('error', () => {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        }
        res.end('Internal Server Error');
      });
      stream.pipe(res);
    };

    const range = req.headers.range;
    if (range) {
      const parsed = parseByteRange(range, stat.size);
      if (!parsed) {
        res.writeHead(416, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Range': `bytes */${stat.size}`
        });
        res.end('Range Not Satisfiable');
        return;
      }
      res.writeHead(206, {
        'Content-Type': contentType,
        'Content-Range': `bytes ${parsed.start}-${parsed.end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': parsed.end - parsed.start + 1
      });
      pipeFile({ start: parsed.start, end: parsed.end });
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Content-Length': stat.size
    });
    pipeFile();
  });

  server.listen(port, () => {
    console.log(`Serving 小熊写字本 at http://localhost:${port}`);
  });
}
