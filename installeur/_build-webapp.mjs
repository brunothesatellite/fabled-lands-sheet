#!/usr/bin/env node
/* ============================================================
   _build-webapp.mjs — artefact webapp de deploiement (zip)
   ------------------------------------------------------------
   Fabrique dist/fabled-lands-sheet-<version>-webapp.zip contenant
   UNIQUEMENT les fichiers necessaires a la webapp servie par PHP :
     - filtre partage _www-filter.mjs (memes exclusions que
       _sync-assets.mjs / server.js : pas de dev, docs, installeur)
     - exclusions propres au deploiement : donnees runtime SQLite
       (api/preferences.db, -wal, -shm)
     - LICENSE ajoute explicitement (redistribution MIT)
   Les dependances CDN (Google Fonts, Font Awesome) sont referencees
   par index.html : aucun dossier de polices n'est embarque.

   Le zip est cree via tar.exe (bsdtar natif Windows, ecrit le format
   zip depuis l'extension -a). La liste des entrees est verifye avant
   suppression de l'espace de staging.

   Options :
     --version <v>   version du zip (defaut : 1.22)
     --out <dir>     dossier de sortie (defaut : <repo>/dist)
     --no-apk        ne pas recopier l'APK android voisin dans --out

   Sortie non nulle si une assertion echoue.
   ============================================================ */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estFichierWebapp, walk } from './_www-filter.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));   // installeur/
const REPO = path.resolve(HERE, '..');                       // fabled-lands-sheet/

/* --- arguments --- */
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : dflt;
};
const VERSION = opt('--version', '1.22');
const OUT = path.resolve(REPO, opt('--out', 'dist'));
const NO_APK = args.includes('--no-apk');

const ZIP = path.join(OUT, `fabled-lands-sheet-${VERSION}-webapp.zip`);
const STAGE = path.join(OUT, `.stage-webapp`);

function fail(msg) {
  console.error('ERREUR : ' + msg);
  process.exit(1);
}

/* --- 1. collecte des fichiers (filtre partage) --- */
const specs = walk(REPO, '').filter((rel) => {
  const posix = rel.split(path.sep).join('/');
  /* donnees runtime : jamais dans l'artefact */
  if (/^api\/preferences\.db(-wal|-shm)?$/.test(posix)) return false;
  return estFichierWebapp(rel);
}).map((rel) => rel.split(path.sep).join('/'));   /* cles POSIX : comparables partout */
/* LICENSE : sans extension, hors WWW_EXT, ajoute a la main */
if (fs.existsSync(path.join(REPO, 'LICENSE'))) specs.push('LICENSE');

/* la webapp compte ~21 fichiers + LICENSE ; 20 = marge minimale */
if (specs.length < 20) fail(`seulement ${specs.length} fichiers (20 attendus min.)`);

const abs = (rel) => path.join(REPO, rel);
const must = [
  'index.html', 'script.js', 'style.css', 'style-auth.css',
  'login.php', 'register.php', 'change-password.php',
  'api/auth.php', 'api/db.php', 'favicon.svg', 'LICENSE',
];
for (const m of must) {
  if (!specs.includes(m)) fail('fichier requis absent du zip : ' + m);
}
const maps = specs.filter((f) => /^maps\/[^/]+\.webp$/.test(f.split(path.sep).join('/')));
if (maps.length !== 8) fail(`maps : ${maps.length} webp (8 attendus)`);
for (const f of specs) {
  const posix = f.split(path.sep).join('/');
  if (/(^|\/)(node_modules|installeur|deploy|screenshots)\//.test(posix)) {
    fail('fichier hors-webapp retenu : ' + posix);
  }
  if (/\.(db|db-wal|db-shm)$/.test(posix)) fail('donnee SQLite retenu : ' + posix);
}

/* --- 2. staging --- */
fs.rmSync(STAGE, { recursive: true, force: true });
let bytes = 0;
for (const rel of specs) {
  const dest = path.join(STAGE, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(abs(rel), dest);
  bytes += fs.statSync(dest).size;
}
console.log(`staging : ${specs.length} fichiers, ${(bytes / 1048576).toFixed(1)} Mo`);

/* --- 3. compression (tar.exe natif -> zip via -a) --- */
fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(ZIP, { force: true });
const tar = spawnSync('tar', ['-a', '-c', '-f', ZIP, '-C', STAGE, '.'], { stdio: 'inherit' });
if (tar.status !== 0) fail('tar -a (zip) en echec (' + tar.status + ')');

/* --- 4. verification du zip (les entrees repertoire finissent par /) --- */
const entries = execFileSync('tar', ['-tf', ZIP], { encoding: 'utf8' })
  .split(/\r?\n/).map((e) => e.replace(/^\.\//, '')).filter(Boolean);
const files = entries.filter((e) => !e.endsWith('/'));
if (files.length !== specs.length) {
  fail(`zip : ${files.length} fichiers, ${specs.length} staged (+${entries.length - files.length} repertoires)`);
}
for (const mustEntry of ['index.html', 'api/auth.php', 'maps/world.webp']) {
  if (!files.includes(mustEntry)) fail('entree absente du zip : ' + mustEntry);
}
fs.rmSync(STAGE, { recursive: true, force: true });

const zipBytes = fs.statSync(ZIP).size;
console.log(`OK  ${path.relative(REPO, ZIP)} — ${files.length} fichiers, ${(zipBytes / 1048576).toFixed(1)} Mo`);

/* --- 5. artefact android voisin -> meme dossier de release --- */
if (!NO_APK) {
  const apk = path.join(REPO, 'installeur', 'android', 'dist',
    `fabled-lands-sheet-${VERSION}-android.apk`);
  if (fs.existsSync(apk)) {
    fs.copyFileSync(apk, path.join(OUT, path.basename(apk)));
    const idsig = apk + '.idsig';
    if (fs.existsSync(idsig)) fs.copyFileSync(idsig, path.join(OUT, path.basename(idsig)));
    console.log(`APK : ${path.basename(apk)} recopie dans ${path.relative(REPO, OUT)}\\ (2 artefacts de release reunis)`);
  } else {
    console.log(`APK : ${path.basename(apk)} absent (build android non effectue) — zip seul`);
  }
}
