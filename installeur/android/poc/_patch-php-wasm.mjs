/* ============================================================
   _patch-php-wasm.mjs — patch stdin O(1) sur node_modules
   ------------------------------------------------------------
   Meme VENDOR_PATCHES que _sync-assets.mjs (applique la au vendor
   copie dans l'APK) : le POC tourne lui sur node_modules direct,
   or G10 (import bulk de 1020 cles en < 5 s) exige le patch.
   Idempotent (marqueurs) : a relancer apres chaque npm install.
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NM = path.join(__dirname, 'node_modules');

/* Motifs identiques a _sync-assets.mjs — ne pas diverger. */
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

let applied = 0;
for (const p of VENDOR_PATCHES) {
  const full = path.join(NM, p.file);
  if (!fs.existsSync(full)) {
    console.error('patch : fichier absent ' + p.file + ' (npm install ?)');
    process.exit(1);
  }
  let s = fs.readFileSync(full, 'utf8');
  let dirty = false;
  for (const e of p.edits) {
    if (s.includes(e.marker)) continue;          /* deja applique */
    if (!e.re.test(s)) {
      console.error('patch : motif introuvable (' + e.marker + ') dans '
        + p.file + ' - version de php-cgi-wasm changee ?');
      process.exit(1);
    }
    s = s.replace(e.re, e.neu);
    applied++;
    dirty = true;
  }
  if (dirty) fs.writeFileSync(full, s, 'utf8');
}
console.log('patch  : php-cgi-wasm PhpCgiBase/PhpCgiWebBase ('
  + (applied ? applied + ' bloc(s) applique(s)' : 'deja applique') + ')');
