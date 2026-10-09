// Téléchargement de Font Awesome 6.5.2 (css + woff2) + licences.
// Sortie : installeur/android/fa/6.5.2/... (copiée vers les assets APK
// par _sync-assets.mjs ; servie par AssetRouter /ajax/libs/font-awesome/).
//
// index.html charge cdnjs ; l'APK n'a pas de permission INTERNET, donc
// la meme version est servie en local sous le meme prefixe de route.
// woff2 SEULEMENT : le WebView ne demande jamais le .ttf declare en
// second dans all.min.css.
//
// Licences obligatoires (diffusion dans l'APK) :
//   LICENSE.txt -> FA 6.5.2 publie un fichier UNIQUE couvrant les trois
//   regimes : code MIT, icones CC BY 4.0, polices SIL OFL 1.1 (sections
//   "# Icons", "# Fonts", "# Code" du fichier).
import { mkdir, writeFile } from 'node:fs/promises';

const OUT = 'D:/VS_Code_Workspaces/fabled-lands-sheet/installeur/android/fa/6.5.2';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2';

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r;
}

await mkdir(OUT + '/css', { recursive: true });
await mkdir(OUT + '/webfonts', { recursive: true });

/* 1. all.min.css — source de verite des fontes referencees. */
const css = await (await get(CDN + '/css/all.min.css')).text();
await writeFile(OUT + '/css/all.min.css', css, 'utf8');
console.log('all.min.css ' + Math.round(css.length / 1024) + ' Ko');

/* 2. Extraire url(../webfonts/fa-*.woff2) et telecharger chaque fichier.
      Un seul passage sur les fichiers reels : pas de liste en dur (une
      nouvelle variante FA serait capturee automatiquement). */
const names = [...new Set([...css.matchAll(/url\(\.\.\/webfonts\/(fa-[\w-]+\.woff2)/g)]
  .map((m) => m[1]))];
if (!names.length) throw new Error('aucun woff2 reference dans all.min.css');
for (const name of names) {
  const data = Buffer.from(await (await get(CDN + '/webfonts/' + name)).arrayBuffer());
  await writeFile(OUT + '/webfonts/' + name, data);
  console.log('woff2 ' + name + ' ' + Math.round(data.length / 1024) + ' Ko');
}

/* 3. Licence (attribution exigee par la redistribution) : un seul
      fichier couvre MIT + CC BY 4.0 + OFL 1.1. */
const lic = await (await get('https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.5.2/LICENSE.txt')).text();
await writeFile(OUT + '/../LICENSE.txt', lic, 'utf8');
console.log('licence LICENSE.txt ' + lic.length + ' octets');
console.log('FA 6.5.2 : ' + names.length + ' woff2 + css + licence');
