// Shared harness: serves unpkg from local npm tarballs and mocks the Dash API.
const path = require('path');
const fs = require('fs');
// Playwright do ambiente (Claude Code na nuvem) ou o instalado no projeto; Chromium idem.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CDN = path.join(__dirname, '..', 'cdn');
const MAP = {
  'https://unpkg.com/react@18.3.1/umd/react.development.js': 'react-18.3.1/package/umd/react.development.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js': 'react-dom-18.3.1/package/umd/react-dom.development.js',
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js': 'react-18.3.1/package/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': 'react-dom-18.3.1/package/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js': 'babel-standalone-7.29.0/package/babel.min.js',
  'https://unpkg.com/html-to-image@1.11.11/dist/html-to-image.js': 'hti/package/dist/html-to-image.js',
};
async function open({ width = 1440, height = 900, user = null, base = 'http://127.0.0.1:8099/', query = '', handle = null, csp = null, dialogs = 'dismiss' } = {}) {
  const browser = await chromium.launch(require('fs').existsSync(CHROME) ? { executablePath: CHROME } : {});
  const ctx = await browser.newContext({ viewport: { width, height }, acceptDownloads: true });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.addInitScript(() => { document.addEventListener('securitypolicyviolation', (e) => console.error('[CSP] ' + e.violatedDirective + ' blocked ' + e.blockedURI)); });
  page.on('dialog', (d) => { logs.push(`[dialog:${d.type()}] ${d.message()}`); dialogs === 'accept' ? d.accept() : d.dismiss(); });
  const api = { calls: [] };
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (MAP[url]) return route.fulfill({ path: path.join(CDN, MAP[url]), contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } });
    if (url.includes('xlsx')) {
      const f = path.join(CDN, 'xlsx-0.18.5/package/dist/xlsx.full.min.js');
      return route.fulfill({ path: f, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } });
    }
    if (url.startsWith('https://dashproject-backend.onrender.com')) {
      const p = new URL(url).pathname;
      api.calls.push(route.request().method() + ' ' + p);
      const h = { 'access-control-allow-origin': base.replace(/\/$/, ''), 'access-control-allow-credentials': 'true', 'content-type': 'application/json' };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...h, 'access-control-allow-headers': 'content-type,authorization', 'access-control-allow-methods': 'GET,POST,DELETE' } });
      if (handle) { const r = handle(route.request().method(), p, route.request().postData()); if (r) return route.fulfill({ status: r.status || 200, headers: h, body: JSON.stringify(r.body) }); }
      if (!user) return route.fulfill({ status: 401, headers: h, body: JSON.stringify({ error: 'sem_refresh' }) });
      if (p === '/auth/refresh') return route.fulfill({ status: 200, headers: h, body: JSON.stringify({ access_token: 'tok' }) });
      if (p === '/me') return route.fulfill({ status: 200, headers: h, body: JSON.stringify(user) });
      if (p === '/tools/analyze') return route.fulfill({ status: 200, headers: h, body: JSON.stringify({ narrative: 'Resumo de teste.', model: 'x' }) });
      return route.fulfill({ status: 200, headers: h, body: '{}' });
    }
    if (url.startsWith('http://127.0.0.1')) {
      if (csp && route.request().resourceType() === 'document') {
        const resp = await route.fetch();
        return route.fulfill({ response: resp, headers: { ...resp.headers(), 'content-security-policy': csp } });
      }
      return route.continue();
    }
    if (url.includes('fonts.g')) return route.abort();
    logs.push('[blocked-external] ' + url);
    return route.abort();
  });
  await page.goto(base + query);
  await page.waitForFunction(() => document.querySelector('#root') && document.querySelector('#root').children.length > 0, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  return { browser, page, logs, api };
}
async function overflowX(page) {
  return page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const out = [];
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width && r.right > w + 1) {
        const cs = getComputedStyle(el);
        // skip elements inside an overflow-hidden/auto ancestor
        let p = el.parentElement, clipped = false;
        while (p && p !== document.body) { const s = getComputedStyle(p); if (/(hidden|auto|scroll|clip)/.test(s.overflowX)) { const pr = p.getBoundingClientRect(); if (pr.right <= w + 1) { clipped = true; break; } } p = p.parentElement; }
        if (!clipped && cs.position !== 'fixed') out.push(`${el.tagName.toLowerCase()}.${(el.className && el.className.baseVal === undefined ? el.className : '').toString().slice(0, 40)} right=${Math.round(r.right)} w=${w} text="${(el.textContent || '').trim().slice(0, 40)}"`);
      }
    });
    return { scrollW: document.documentElement.scrollWidth, w, offenders: out.slice(0, 12) };
  });
}
module.exports = { open, overflowX };
