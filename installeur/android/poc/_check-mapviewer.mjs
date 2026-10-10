/* ============================================================
   _check-mapviewer.mjs — visionneuse de cartes (non-regression)
   ------------------------------------------------------------
   Invariant principal : la carte ne peut JAMAIS sortir de l'ecran,
   quel que soit le glissement (l'ancien mode .map-image.fullscreen
   perdait fond + carte hors ecran = ecran vide bloquant).

   Controles : vue "fit" a l'ouverture, borne de translation (drag
   hors-echec), zoom molette ancre sur le curseur, pinch 2 doigts,
   fermeture croix / Echap / clic-fond (avec garde anti-glissement),
   nettoyage complet a la fermeture.
   Sortie non nulle => regression.
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './server.js';
import puppeteer from 'puppeteer-core';

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
const exe = CANDIDATES.find((p) => fs.existsSync(p));
if (!exe) throw new Error('Chrome/Edge introuvable (CHROME_PATH)');

const WIDTHS = [411, 393, 320];
const MARGE = 48;                 /* px de carte min. visibles (cf. script.js) */
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '_mapviewer-shots');

const { server, url } = await startServer(0);
const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});

let bad = 0;
const rows = [];
const echec = (w, tag, detail) => { bad++; rows.push({ w, tag, ko: true, detail }); };

const V = 'document.getElementById("mapViewer")';
const I = 'document.getElementById("mapViewerImg")';

