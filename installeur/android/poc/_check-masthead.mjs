/* ============================================================
   _check-masthead.mjs — geometrie du masthead (1 ligne, sans recouvrement)
   ----------------------------------------------------------------------------
   Bugs constates en test reel (Pixel 7a : 1080px physiques / 2.625 = 411px
   logiques, font_scale systeme 1.15) :
     1) le bouton rond de l'avatar recouvrait la moitie du 2e de ;
     2) le titre du masthead passait sur 2 lignes des que la place manquait.
   Correctifs : min-width:0 + ellipsis sur le h1, gap .5rem de la rangee, et
   surtout ajusterTitreMasthead() (script.js) qui mesure la place reelle et
   reduit la fonte du h1 — SEULE facon de garantir une ligne, le zoom texte
   systeme (x1.15 sur l'appareil de test) n'etant pas anticipable en CSS.

   NOTE : ce banc (Chrome desktop) ne peut PAS simuler font_scale ; la
   validation avec zoom se fait sur appareil via poc/_diag-css.mjs.

   Mesure les rectangles DOM reels (avatar, des, wrap, debordement).
   Sortie non nulle => regression.
   ============================================================ */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

/* Largeurs logiques d'ecrans reels : 411 = Pixel 7a (1080 / 2.625, l'appareil
   de test), 393 = Pixel 5/6a, 412 = Pixel 7/8, 360 = standard Android,
   320 = petit ecran (filet), 768/1280 = tablette/desktop. */
const WIDTHS = [411, 393, 412, 360, 320, 768, 1280];

const { server, url } = await startServer(0);
const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  /* NOTE : ne PAS bloquer les polices ici. Les metriques du h1 (Barlow
     Condensed) determinant ou se terminent la rangee de des ; sans elles
     la fonte systeme de repli est plus large et deplace les des — la
     mesure ne correspond plus a l'ecran reel. L'APK sert les memes
     familles en local (route /css2 + /gfont/), donc c'est bien la meme
     geometrie qu'en test appareil. */
});

let bad = 0;
const rows = [];
const shots = [];

for (const width of WIDTHS) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, deviceScaleFactor: 2.625 });
  await page.goto(url + '/fl-sheet/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  /* Attendre les fontes AVANT mesure : le wrapping de la rangee du
     masthead depend de la largeur reelle du h1. */
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await page.waitForSelector('.die', { timeout: 15000 });

  const m = await page.evaluate(() => {
    /* Le conteneur depend de l'etat (anon/logue) et de la dispo PHP :
       on l'affiche pour mesurer la geometrie, qui est la meme. */
    const box = document.querySelector('#anonAvatarContainer');
    if (box) box.hidden = false;
    const btn = document.querySelector('#anonAvatarContainer .user-avatar');
    const dies = [...document.querySelectorAll('.die')];
    if (!btn || dies.length !== 2) return null;

    const R = (el) => {
      const b = el.getBoundingClientRect();
      return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), r: +b.right.toFixed(1), b: +b.bottom.toFixed(1) };
    };
    const inter = (a, b) => +(Math.max(0, Math.min(a.r, b.r) - Math.max(a.x, b.x))
      * Math.max(0, Math.min(a.b, b.b) - Math.max(a.y, b.y))).toFixed(1);

    const av = R(btn);
    const d = dies.map(R);
    /* Largeur de chevauchement horizontale (ce que "recouvre" l'avatar). */
    const ov = (a) => +(Math.max(0, Math.min(a.r, av.r) - Math.max(a.x, av.x))).toFixed(1);
    const line = document.querySelector('.masthead > div:first-child');
    const mh = document.querySelector('.masthead');
    /* Retour a la ligne : sur une meme rangee, les gauches sont
       STRICTEMENT croissantes. (offsetTop ne marche pas : avec
       align-items:center, des enfants de hauteurs differentes ont des
       tops differents meme cote a cote.) */
    const kids = [...line.children].filter((k) => k.getClientRects().length);
    const kr = kids.map((k) => k.getBoundingClientRect());
    const wrapped = kr.some((r, i) => i > 0 && r.left < kr[i - 1].left);
    const gapPx = parseFloat(getComputedStyle(line).gap) || 0;
    const kidsW = kr.reduce((s, r) => s + r.width, 0) + gapPx * Math.max(0, kr.length - 1);
    const h1El = document.querySelector('.masthead h1');
    return {
      avatar: av, die1: d[0], die2: d[1],
      ov1: ov(d[0]), ov2: ov(d[1]),
      leftCol: line ? +line.getBoundingClientRect().width.toFixed(1) : null,
      /* hauteur du masthead : > ~90px => la rangee s'est retournee */
      mastH: mh ? +mh.getBoundingClientRect().height.toFixed(1) : null,
      /* contenu reel de la rangee (peut deborder de la colonne) */
      lineScroll: line ? line.scrollWidth : null,
      wrapped,
      contentW: +kidsW.toFixed(1),
      avail: line ? +line.getBoundingClientRect().width.toFixed(1) : null,
      slack: line ? +(line.getBoundingClientRect().width - kidsW).toFixed(1) : null,
      h1Font: h1El ? getComputedStyle(h1El).fontSize : null,
      h1W: h1El ? +h1El.getBoundingClientRect().width.toFixed(1) : null,
      scrollW: document.documentElement.scrollWidth,
    };
  });

  /* Preuve visuelle du rendu a la largeur d'un telephone. */
  if (process.env.SHOT) {
    const shot = path.join(os.tmpdir(), `fl-masthead-${width}.png`);
    await page.screenshot({ path: shot, clip: { x: 0, y: 0, width, height: 150 } });
    shots.push(shot);
  }

  await page.close();
  if (!m) { rows.push({ width, err: 'avatar/des introuvables' }); bad++; continue; }

  const overlap = Math.max(m.ov1, m.ov2);
  const overflowX = m.scrollW > width;
  /* Telephones (>=360px) : le header doit tenir sur UNE ligne. Le wrap
     flex n'est qu'un filet de securite pour les ecrans tres etroits. */
  const wantSingle = width >= 360;
  const ko = overlap > 0 || overflowX || (wantSingle && m.wrapped);
  if (ko) bad++;
  rows.push({
    width, overlapPx: overlap, die1: m.ov1, die2: m.ov2,
    mastH: m.mastH, wrapped: m.wrapped, contentW: m.contentW,
    avail: m.avail, slack: m.slack, h1Font: m.h1Font, h1W: m.h1W,
    scrollW: m.scrollW, overflowX, ...(ko ? { KO: true } : {}),
  });
}

await browser.close();
server.close();

console.log('\nlargeur | recouvrement | lignes | fonte h1 | contenu rangee | marge | scrollWidth');
for (const r of rows) {
  if (r.err) { console.log(`${r.width}px | ERREUR : ${r.err}`); continue; }
  console.log(`${r.width}px | ${r.overlapPx}px (dé1=${r.die1}, dé2=${r.die2}) | `
    + `${r.wrapped ? '2 LIGNES' : '1 ligne '} (h=${r.mastH}px) | ${r.h1Font} -> ${r.h1W}px | `
    + `${r.contentW}/${r.avail}px (marge ${r.slack}px) | ${r.scrollW}px`
    + `${r.overflowX ? ' (DEBORDE)' : ''}${r.KO ? '  <-- BUG' : ''}`);
}
console.log(bad
  ? `\n${bad} largeur(s) en echec (recouvrement, debordement, ou 2 lignes sur telephone)`
  : '\nOK : une ligne sur telephone, aucun recouvrement');
for (const s of shots) console.log('capture : ' + s);
process.exit(bad ? 1 : 0);
