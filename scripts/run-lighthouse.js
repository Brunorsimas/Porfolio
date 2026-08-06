'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const port = 4173;
const pages = ['index.html', 'contact.html'];
const thresholds = {
  accessibility: 0.9,
  'best-practices': 0.85,
  performance: 0.75,
  seo: 0.9
};
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const absolute = path.resolve(root, relative);

  if (!absolute.startsWith(root + path.sep) || !fs.existsSync(absolute) || fs.statSync(absolute).isDirectory()) {
    response.writeHead(404).end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': mimeTypes[path.extname(absolute).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  fs.createReadStream(absolute).pipe(response);
});

function runCommand(command, args, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env: environment, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code));
  });
}

async function main() {
  const outputDirectory = fs.mkdtempSync(path.join(root, '.lighthouse-tmp-'));
  const lighthouseCli = path.join(root, 'node_modules', 'lighthouse', 'cli', 'index.js');
  const environment = { ...process.env };
  environment.TEMP = outputDirectory;
  environment.TMP = outputDirectory;
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (process.platform === 'win32' && fs.existsSync(edgePath)) environment.CHROME_PATH = edgePath;

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

  try {
    for (const page of pages) {
      const output = path.join(outputDirectory, page.replace('.html', '.json'));
      const exitCode = await runCommand(process.execPath, [
        lighthouseCli,
        `http://127.0.0.1:${port}/${page}`,
        '--quiet',
        '--output=json',
        `--output-path=${output}`,
        '--chrome-flags=--headless=new --no-sandbox --disable-gpu'
      ], environment);

      if (exitCode !== 0 && !fs.existsSync(output)) {
        throw new Error(`Lighthouse encerrou com código ${exitCode} sem gerar relatório`);
      }

      const report = JSON.parse(fs.readFileSync(output, 'utf8'));
      for (const [category, minimum] of Object.entries(thresholds)) {
        const score = report.categories[category].score;
        console.log(`${page} — ${category}: ${Math.round(score * 100)}`);
        if (score < minimum) throw new Error(`${page}: ${category} abaixo de ${minimum * 100}`);
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    try {
      fs.rmSync(outputDirectory, { recursive: true, force: true, maxRetries: 8, retryDelay: 500 });
    } catch (error) {
      if (error.code !== 'EPERM') throw error;
      console.warn('O Windows manteve arquivos temporários do navegador bloqueados; eles estão ignorados pelo Git.');
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
