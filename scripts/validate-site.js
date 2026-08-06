'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pageFiles = ['index.html', 'skills.html', 'experience.html', 'formation.html', 'contact.html'];
const failures = [];

function fail(message) {
  failures.push(message);
}

for (const file of pageFiles) {
  const absolute = path.join(root, file);
  const html = fs.readFileSync(absolute, 'utf8');

  if (!/<html\s+lang="pt-BR"/i.test(html)) fail(`${file}: atributo lang ausente`);
  if ((html.match(/<main\b/gi) || []).length !== 1) fail(`${file}: deve conter exatamente um <main>`);
  if (!/<link\s+rel="canonical"/i.test(html)) fail(`${file}: canonical ausente`);
  if (!/<meta\s+property="og:image"[^>]+og-image\.png/i.test(html)) fail(`${file}: imagem Open Graph ausente`);
  if (!/class="skip-link"/.test(html)) fail(`${file}: link para pular conteúdo ausente`);
  if (!/class="nav-toggle"/.test(html)) fail(`${file}: botão do menu móvel ausente`);
  if (!/<script\s+src="site\.js"\s+defer><\/script>/i.test(html)) fail(`${file}: site.js deve ser externo e usar defer`);
  if (/http:\/\//i.test(html)) fail(`${file}: recurso inseguro HTTP encontrado`);

  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const reference = match[1];
    if (/^(?:https?:|mailto:|tel:|#)/i.test(reference)) continue;
    const localReference = decodeURIComponent(reference.split('#')[0].split('?')[0]);
    if (localReference && !fs.existsSync(path.resolve(root, localReference))) {
      fail(`${file}: referência local ausente: ${reference}`);
    }
  }

  for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/application\/ld\+json/i.test(match[1])) {
      try { JSON.parse(match[2]); } catch (error) { fail(`${file}: JSON-LD inválido: ${error.message}`); }
    }
  }
}

const siteScript = fs.readFileSync(path.join(root, 'site.js'), 'utf8');
try { new Function(siteScript); } catch (error) { fail(`site.js: sintaxe inválida: ${error.message}`); }

const skills = fs.readFileSync(path.join(root, 'skills.html'), 'utf8');
const levels = [...skills.matchAll(/class="skill-progress"[^>]+data-level="(\d+)"/g)];
if (levels.length !== 17) fail(`skills.html: esperadas 17 habilidades, encontradas ${levels.length}`);
levels.forEach((match) => {
  const value = Number(match[1]);
  if (value < 0 || value > 100) fail(`skills.html: percentual fora do intervalo: ${value}`);
});

['robots.txt', 'sitemap.xml', 'og-image.png', 'curriculo-bruno-rafael.pdf'].forEach((file) => {
  if (!fs.existsSync(path.join(root, file))) fail(`arquivo obrigatório ausente: ${file}`);
});

if (failures.length) {
  console.error(failures.map((message) => `- ${message}`).join('\n'));
  process.exit(1);
}

console.log(`Validação concluída: ${pageFiles.length} páginas, ${levels.length} habilidades e referências locais íntegras.`);
