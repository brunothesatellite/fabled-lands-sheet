/* ============================================================
   run.js — pilote automatise du POC Android (etape 1)
   ------------------------------------------------------------
   Demarre le serveur statique, ouvre la webapp dans Chrome/Edge
   systeme (puppeteer-core) et valide les gates decisifs :
      G1  page index.html rendue et stylee (#tabBar + style.css),
          polices FA + Google BLOQUEES (host-resolver-rules)
      G2  api/auth.php execute par le Service Worker (JSON)
      G3  inscription SQLite + session (cookie interne php-wasm)
      G4  _diag.php : php=8.4 + extension sqlite3 chargee (.so)
      G5  login.php rendu par PHP (navigation SW) puis re-login
      G6  session apres rechargement de page
      G7-G9 apres REDMARRAGE complet du navigateur :
          session, SQLite, double inscription refusee (BDD vivante)
      G10 import bulk : 1020 cles en < 5 s (patch stdin O(1))
      G11 export : createObjectURL + download= -> JSON horodate
      G12 les 8 maps/*.webp se chargent (naturalWidth > 0)
   Bloque les polices Google ET cdnjs (simulation hors-ligne totale :
   la webapp doit rester utilisable sans Internet).
   ============================================================ */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { startServer } from './server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE = path.join(os.tmpdir(), 'fl-poc-profile');
const DOWNLOADS = path.join(os.tmpdir(), 'fl-poc-downloads');
const results = [];

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error('Aucun Chrome/Edge trouve (definez CHROME_PATH).');
  }
  return found;
}

function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail: String(detail) });
  console.log((ok ? '[OK]   ' : '[FAIL] ') + name + (detail ? ' — ' + detail : ''));
}

async function attempt(name, fn) {
  try {
    const detail = await fn();
    check(name, true, detail || '');
  } catch (err) {
    check(name, false, (err && err.message) || String(err));
  }
}

async function fetchCheck(page) {
  return page.evaluate(async () => {
    const r = await fetch('api/auth.php?action=check', { credentials: 'same-origin' });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* pas de JSON */ }
    return { status: r.status, type: r.headers.get('content-type') || '', json, text };
  });
}

async function openApp(browser, url, logs) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on('console', (m) => logs.push('[page] ' + m.text()));
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  page.on('requestfailed', (r) =>
    logs.push('[reqfail] ' + r.url() + ' :: ' + ((r.failure() && r.failure().errorText) || '')));

  await page.goto(url + '/fl-sheet/boot-poc.html', { waitUntil: 'domcontentloaded', timeout: 90000 });

  const swTarget = await browser
    .waitForTarget((t) => t.type() === 'service_worker' && t.url().includes('cgi-worker.mjs'), { timeout: 60000 })
    .catch(() => null);
  if (swTarget) {
    const worker = await swTarget.worker().catch(() => null);
    if (worker) {
      worker.on('console', (m) => logs.push('[sw] ' + m.text()));
      worker.on('error', (e) => logs.push('[swerror] ' + String(e)));
    }
  }

  await page.waitForFunction(() => location.pathname.startsWith('/fl-sheet/'), {
    timeout: 90000, polling: 200,
  });
  await page.waitForSelector('#tabBar', { timeout: 90000 });
  return page;
}

function dumpLogs(logs) {
  if (results.some((r) => !r.ok) && logs.length) {
    console.log('\n--- dernieres logs (page + SW) ---');
    for (const line of logs.slice(-50)) console.log('  ' + line);
    console.log('--- fin logs ---\n');
  }
}

/* ============================================================ */

const exe = findBrowser();
console.log('Navigateur : ' + exe);
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.rmSync(DOWNLOADS, { recursive: true, force: true });
fs.mkdirSync(DOWNLOADS, { recursive: true });
console.log('Profil     : ' + PROFILE + ' (supprime pour cette execution)');

const { server, url } = await startServer(0);
console.log('Serveur    : ' + url);

const launchOpts = {
  executablePath: exe,
  headless: true,
  userDataDir: PROFILE,
  protocolTimeout: 300000,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    /* polices Google + FA cdnjs mappees sur un port ferme : la webapp
       doit rester utilisable sans Internet (cas Android hors-ligne) */
    '--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1, MAP fonts.gstatic.com 127.0.0.1, MAP cdnjs.cloudflare.com 127.0.0.1',
  ],
};

