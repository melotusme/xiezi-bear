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

for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(dist, file));
}

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

/stroke-data.js
  Cache-Control: public, max-age=86400

/stroke-loader.js
  Cache-Control: public, max-age=86400

/voice-engine.js
  Cache-Control: public, max-age=86400

/manifest.webmanifest
  Content-Type: application/manifest+json; charset=utf-8
  Cache-Control: public, max-age=86400

/index.html
  Cache-Control: public, max-age=0, must-revalidate
`;

fs.writeFileSync(path.join(dist, '_headers'), headers, 'utf-8');
console.log('Built dist/ successfully with', countFilesRecursive(path.join(dist, 'audio')), 'audio files.');

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
    '.mp3': 'audio/mpeg'
  };

  const server = http.createServer((req, res) => {
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
    const stat = fs.statSync(filePath);
    const range = req.headers.range;

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? Math.min(parseInt(match[2], 10), stat.size - 1) : stat.size - 1;
        if (start <= end && start < stat.size) {
          res.writeHead(206, {
            'Content-Type': contentType,
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': end - start + 1
          });
          fs.createReadStream(filePath, { start, end }).pipe(res);
          return;
        }
      }
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Content-Length': stat.size
    });
    fs.createReadStream(filePath).pipe(res);
  });

  server.listen(port, () => {
    console.log(`Serving 小熊写字本 at http://localhost:${port}`);
  });
}
