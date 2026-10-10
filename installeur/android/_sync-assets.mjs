#!/usr/bin/env node
/* ============================================================
   _sync-assets.mjs — genere app/src/main/assets/ de l'APK
   ------------------------------------------------------------
   Quatre copiers + assertions bloquantes :
      1. webapp  : racine du repo filtree  -> assets/www/
         (route AssetRouter /fl-sheet/* ; filtre partage
         installeur/_www-filter.mjs — memes exclusions que
         server.js, php compris pour la route /poc/php-src/) ;
      2. POC     : installeur/android/poc/public/ -> assets/poc/
         + manifest.json genere (stamp de build) ;
      3. vendor  : graphe d'imports a partir de PhpCgiWorker.mjs,
         quickbus et php-wasm-sqlite -> assets/vendor/
         (glues php8.x statiques + wasm de la version 8.4 seule +
         les 2 .so listes par lib-manifest.mjs + LICENSE/NOTICE) ;
      4. fonts   : android/fonts/  -> assets/fonts/ (OFL)
         et fa : android/fa/ -> assets/fa/ (FA 6.5.2 locale).

   Pas de tokens ni de contenu non redistribuable : Fabled n'a rien
   a exclure sur ce motif (contrairement a dcc-sheet).
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));        // installeur/android
const REPO = path.resolve(HERE, '..', '..');                      // fabled-lands-sheet
const POC = path.join(HERE, 'poc');
const NM = path.join(POC, 'node_modules');
const ASSETS = path.join(HERE, 'app', 'src', 'main', 'assets');

/* --- filtre webapp : module partage avec _build-webapp.mjs --- */
import { estFichierWebapp, walk } from '../_www-filter.mjs';