let browser = await puppeteer.launch(launchOpts);
let pseudo = 'poc' + Date.now().toString(36);

let logsA = [];
try {
  /* ---------------- PHASE A : session froide ---------------- */
  console.log('\n=== PHASE A : premiere execution ===');
  logsA = [];
  const page = await openApp(browser, url, logsA);

  await attempt('G1 page index.html stylée (#tabBar + style.css, FA/Google bloquees)', async () => {
    const styled = await page.evaluate(() => {
      const sheet = [...document.styleSheets].find((s) => (s.href || '').includes('style.css'));
      let rules = -1;
      try { rules = sheet ? sheet.cssRules.length : -1; } catch { rules = -3; }
      const tabBar = document.querySelector('#tabBar');
      const bg = tabBar ? getComputedStyle(tabBar).backgroundColor : '';
      return { rules, hasTabBar: !!tabBar, bg, title: document.title };
    });
    const ok = styled.hasTabBar && styled.rules > 50;
    if (!ok) throw new Error(JSON.stringify(styled));
    /* les CDN sont bloques : aucune requete reussie vers eux */
    const cdnOk = logsA.some((l) => l.startsWith('[reqfail]')
      && /fonts\.googleapis|fonts\.gstatic|cdnjs/.test(l));
    if (!cdnOk) throw new Error('aucune requete CDN echouee (blocage non actif ?)');
    return `regles=${styled.rules} bg=${styled.bg} cdn-bloque=oui`;
  });

  await attempt('G2 api/auth.php execute par le SW (JSON, logged_in=false)', async () => {
    const res = await fetchCheck(page);
    if (!res.json || !res.type.includes('json') || res.json.logged_in !== false) {
      throw new Error(`status=${res.status} type=${res.type} body=${res.text.slice(0, 150)}`);
    }
    return `status=${res.status}`;
  });

  await attempt('G3 inscription (SQLite + reponse ok)', async () => {
    /* register.php pose form_ts (garde anti-spam : >= 3 s) + honeypot
       website (doit rester vide) — meme contrat que le formulaire. */
    const res = await page.evaluate(async (p) => {
      const r = await fetch('api/auth.php?action=register', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pseudo: p, password: 'secret123',
          form_ts: Math.floor(Date.now() / 1000) - 4, website: '',
        }),
      });
      return { status: r.status, text: await r.text() };
    }, pseudo);
    let json = null;
    try { json = JSON.parse(res.text); } catch { /* pas de JSON */ }
    if (res.status !== 200 || !json || json.ok !== true) {
      throw new Error(`status=${res.status} body=${res.text.slice(0, 150)}`);
    }
    return `pseudo=${pseudo}`;
  });

  await attempt('G3b session active (pot de cookies interne php-wasm)', async () => {
    const res = await fetchCheck(page);
    if (!res.json || res.json.logged_in !== true || res.json.pseudo !== pseudo) {
      throw new Error(JSON.stringify(res.json || res.text.slice(0, 150)));
    }
    return 'logged_in=true';
  });

  await attempt('G4 _diag.php : php=8.4 + sqlite3 charge via .so', async () => {
    const d = await page.evaluate(async () => {
      const r = await fetch('_diag.php', { credentials: 'same-origin' });
      return { status: r.status, text: await r.text() };
    });
    const t = d.text || '';
    const php84 = /php=8\.4/.test(t);
    const sqlite = /chk:sqlite3=OUI/.test(t);
    const pwd = /fn:password_hash=OUI/.test(t);
    if (d.status !== 200 || !php84 || !sqlite || !pwd) {
      throw new Error(`status=${d.status} ` + t.slice(0, 200).replace(/\n/g, ' | '));
    }
    return 'php=8.4 sqlite3=OUI password_hash=OUI';
  });

  await attempt('G5 login.php rendu par PHP (navigation via SW)', async () => {
    /* login.php redirige vers index.html si la session est active :
       deconnecter d'abord pour observer le formulaire, puis reconnecter. */
    const lo = await page.evaluate(async () => {
      const r = await fetch('api/auth.php?action=logout', { credentials: 'same-origin' });
      try { return await r.json(); } catch { return { status: r.status }; }
    });
    if (!lo || lo.ok !== true) throw new Error('logout impossible : ' + JSON.stringify(lo));

    await page.goto(url + '/fl-sheet/login.php', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const login = await page.evaluate(() => ({
      pwd: !!document.getElementById('password'),
      form: !!document.getElementById('loginForm'),
      raw: (document.body.textContent || '').slice(0, 30).replace(/\s+/g, ' '),
    }));
    if (!login.pwd || !login.form || login.raw.startsWith('<?php')) {
      throw new Error(JSON.stringify(login));
    }

    const li = await page.evaluate(async (p) => {
      const r = await fetch('api/auth.php?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ pseudo: p, password: 'secret123' }),
      });
      try { return await r.json(); } catch { return { status: r.status }; }
    }, pseudo);
    if (!li || li.ok !== true) throw new Error('re-login impossible : ' + JSON.stringify(li));
    return 'formulaire connexion rendu + reconnexion';
  });

  await attempt('G6 session apres rechargement de la page', async () => {
    await page.goto(url + '/fl-sheet/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#tabBar', { timeout: 60000 });
    const res = await fetchCheck(page);
    if (!res.json || res.json.logged_in !== true || res.json.pseudo !== pseudo) {
      throw new Error(JSON.stringify(res.json || res.text.slice(0, 150)));
    }
    return 'toujours connecte';
  });

  /* G10 — import bulk : 1020 cles en un seul POST JSON (patch stdin O(1)) */
  await attempt('G10 import bulk : 1020 cles en un seul POST < 5 s', async () => {
    const r = await page.evaluate(async () => {
      const prefs = {};
      for (let i = 0; i < 1020; i++) prefs['fl-bulk-' + i] = 'v' + i + '-' + 'x'.repeat(40);
      const t0 = performance.now();
      const res = await fetch('api/auth.php?action=set_all_preferences', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: prefs }),
      });
      const j = await res.json().catch(() => null);
      const ms = performance.now() - t0;
      /* relecture : la 1020e cle doit etre served par get_preferences */
      const g = await fetch('api/auth.php?action=get_preferences', { credentials: 'same-origin' });
      const gj = await g.json().catch(() => null);
      const keys = gj && gj.preferences ? Object.keys(gj.preferences) : [];
      return {
        ok: j && j.ok, ms,
        hasFirst: keys.includes('fl-bulk-0'),
        hasLast: keys.includes('fl-bulk-1019'),
        count: keys.length,
      };
    });
    if (!r.ok) throw new Error('set_all_preferences ok=false');
    if (r.ms >= 5000) throw new Error('trop lent : ' + Math.round(r.ms) + 'ms');
    if (!r.hasFirst || !r.hasLast) {
      throw new Error('relecture incomplete (count=' + r.count + ')');
    }
    return `${Math.round(r.ms)}ms, ${r.count} cles relues`;
  });

  /* G11 — export : <a download> + createObjectURL -> JSON horodate */
  await attempt('G11 export : createObjectURL + download= produit le JSON', async () => {
    const cdp = await page.createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', {
      behavior: 'allow', downloadPath: DOWNLOADS, eventsEnabled: true,
    });
    const dlEvent = new Promise((resolve) => {
      cdp.on('Browser.downloadWillBegin', (e) => resolve(e));
      setTimeout(() => resolve(null), 15000);
    });
    const doneEvent = new Promise((resolve) => {
      cdp.on('Browser.downloadProgress', (e) => {
        if (e.state === 'completed') resolve(e);
      });
      setTimeout(() => resolve(null), 15000);
    });

    await page.evaluate(() => {
      /* le bouton vit dans un menu deroulant (hidden) : appeler la
         fonction de la webapp = meme chemin reel (blob + <a download>) */
      exporterDonnees();
    });
    const began = await dlEvent;
    if (!began) throw new Error('aucun evenement de telechargement');
    await doneEvent;

    const file = path.join(DOWNLOADS, began.suggestedFilename);
    const deadline = Date.now() + 10000;
    while (!fs.existsSync(file) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
    }
    if (!fs.existsSync(file)) throw new Error('fichier absent : ' + file);
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    const okName = /^[a-zA-Z0-9_-]{1,30}-\d{8}-\d{6}\.json$/.test(began.suggestedFilename);
    const okShape = json && json.format === 'fl-local-storage' && json.version === 1
      && typeof json.exportedAt === 'string' && !isNaN(Date.parse(json.exportedAt))
      && json.data && typeof json.data === 'object';
    if (!okName || !okShape) {
      throw new Error(JSON.stringify({ name: began.suggestedFilename, format: json && json.format }));
    }
    return began.suggestedFilename;
  });

  /* G12 — les 8 cartes webp se chargent (hors-ligne, statique) */
  await attempt('G12 les 8 maps/*.webp ont naturalWidth > 0', async () => {
    const maps = await page.evaluate(async () => {
      const imgs = [...document.querySelectorAll('img.map-image')];
      await Promise.all(imgs.map((im) => im.complete ? null
        : new Promise((res) => { im.onload = im.onerror = res; })));
      return imgs.map((im) => ({
        src: (im.getAttribute('src') || '').split('/').pop(),
        w: im.naturalWidth, h: im.naturalHeight,
      }));
    });
    if (maps.length !== 8) throw new Error('nombre de cartes = ' + maps.length);
    const broken = maps.filter((m) => !(m.w > 0));
    if (broken.length) throw new Error('non chargees : ' + JSON.stringify(broken));
    return maps.map((m) => `${m.src} ${m.w}x${m.h}`).join(', ');
  });

  await new Promise((r) => setTimeout(r, 1500)); // laisse le temps aux syncs IDBFS
  await page.close();
} catch (err) {
  check('Phase A (execution globale)', false, (err && err.stack) || String(err));
} finally {
  dumpLogs(logsA);
  await browser.close().catch(() => {});
}

