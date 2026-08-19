'use strict';
const fs = require('fs/promises');
const path = require('path');
const MARKUP_EXTENSIONS = new Set(['.html','.htm','.svg','.xml']);
const CSS_EXTENSIONS = new Set(['.css']);
function normalizeBasePath(value = '/') {
  const raw = String(value == null ? '/' : value).trim();
  if (!raw || raw === '/' || raw.toLowerCase() === 'root') return '/';
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.includes('?') || raw.includes('#')) {
    throw new Error('Site base path must be a path such as /portfolio/, not a URL.');
  }
  const parts = raw.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.some((part) => part === '.' || part === '..')) throw new Error('Site base path may not contain . or .. segments.');
  return `/${parts.join('/')}/`;
}
function prefixRootRelativeUrl(value, basePath) {
  const source = String(value || '');
  const base = normalizeBasePath(basePath);
  if (base === '/' || !source.startsWith('/') || source.startsWith('//')) return source;
  const baseWithoutTrailingSlash = base.slice(0, -1);
  if (source === baseWithoutTrailingSlash || source.startsWith(`${baseWithoutTrailingSlash}/`)) return source;
  if (source === '/') return base;
  return `${baseWithoutTrailingSlash}${source}`;
}
function rewriteSrcset(value, basePath) {
  return String(value || '').split(',').map((candidate) => {
    const match = candidate.match(/^(\s*)(\S+)([\s\S]*)$/);
    if (!match) return candidate;
    return `${match[1]}${prefixRootRelativeUrl(match[2], basePath)}${match[3]}`;
  }).join(',');
}
function rewriteCssText(text, basePath) {
  let output = String(text || '');
  output = output.replace(/url\(\s*(["']?)(\/(?!\/)[^"')\s]+)\1\s*\)/gi,
    (_match, quote, url) => `url(${quote}${prefixRootRelativeUrl(url, basePath)}${quote})`);
  output = output.replace(/(@import\s+)(["'])(\/(?!\/)[^"']+)\2/gi,
    (_match, prefix, quote, url) => `${prefix}${quote}${prefixRootRelativeUrl(url, basePath)}${quote}`);
  return output;
}
function rewriteMarkupText(text, basePath) {
  let output = String(text || '');
  output = output.replace(/(\b(?:href|src|poster|action|formaction|data-src|data-href)\s*=\s*)(["'])(\/(?!\/)[^"']*)\2/gi,
    (_match, prefix, quote, url) => `${prefix}${quote}${prefixRootRelativeUrl(url, basePath)}${quote}`);
  output = output.replace(/(\b(?:href|src|poster|action|formaction|data-src|data-href)\s*=\s*)(\/(?!\/)[^\s>]+)/gi,
    (_match, prefix, url) => `${prefix}${prefixRootRelativeUrl(url, basePath)}`);
  output = output.replace(/(\bsrcset\s*=\s*)(["'])([^"']*)\2/gi,
    (_match, prefix, quote, value) => `${prefix}${quote}${rewriteSrcset(value, basePath)}${quote}`);
  return rewriteCssText(output, basePath);
}
async function rebaseOutputDirectory(outputPath, basePath) {
  const base = normalizeBasePath(basePath);
  if (base === '/') return { basePath: '/', changedFiles: [] };
  const changedFiles = [];
  async function walk(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) { await walk(full); continue; }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!MARKUP_EXTENSIONS.has(ext) && !CSS_EXTENSIONS.has(ext)) continue;
      const before = await fs.readFile(full, 'utf8');
      const after = MARKUP_EXTENSIONS.has(ext) ? rewriteMarkupText(before, base) : rewriteCssText(before, base);
      if (after === before) continue;
      await fs.writeFile(full, after, 'utf8');
      changedFiles.push(path.relative(outputPath, full).replace(/\\/g, '/'));
    }
  }
  await walk(outputPath);
  return { basePath: base, changedFiles };
}
(async () => {
  const basePath = process.argv[2] || '/';
  const outputPath = process.argv[3] || '_site';
  const result = await rebaseOutputDirectory(path.resolve(outputPath), basePath);
  console.log('Sholes Pages base path:', result.basePath, '·', result.changedFiles.length, 'file(s) rebased');
})().catch((error) => { console.error(error.stack || error.message || error); process.exitCode = 1; });