function fail(msg) {
  console.error('ERREUR : ' + msg);
  process.exit(1);
}

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function mkdirp(p) { fs.mkdirSync(p, { recursive: true }); }
function copyFile(src, dest) {
  mkdirp(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

/* ============================================================
  1. WEBAPP -> assets/www
   ============================================================ */
function syncWebapp() {
  const src = REPO;
  const dest = path.join(ASSETS, 'www');
  let n = 0, bytes = 0;
  for (const rel of walk(src, '')) {
    if (!estFichierWebapp(rel)) continue;
    copyFile(path.join(src, rel), path.join(dest, rel));
    bytes += fs.statSync(path.join(dest, rel)).size;
    n++;
  }
  console.log('www    : ' + n + ' fichiers, ' + (bytes / 1048576).toFixed(1) + ' Mo');
  if (!fs.existsSync(path.join(dest, 'index.html'))) fail('www/index.html absent');
  if (!fs.existsSync(path.join(dest, 'api', 'db.php'))) fail('www/api/db.php absent');
}

/* ============================================================
   2. POC -> assets/poc (+ manifest.json genere)
   ============================================================ */
function syncPoc(stamp) {
  const src = path.join(POC, 'public');
  const dest = path.join(ASSETS, 'poc');
  let n = 0;
  for (const rel of walk(src, '')) {
    copyFile(path.join(src, rel), path.join(dest, rel));
    n++;
  }

  /* stamp de build : a chaque sync, un hash different -> la page
     d'amorçage reecrit sources PHP et .so (pas de code stale apres
     mise a jour de l'APK, IDB WebView conservee). */
  fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify({ version: stamp }));
  console.log('poc    : ' + (n + 1) + ' fichiers + manifest.json (version ' + stamp + ')');
}

/* ============================================================
   3b. PATCH php-cgi-wasm (Apache-2.0 - modif locale documentee)
   ------------------------------------------------------------
   stdin() est appele une fois par OCTET lu par PHP. L'implementation
   amont fait `String(this.input.shift()).charCodeAt(0)` sur un
   tableau de N caracteres construit par split('') : chaque shift()
   est O(N), soit O(N²) au total. Au-dela de quelques dizaines de
   Ko (import bulk de ~1020 cles), le thread du Service Worker se
   bloque pendant des minutes, le watchdog Chromium le tue ("Service
   Worker is not responding") et toutes les requetes en file echouent
   en ERR_FAILED (cascade).
   Correction : conserver la chaine d'entree et la lire par index
   O(1) - memes octets, meme contrat. Idempotent (marqueurs).
   Meme VENDOR_PATCHES que poc/_patch-php-wasm.mjs (ne pas diverger).
   ============================================================ */
const VENDOR_PATCHES = [
  {
    file: 'php-cgi-wasm/PhpCgiWebBase.mjs',
    edits: [
      {
        marker: 'PATCH fabled-lands : stdin O(1)',
        re: /, stdin: \(\) =>\s*this\.input\n\t+\? String\(this\.input\.shift\(\)\)\.charCodeAt\(0\)\n\t+: null/,
        neu: [
          '\t\t\t/* PATCH fabled-lands : stdin O(1) par index.',
          '\t\t\t   Amont : Array.shift() par octet lu = O(N²) ; au-dela de',
          '\t\t\t   quelques dizaines de Ko le thread du Service Worker se',
          '\t\t\t   bloquait et le watchdog Chromium le tuait ("Service Worker',
          '\t\t\t   is not responding") : les requetes en file echouaient en',
          '\t\t\t   ERR_FAILED. Lecture d\'octets strictement identique. */',
          '\t\t\t, stdin: () => (this.input && this.inputPos < this.input.length)',
          '\t\t\t\t? this.input.charCodeAt(this.inputPos++)',
          '\t\t\t\t: null',
        ].join('\n'),
      },
    ],
  },
  {
    file: 'php-cgi-wasm/PhpCgiBase.mjs',
    edits: [
      {
        marker: 'PATCH fabled-lands : stdin O(1)',
        re: /, stdin: \(\) =>\s*this\.input\n\t+\? String\(this\.input\.shift\(\)\)\.charCodeAt\(0\)\n\t+: null/,
        neu: [
          '\t\t/* PATCH fabled-lands : stdin O(1) par index (meme logique que',
          '\t\t   PhpCgiWebBase ; la classe Node partage cette base). */',
          '\t\t, stdin: () => (this.input && this.inputPos < this.input.length)',
          '\t\t\t? this.input.charCodeAt(this.inputPos++)',
          '\t\t\t: null',
        ].join('\n'),
      },
      {
        marker: 'PATCH fabled-lands : chaine + curseur',
        re: /this\.input = \['POST', 'PUT', 'PATCH'\]\.includes\(method\) \? String\(post \?\? ''\)\.split\(''\) : \[\];/,
        neu: [
          '\t\t\t/* PATCH fabled-lands : chaine + curseur ; le split() en tableau',
          '\t\t\t   de N caracteres alimentait shift() O(n) par octet (voir',
          '\t\t\t   stdin dans PhpCgiWebBase). Longueur = octets (entree',
          '\t\t\t   latin1 construite par String.fromCharCode). */',
          "\t\t\tthis.input = ['POST', 'PUT', 'PATCH'].includes(method) ? String(post ?? '') : '';",
          '\t\t\tthis.inputPos = 0;',
        ].join('\n'),
      },
    ],
  },
];

function patchVendor() {
  let applied = 0;
  for (const p of VENDOR_PATCHES) {
    const full = path.join(NM, p.file);
    if (!fs.existsSync(full)) fail('patch php-cgi-wasm : fichier absent ' + p.file);
    let s = fs.readFileSync(full, 'utf8');
    let dirty = false;
    for (const e of p.edits) {
      if (s.includes(e.marker)) continue;          /* deja applique */
      if (!e.re.test(s)) {
        fail('patch php-cgi-wasm : motif introuvable (' + e.marker
          + ') dans ' + p.file + ' - version de php-cgi-wasm changee ?');
      }
      s = s.replace(e.re, e.neu);
      applied++;
      dirty = true;
    }
    if (dirty) fs.writeFileSync(full, s, 'utf8');
  }
  console.log('patch  : php-cgi-wasm PhpCgiBase/PhpCgiWebBase ('
    + (applied ? applied + ' bloc(s) applique(s)' : 'deja applique') + ')');
}

/* ============================================================
   3. VENDOR -> graphe d'imports (SQLite seul : pas de GD/zip/
      mbstring/zlib — les cartes sont des webp statiques, l'import
      et l'export sont du JSON pur)
   ============================================================ */
const VENDOR_PKGS = ['php-cgi-wasm', 'quickbus', 'php-wasm-sqlite'];
const VENDOR_ENTRIES = [
  'php-cgi-wasm/PhpCgiWorker.mjs',
  'quickbus/index.mjs',
  'php-wasm-sqlite/index.mjs',
];
const VENDOR_META = ['package.json', 'LICENSE', 'LICENSE-GPL', 'LICENSE-MIT', 'NOTICE', 'NOTICE.md'];

const IMPORT_RE = /(?:import|export)\s[^'"();]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function syncVendor() {
  patchVendor();   /* O(n²) stdin corrige avant copie (POC + assets) */
  const dest = path.join(ASSETS, 'vendor');
  const seen = new Set();
  const queue = [...VENDOR_ENTRIES];

  while (queue.length) {
    const relPkg = queue.shift();
    if (seen.has(relPkg)) continue;
    seen.add(relPkg);

    const [pkg, ...rest] = relPkg.split('/');
    const file = rest.join('/');
    const full = path.join(NM, pkg, file);
    if (!full.startsWith(path.join(NM, pkg))) fail('vendor hors paquet : ' + relPkg);
    if (!fs.existsSync(full)) fail('vendor absent : ' + relPkg);
    copyFile(full, path.join(dest, relPkg));

    if (file.endsWith('.mjs') || file.endsWith('.js')) {
      const content = fs.readFileSync(full, 'utf8');
      for (const m of content.matchAll(IMPORT_RE)) {
        const spec = m[1] || m[2];
        if (!spec || !spec.startsWith('.')) continue; /* relatif uniquement */
        const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
        queue.push(pkg + '/' + resolved);
      }
    }
  }

  /* wasm : seul celui de la version utilisee (8.4) — les glues des
     autres versions sont importes statiquement mais jamais instancies,
     leur wasm n'est jamais fetch. */
  const glue = fs.readFileSync(path.join(NM, 'php-cgi-wasm', 'php8.4-cgi-worker.mjs'), 'utf8');
  const wasms = new Set([...glue.matchAll(/"([0-9a-f]{40}\.wasm)"/g)].map((m) => m[1]));
  if (wasms.size === 0) fail('wasm introuvable dans php8.4-cgi-worker.mjs');
  for (const w of wasms) {
    copyFile(path.join(NM, 'php-cgi-wasm', w), path.join(dest, 'php-cgi-wasm', w));
  }

  /* .so : source de verite = lib-manifest.mjs du POC (2 attendus) */
  const lm = fs.readFileSync(path.join(POC, 'public', 'lib-manifest.mjs'), 'utf8');
  const libs = [...lm.matchAll(/pkg:\s*'([^']+)',\s*file:\s*'([^']+)'(,\s*ini:\s*true)?/g)];
  if (libs.length !== 2) fail('lib-manifest.mjs : ' + libs.length + ' entrees (2 attendues)');
  for (const [, pkg, file] of libs) {
    const full = path.join(NM, pkg, file);
    if (!fs.existsSync(full)) fail('.so absent : ' + pkg + '/' + file);
    copyFile(full, path.join(dest, pkg, file));
  }

  /* attribution licence (packages distribues dans l'APK) */
  for (const pkg of VENDOR_PKGS) {
    for (const f of VENDOR_META) {
      const full = path.join(NM, pkg, f);
      if (fs.existsSync(full)) copyFile(full, path.join(dest, pkg, f));
    }
  }

  const total = walk(dest, '').length;
  console.log('vendor : ' + total + ' fichiers (' + libs.length + ' .so, wasm 8.4 : '
    + [...wasms].join(', ') + ')');
  return libs.length;
}

/* ============================================================
  4. FONTES LOCALES -> assets/fonts (OFL, Google Fonts hors-ligne)
   ============================================================ */
function syncFonts() {
  const src = path.join(HERE, 'fonts');
  const dest = path.join(ASSETS, 'fonts');
  const css = path.join(src, 'fonts.css');
  if (!fs.existsSync(css)) {
    fail('fonts/fonts.css absent : lancer node _fetch-fonts.mjs (polices OFL)');
  }
  let n = 0;
  for (const rel of walk(src, '')) {
    copyFile(path.join(src, rel), path.join(dest, rel));
    n++;
  }
  const woff = walk(src, '').filter((f) => f.endsWith('.woff2')).length;
  if (woff < 8) fail('fonts : ' + woff + ' woff2 (8 attendus)');
  console.log('fonts  : ' + n + ' fichiers (Barlow Condensed + Space Grotesk, OFL 1.1)');
}

/* ============================================================
   5. FONT AWESOME LOCALE -> assets/fa (cdnjs remplace en local)
   ============================================================ */
function syncFa() {
  const src = path.join(HERE, 'fa');
  const dest = path.join(ASSETS, 'fa');
  const css = path.join(src, '6.5.2', 'css', 'all.min.css');
  if (!fs.existsSync(css)) {
    fail('fa/6.5.2/css/all.min.css absent : lancer node _fetch-fontawesome.mjs');
  }
  let n = 0;
  for (const rel of walk(src, '')) {
    copyFile(path.join(src, rel), path.join(dest, rel));
    n++;
  }
  const woff = walk(src, '').filter((f) => f.endsWith('.woff2')).length;
  if (woff < 3) fail('fa : ' + woff + ' woff2 (3 attendus : solid/regular/brands)');
  if (!fs.existsSync(path.join(src, 'LICENSE.txt'))) {
    fail('fa/LICENSE.txt absent (attribution MIT + CC BY 4.0 + OFL exigee)');
  }
  console.log('fa     : ' + n + ' fichiers (FA 6.5.2 locale)');
}

/* ============================================================
   ASSERTIONS FINALES
   ============================================================ */
function assertAssets(nbSo) {
  const all = walk(ASSETS, '');
  const required = [
    'www/index.html', 'www/login.php', 'www/register.php', 'www/change-password.php',
    'www/api/auth.php', 'www/api/db.php',
    'www/maps/world.webp', 'www/maps/book7.webp',        // les 8 cartes (WebP lossy q80)
    'www/style.css', 'www/style-auth.css', 'www/script.js', 'www/favicon.svg',
    'poc/boot.html', 'poc/cgi-worker.mjs', 'poc/lib-manifest.mjs', 'poc/manifest.json',
    'vendor/php-cgi-wasm/PhpCgiWorker.mjs', 'vendor/php-cgi-wasm/php8.4-cgi-worker.mjs',
    'vendor/quickbus/index.mjs', 'vendor/php-wasm-sqlite/php8.4-sqlite.so',
    'fonts/fonts.css', 'fonts/OFL-barlowcondensed.txt', 'fonts/OFL-spacegrotesk.txt',
    'fa/6.5.2/css/all.min.css', 'fa/6.5.2/webfonts/fa-solid-900.woff2',
  ];
  for (const r of required) {
    if (!fs.existsSync(path.join(ASSETS, r))) fail('asset requis absent : ' + r);
  }
  /* les 8 cartes doivent etre presents (webp) */
  const maps = walk(path.join(ASSETS, 'www', 'maps'), '')
    .filter((f) => f.endsWith('.webp'));
  if (maps.length !== 8) fail('www/maps : ' + maps.length + ' webp (8 attendus)');
  const soCopied = all.filter((f) => f.split(path.sep).join('/').endsWith('.so')).length;
  if (soCopied !== nbSo) fail('.so : ' + soCopied + ' copies, ' + nbSo + ' attendus');

  let bytes = 0;
  for (const f of all) bytes += fs.statSync(path.join(ASSETS, f)).size;
  console.log('ASSERTIONS OK : ' + all.length + ' assets, '
    + (bytes / 1048576).toFixed(1) + ' Mo.');
}

/* ============================================================ */
const gitRev = (() => {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: REPO, stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
  } catch { return 'nogit'; }
})();
const stamp = gitRev + '-' + Date.now().toString(36);

if (!fs.existsSync(path.join(NM, 'php-cgi-wasm'))) {
  fail('node_modules du POC absent : lancer npm install dans installeur/android/poc');
}

rmrf(ASSETS);
mkdirp(ASSETS);
syncWebapp();
syncPoc(stamp);
const nbSo = syncVendor();
syncFonts();
syncFa();
assertAssets(nbSo);
console.log('Sync terminee -> ' + ASSETS);
