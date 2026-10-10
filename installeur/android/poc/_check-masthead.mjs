/* ============================================================
   _check-masthead.mjs — mesure le chevauchement avatar / dés
   ------------------------------------------------------------
   Bug rapporte en test reel (Pixel 7a, 393px) : le bouton rond
   de l'avatar recouvre la moitie du 2e dé. Cause candidate :
   .masthead = grille minmax(0,1fr) | auto, h1 en nowrap sans
   min-width:0 -> contenu de la colonne 1 qui deborde sous la
   colonne 2 (l'avatar, peint apres dans le DOM).

   Ce script mesure la geometrie reelle (rectangles du DOM) a la
   largeur d'un telephone, AVANT/APRES correction CSS.
   Sortie non nulle => bug present.
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

/* Largeur logique d'un telephone (Pixel 7a = 1080px / ~2.75 dppx)
   + tablette et desktop pour verifier que le retour a la ligne ne
   se declenche QUE quand c'est necessaire. */
const WIDTHS = [393, 360, 412, 768, 1280];

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
  await page.setViewport({ width, height: 900, deviceScaleFactor: 2.75 });
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
    return {
      avatar: av, die1: d[0], die2: d[1],
      ov1: ov(d[0]), ov2: ov(d[1]),
      leftCol: line ? +line.getBoundingClientRect().width.toFixed(1) : null,
      /* hauteur du masthead : > ~70px => la rangee s'est retournee */
      mastH: mh ? +mh.getBoundingClientRect().height.toFixed(1) : null,
      /* contenu reel de la rangee (peut deborder de la colonne) */
      lineScroll: line ? line.scrollWidth : null,
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
  const ko = overlap > 0 || overflowX;
  if (ko) bad++;
  rows.push({
    width, overlapPx: overlap, die1: m.ov1, die2: m.ov2,
    leftCol: m.leftCol, mastH: m.mastH, lineScroll: m.lineScroll,
    scrollW: m.scrollW, overflowX, ...(ko ? { KO: true } : {}),
  });
}

await browser.close();
server.close();

console.log('\nlargeur | chevauchement avatar/dé | hauteur masthead | contenu rangee | scrollWidth');
for (const r of rows) {
  if (r.err) { console.log(`${r.width}px | ERREUR : ${r.err}`); continue; }
  const wrapped = r.mastH > 90 ? ' (rangee retournee)' : ' (1 rangee)';
  console.log(`${r.width}px | ${r.overlapPx}px (dé1=${r.die1}, dé2=${r.die2}) | ${r.mastH}px${wrapped} | ${r.lineScroll}px | ${r.scrollW}px${r.overflowX ? ' (DEBORDE)' : ''}${r.KO ? '  <-- BUG' : ''}`);
}
console.log(bad ? `\n${bad} largeur(s) en echec` : '\nOK : aucun chevauchement');
for (const s of shots) console.log('capture : ' + s);
process.exit(bad ? 1 : 0);
