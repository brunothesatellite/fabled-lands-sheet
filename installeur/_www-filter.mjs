#!/usr/bin/env node
/* ============================================================
   _www-filter.mjs — filtre « fichiers de la webapp »
   ------------------------------------------------------------
   Source de verite partagee par :
     - installeur/android/_sync-assets.mjs  (copie vers assets/www de l'APK)
     - installeur/_build-webapp.mjs         (zip de deploiement web)

   Exclusions alignees sur server.js (serveur de dev POC) : les
   memes repertoires/fichiers ne sont servis nulle part. Toute
   evolution de la liste doit rester commune aux deux consommateurs.
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';

/* --- repertoires hors-webapp --- */
export const BLOCK_DIRS = new Set(['node_modules', '.git', '.opencode', '.vscode',
  'deploy', 'installeur', 'screenshots', 'test', 'tests', 'dist']);

/* --- fichiers de dev / docs / donnees non servis --- */
export const BLOCK_FILES = [
  /^\.[a-z]/i,                       // dotfiles (.gitignore, .git…)
  /(^|\/)[^/]*\.md$/i,               // README, CHANGELOG, TODO, PLAN
  /^package(-lock)?\.json$/i,
  /\.pdf$/i,                         // Fabled-Lands-Play-Sheets-Ultimate.pdf
  /\.py$/i, /\.log$/i, /\.bat$/i,
  /^test-import/i,                   // test-import*.json
  /^forms_data\.json$/i, /^mockup-/i,
  /^spec\.txt$/i,
];

/* Meme liste que server.js STATIC_EXT + .php (source brute deliberatee) */
export const WWW_EXT = new Set([
  '.html', '.css', '.js', '.mjs', '.svg', '.png', '.webp', '.jpg', '.jpeg',
  '.gif', '.ico', '.woff', '.woff2', '.ttf', '.avif', '.php', '.json', '.txt',
]);

/* Un relatif (sep. natif ou POSIX) appartient-il a la webapp ? */
export function estFichierWebapp(rel) {
  const posix = rel.split(path.sep).join('/');
  const segs = posix.split('/');
  const base = segs[segs.length - 1];
  if (segs.some((s) => BLOCK_DIRS.has(s))) return false;
  if (BLOCK_FILES.some((re) => re.test(base))) return false;
  return WWW_EXT.has(path.extname(base).toLowerCase());
}

/* Parcours recursif renvoyant les relatifs (sep. natif) — partage
   pour que sync et zip marchent dans le meme ordre. */
export function walk(dir, base, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const rel = path.join(base, e.name);
    if (e.isDirectory()) walk(full, rel, out);
    else if (e.isFile()) out.push(rel);
  }
  return out;
}