for (const width of WIDTHS) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  await page.goto(url + '/fl-sheet/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    '(() => { const i = document.querySelector(".map-image");'
    + ' return i && i.complete && i.naturalWidth; })()', { timeout: 30000 });

  const ouvrir = () => page.evaluate(
    'document.querySelector(".map-image").click();'
    + ' document.getElementById("mapViewer").hidden === false');
  const ferme = () => page.evaluate(`${V}.hidden`);

  /* intersection image / viewport (ce que l'utilisateur voit reellement) */
  const inter = () => page.evaluate(
    `(() => { const v = ${V}.getBoundingClientRect();`
    + ` const i = ${I}.getBoundingClientRect();`
    + ' return {'
    + '  x: Math.max(0, Math.min(v.right, i.right) - Math.max(v.left, i.left)),'
    + '  y: Math.max(0, Math.min(v.bottom, i.bottom) - Math.max(v.top, i.top))'
    + ' }; })()');

  const metrique = () => page.evaluate(
    `(() => { const img = ${I};`
    + ' const m = new DOMMatrixReadOnly(getComputedStyle(img).transform);'
    + ` const v = ${V}.getBoundingClientRect();`
    + ' return { scale: m.a, tx: m.e, ty: m.f, vw: v.width, vh: v.height,'
    + '          nw: img.naturalWidth, nh: img.naturalHeight }; })()');

  /* point de la carte (coordonnees image) sous un point ecran */
  const pointImage = (ax, ay) => page.evaluate(
    `(() => { const img = ${I};`
    + ' const m = new DOMMatrixReadOnly(getComputedStyle(img).transform);'
    + ` return { wx: (${ax} - m.e) / m.a, wy: (${ay} - m.f) / m.d }; })()`);

  /* position PEINTE de l'image (rect reel, pas la valeur de transform) */
  const rectImg = () => page.evaluate(
    `(() => { const r = ${I}.getBoundingClientRect();`
    + ` const v = ${V}.getBoundingClientRect();`
    + ' return { cx: r.x + r.width / 2, cy: r.y + r.height / 2,'
    + '          vx: v.x + v.width / 2, vy: v.y + v.height / 2 }; })()');

  /* coin du viewport garanti hors image (le fond n'est visible que la) */
  const coinLibre = () => page.evaluate(
    `(() => { const v = ${V}.getBoundingClientRect();`
    + ` const i = ${I}.getBoundingClientRect();`
    + ' const coins = [[v.left + 2, v.top + 2], [v.right - 3, v.top + 2],'
    + '  [v.left + 2, v.bottom - 3], [v.right - 3, v.bottom - 3]];'
    + ' for (const c of coins) {'
    + '  if (c[0] < i.left || c[0] > i.right || c[1] < i.top || c[1] > i.bottom)'
    + '   return { x: c[0], y: c[1] }; }'
    + ' return { x: v.left + 2, y: v.top + 2 }; })()');

  /* ---- T1 : ouverture = vue fit, image centree (rect PEINT) ---- */
  await ouvrir();
  const fit = await metrique();
  const fitAttendu = Math.min(fit.vw / fit.nw, fit.vh / fit.nh);
  const r1 = await rectImg();
  const fitOk = Math.abs(fit.scale - fitAttendu) < 0.01
    && Math.abs(r1.cx - r1.vx) < 2 && Math.abs(r1.cy - r1.vy) < 2;
  if (!fitOk) {
    echec(width, 'T1 fit', `scale=${fit.scale} (attendu ${fitAttendu}), centre `
      + `(${Math.round(r1.cx)},${Math.round(r1.cy)}) vs `
      + `(${Math.round(r1.vx)},${Math.round(r1.vy)})`);
  }

  /* ---- T2 : glissements geants -> la carte reste visible (borne) ---- */
  for (const [dx, dy] of [[-2500, -1800], [2500, 1800], [-2500, 1800]]) {
    await page.mouse.move(width / 2, 300);
    await page.mouse.down();
    await page.mouse.move(width / 2 + dx, 300 + dy, { steps: 4 });
    await page.mouse.up();
    const n = await inter();
    if (n.x < MARGE - 1 || n.y < MARGE - 1) {
      echec(width, 'T2 borne', `intersection ${Math.round(n.x)}x${Math.round(n.y)} < ${MARGE}`);
      break;
    }
  }

  /* ---- T3 : molette -> zoom ancre sur le curseur ---- */
  await ouvrir();   /* re-fit pour repartir d'un etat connu */
  await page.mouse.move(120, 280);
  const av = await metrique();
  const pAv = await pointImage(120, 280);
  /* deltaY fort : les 2 axes passent en "overflow", l'ancre est alors
     exacte (une carte entierement visible reste recentree = normal). */
  await page.mouse.wheel({ deltaY: -1200 });
  const ap = await metrique();
  const pAp = await pointImage(120, 280);
  const ancreOk = ap.scale > av.scale * 2
    && Math.abs(pAp.wx - pAv.wx) < 1.5 && Math.abs(pAp.wy - pAv.wy) < 1.5;
  if (!ancreOk) {
    echec(width, 'T3 molette', `scale ${av.scale} -> ${ap.scale}, derive ancre `
      + `${Math.round(Math.hypot(pAp.wx - pAv.wx, pAp.wy - pAv.wy) * 10) / 10}px`);
  }

  /* ---- T4 : pinch 2 doigts (PointerEvents tactiles synthetiques) ---- */
  await ouvrir();
  const pAv2 = await metrique();
  await page.evaluate(
    `(() => { const v = ${V};`
    + ' const mk = (t, id, x, y) => v.dispatchEvent(new PointerEvent(t, {'
    + '  pointerId: id, clientX: x, clientY: y, pointerType: "touch",'
    + '  isPrimary: id === 1, bubbles: true }));'
    + ' mk("pointerdown", 1, 200, 320); mk("pointerdown", 2, 260, 320);'
    + ' mk("pointermove", 1, 130, 320); mk("pointermove", 2, 330, 320);'
    + ' mk("pointerup", 1, 130, 320); mk("pointerup", 2, 330, 320); })()');
  const pAp2 = await metrique();
  if (!(pAp2.scale > pAv2.scale * 1.5)) {
    echec(width, 'T4 pinch', `scale ${pAv2.scale} -> ${pAp2.scale}`);
  }

  /* ---- T5 : fermetures (croix, Echap, clic-fond, garde anti-glissement) ---- */
  await page.click('#mapViewerClose');
  if (!(await ferme())) echec(width, 'T5 croix', 'la croix ne ferme pas');

  await ouvrir();
  await page.keyboard.press('Escape');
  if (!(await ferme())) echec(width, 'T5 echap', 'Escape ne ferme pas');

  await ouvrir();
  const coin = await coinLibre();
  await page.mouse.click(coin.x, coin.y);          /* fond = hors image */
  if (!(await ferme())) echec(width, 'T5 clic-fond', 'le clic sur le fond ne ferme pas');

  await ouvrir();
  const coin2 = await coinLibre();
  await page.mouse.move(coin2.x, coin2.y);         /* glissement sur le fond */
  await page.mouse.down();
  await page.mouse.move(coin2.x + 120, coin2.y - 80, { steps: 4 });
  await page.mouse.up();
  if (await ferme()) echec(width, 'T5 garde-drag', 'un glissement a ferme la visionneuse');

  /* ---- T6 : nettoyage apres fermeture ---- */
  await page.click('#mapViewerClose');
  const proprete = await page.evaluate(
    `(${V}.hidden ? '' : 'viewer visible ; ')`
    + `+ (${I}.style.transform ? 'transform residuel ; ' : '')`
    + '+ (document.body.classList.contains("viewer-open") ? "body lock residuel ; " : "")');
  if (proprete) echec(width, 'T6 nettoyage', proprete.trim());

  if (process.env.SHOT) {
    fs.mkdirSync(OUT, { recursive: true });
    await ouvrir();
    await page.mouse.move(width / 2, 320);
    await page.mouse.down();
    await page.mouse.move(width / 2 - 90, 320 - 40, { steps: 3 });
    await page.mouse.up();
    await page.screenshot({ path: path.join(OUT, `mapviewer-${width}.png`) });
  }

  if (!rows.some((r) => r.w === width && r.ko)) {
    rows.push({ w: width, tag: 'OK', fit: `${Math.round(fit.scale * 1000) / 10}%`,
      molette: `${av.scale} -> ${Math.round(ap.scale * 100) / 100}`,
      pinch: `${pAv2.scale} -> ${Math.round(pAp2.scale * 100) / 100}` });
  }
  await page.close();
}

await browser.close();
server.close();

for (const r of rows) {
  if (r.ko) console.log(`${r.w}px | ${r.tag} | ${r.detail}  <-- BUG`);
  else console.log(`${r.w}px | OK | fit=${r.fit} | molette x${r.molette} | pinch x${r.pinch}`);
}
console.log(bad ? `\n${bad} controle(s) en echec` : '\nOK : visionneuse (fit, bornes, molette, pinch, fermetures)');
process.exit(bad ? 1 : 0);