/* ------- PHASE B : redemarrage complet du navigateur ------- */
let logsB = [];
try {
  console.log('\n=== PHASE B : apres redemarrage du navigateur (persistance IDBFS) ===');
  browser = await puppeteer.launch(launchOpts);
  logsB = [];
  const page = await openApp(browser, url, logsB);

  await attempt('G7 session toujours active apres restart complet', async () => {
    const res = await fetchCheck(page);
    if (!res.json || res.json.logged_in !== true || res.json.pseudo !== pseudo) {
      throw new Error(JSON.stringify(res.json || res.text.slice(0, 150)));
    }
    return `pseudo=${pseudo}`;
  });

  const pseudo2 = 'poc' + (Date.now() + 1).toString(36);
  await attempt('G8 nouveau compte enregistre apres restart (SQLite vivant)', async () => {
    const res = await page.evaluate(async (p) => {
      const r = await fetch('api/auth.php?action=register', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pseudo: p, password: 'secret123',
          form_ts: Math.floor(Date.now() / 1000) - 4, website: '',
        }),
      });
      return { status: r.status, text: await r.text() };
    }, pseudo2);
    let json = null;
    try { json = JSON.parse(res.text); } catch { /* pas de JSON */ }
    if (res.status !== 200 || !json || json.ok !== true) {
      throw new Error(`status=${res.status} body=${res.text.slice(0, 150)}`);
    }
    return `pseudo=${pseudo2}`;
  });

  await attempt('G9 double inscription du compte phase A refusee (table users persistee)', async () => {
    const res = await page.evaluate(async (p) => {
      const r = await fetch('api/auth.php?action=register', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pseudo: p, password: 'secret123',
          form_ts: Math.floor(Date.now() / 1000) - 4, website: '',
        }),
      });
      return { status: r.status, text: await r.text() };
    }, pseudo);
    let json = null;
    try { json = JSON.parse(res.text); } catch { /* pas de JSON */ }
    const accepted = res.status === 200 && json && json.ok === true;
    if (accepted) throw new Error('double inscription ACCEPTEE : DB perdue !');
    /* refus attendu : pseudo deja pris (pas un 400 honeypot) */
    if (!/already taken/i.test(res.text || '')) {
      throw new Error(`refus inattendu : status=${res.status} ${(res.text || '').slice(0, 80)}`);
    }
    return `status=${res.status} ${(res.text || '').slice(0, 80)}`;
  });

  await page.close();
} catch (err) {
  check('Phase B (execution globale)', false, (err && err.stack) || String(err));
} finally {
  dumpLogs(logsB);
  await browser.close().catch(() => {});
  server.close();
}

/* ------------------------- bilan ------------------------- */
const fails = results.filter((r) => !r.ok);
console.log('\n=====================================');
console.log(`POC : ${results.length - fails.length}/${results.length} gates OK`);
console.log('=====================================');
process.exit(fails.length ? 1 : 0);
