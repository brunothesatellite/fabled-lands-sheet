# PLAN — APK Android pour Fabled Lands Sheet

**Objectif** : produire `fabled-lands-sheet-<version>-android.apk` en réutilisant **exactement le
mécanisme** de `D:\VS Code\dcc-sheet\installeur\android` :

> WebView (origine `https://appassets.androidplatform.net`) + routage native des requêtes
> (`AssetRouter`) + **PHP exécuté en WASM dans un Service Worker** (`php-cgi-wasm`) avec
> persistance IDBFS (SQLite + sessions). **Aucune permission** (dont `INTERNET`) : l'app est
> hors-ligne par construction.

Référence : `D:\VS Code\dcc-sheet\installeur\android\` (ci‑dessous « dcc »).

---

## 1. Ce que la webapp Fabled demande au runtime

| Besoin | Élément du projet | Verdict |
|---|---|---|
| Statique SPA | `index.html`, `script.js`, `style.css`, `style-auth.css`, `favicon*.svg`, `maps/*.png` | servi par `AssetRouter` depuis `assets/www/` |
| PHP (pages) | `login.php`, `register.php`, `change-password.php` | exécutés par le Service Worker |
| PHP (API) | `api/auth.php`, `api/db.php` | idem |
| SQLite3 | `new SQLite3(__DIR__.'/preferences.db')`, WAL, FK | **php-wasm-sqlite** (`.so` en IDBFS) |
| Sessions | `session_set_cookie_params` + `session_start()`, cookie 30 j | pot de cookies interne de `php-cgi-wasm` (prouvé par dcc) |
| bcrypt | `password_hash/verify` | **intégré au noyau PHP 8.4** (aucune extension) |
| `php://input` JSON | `file_get_contents('php://input')` (import bulk ~1 020 clés) | nécessite le **patch O(1) stdin** de dcc (voir §5.3) |
| Polices Google | Barlow Condensed + Space Grotesk (CDN) | locales via route `/css2` + `/gfont/` |
| **Font Awesome 6.5.2** | cdnjs (`all.min.css` + webfonts) | **nouveau : route `/ajax/libs/font-awesome/`** (dcc n'en avait pas besoin) |
| Export JSON | `URL.createObjectURL` + `<a download>` | hooks `BLOB_HOOK_JS` + `DownloadListener` + `DccBridge` |
| Import JSON | `<input type="file">` | `WebChromeClient.onShowFileChooser` |

**Extensions PHP nécessaires : 1 seule** (sqlite3). Pas de GD, pas de zip, pas de mbstring, pas de
curl (contrairement à dcc qui a `map-image.php`, `maps.php`, imports ZIP).

**Éléments à exclure de l'APK** : `Fabled-Lands-Play-Sheets-Ultimate.pdf`, `*.py`,
`screenshots/`, `forms_data.json`, `test-import*.json`, `api/preferences.db*` (BDD réelle !),
`spec.txt`, `deploy/`, `mockup-*.html`, fichiers `.md`, dotfiles.

---

## 2. Identité de l'application

| Clé | Valeur |
|---|---|
| `applicationId` / `namespace` | `com.fabledlands.sheet` |
| `android:label` | `Fabled Lands` |
| Préfixe de routes | `/fl-sheet/` (remplace `/dcc-sheet/`) |
| Origine WebView | `https://appassets.androidplatform.net` (inchangée) |
| `versionName` | `1.14` (CHANGELOG) — surcharge `-PappVersionName` |
| `versionCode` | `1`, **à faire évoluer** via `-PappVersionCode` (mise à jour par `adb install -r`) |
| Keystore | `keystore/fabled-lands.keystore`, alias `fl-store`, `CN=Fabled Lands Sheet, OU=Local, O=Local, C=FR` |
| Sortie | `dist/fabled-lands-sheet-<version>-android.apk` |
| `minSdk` / `targetSdk` / `compileSdk` | `26` / `37` / `37` (ServiceWorkerController = API 26) |

---

## 3. Arborescence cible

```
fabled-lands-sheet/
└── installeur/
    └── android/
        ├── PLAN.md                      ← ce document
        ├── build.gradle                 copié dcc (AGP 9.4.1)
        ├── settings.gradle              rootProject.name = 'fabled-lands-sheet'
        ├── gradle.properties            copié dcc
        ├── gradlew / gradlew.bat / gradle/wrapper/*   copiés dcc (identiques)
        ├── local.properties             généré par le build (gitignoré)
        ├── _build-android.ps1           pipeline env → sync → gradle → keystore → apksigner
        ├── _sync-assets.mjs             génération de assets/ + assertions bloquantes
        ├── _fetch-fonts.mjs             Google Fonts (Barlow Condensed, Space Grotesk) + OFL
        ├── _fetch-fontawesome.mjs       ← NOUVEAU : FA 6.5.2 (css + woff2) + licences
        ├── make-android-icons.ps1       icônes launcher (dessin GDI+ façon favicon)
        ├── fonts/                       (généré) fonts.css + *.woff2 + OFL-*.txt
        ├── fa/                          (généré) 6.5.2/css/all.min.css, 6.5.2/webfonts/*.woff2, LICENSE
        ├── keystore/                    (créé au 1er build — À CONSERVER)
        ├── dist/                        APK signés
        ├── poc/                         POC navigateur (validation avant APK)
        │   ├── package.json             php-cgi-wasm, php-wasm-sqlite, quickbus, puppeteer-core
        │   ├── server.js                serveur statique /fl-sheet/ + /poc/
        │   ├── run.js                   gates automatisées
        │   └── public/
        │       ├── boot.html            page d'amorçage (SW + écriture IDBFS)
        │       ├── cgi-worker.mjs       Service Worker PHP
        │       └── lib-manifest.mjs     SHARED_LIBS (sqlite seulement)
        └── app/
            ├── build.gradle             com.fabledlands.sheet
            └── src/main/
                ├── AndroidManifest.xml  zéro permission
                ├── java/com/fabledlands/sheet/
                │   ├── MainActivity.java
                │   └── AssetRouter.java
                ├── res/                 styles.xml + mipmaps (make-android-icons.ps1)
                └── assets/              GÉNÉRÉS (rmrf à chaque sync)
                    ├── www/             webapp filtrée (racine du repo)
                    ├── poc/             boot.html, cgi-worker.mjs, lib-manifest.mjs, manifest.json
                    ├── vendor/          graphe d'imports php-cgi-wasm + quickbus + sqlite + .so + LICENSE
                    ├── fonts/           copie de android/fonts/
                    └── fa/              copie de android/fa/
```

---

## 4. Différences par rapport à dcc (à retirer / à ajouter)

### À RETIRER (spécifique DCC)
- `queries` + `ContentProvider com.dccsheet.content` (APK compagnon de tokens) → manifest nu.
- `contentInstalled()`, `GUARD_HOOK_JS`, `FETCH_HOOK_JS` et leurs appels (portraits/tokens).
- Routes `AssetRouter` : `isAdditionalContent()`, `additionalContent()`, `fromContentProvider()`, `forbidden()` (403 tokens).
- Assertion « aucun token » de `_sync-assets.mjs` (remplacée par les assertions §5.5).
- `iconDirs` dans `boot.html` / `manifest.json` (pas de dossier `icons/` côté serveur).
- Extensions gd/zip/mbstring/zlib du `lib-manifest.mjs` et de `package.json`.
- `poc/public/zip.mjs` + gates G5/G6/G7 de `run.js` (imports ZIP, WebP, export ZIP) — Fabled n'a que du JSON.

### À AJOUTER (spécifique Fabled)
1. **Route Font Awesome** dans `AssetRouter` :
   ```java
   if (path.startsWith("/ajax/libs/font-awesome/")) {
       String rel = path.substring("/ajax/libs/font-awesome/".length());
       if (rel.isEmpty() || rel.contains("..")) return notFound();
       return asset("fa/" + rel);          /* fa/6.5.2/css/all.min.css + webfonts/* */
   }
   ```
   `all.min.css` référence ses fontes en `url(../webfonts/fa-solid-900.woff2?v=6.5.2)` :
   servies à `/ajax/libs/font-awesome/6.5.2/webfonts/…` → **mêmes routes, aucun ajout**.
   (la query `?v=` est ignorée : le routeur ne travaille que sur `getPath()`).
2. **Onglets/maps** : rien à faire côté routeur (`maps/*.png` sont des statiques sous `/fl-sheet/`).
3. **Thème sombre** : dcc force les barres système claires. Fabled a un toggle dark →
   *amélioration optionnelle* : bridge JS `FlBridge.setDark(bool)` appelé par `script.js`
   (hors périmètre MVP, voir §8).

---

## 5. Travaux, étape par étape

### É0 — Copie des invariants Gradle (10 min)
Copier depuis dcc : `build.gradle`, `gradle.properties`, `gradlew*`, `gradle/wrapper/*`,
`app/proguard-rules.pro`, `app/src/main/res/values/styles.xml`.
Adapter `settings.gradle` : `rootProject.name = 'fabled-lands-sheet'`.
Adapter `app/build.gradle` : namespace/applicationId `com.fabledlands.sheet`,
`versionName = (findProperty('appVersionName') ?: '1.14')`,
ajout `versionCode = ((findProperty('appVersionCode') ?: '1') as String).toInteger()`,
`dependencies {}` (zéro dépendance, framework only).

### É1 — Manifest + MainActivity
`AndroidManifest.xml` : reprendre dcc **sans** le bloc `<queries>` ; `android:label="Fabled Lands"`,
`largeHeap`, `usesCleartextTraffic="false"`, `allowBackup="true"`, activity `.MainActivity`
(`exported`, `configChanges`, `windowSoftInputMode="adjustResize"`).

`MainActivity.java` : copier dcc puis
- `BOOT_URL = "https://appassets.androidplatform.net/fl-sheet/boot-poc.html"` ;
- supprimer `GUARD_HOOK_JS`, `FETCH_HOOK_JS`, `contentInstalled()`, l'import
  `resolveContentProvider` et les 2 appels dans `onPageStarted`/`onPageFinished` ;
- conserver **inchangés** : `ServiceWorkerClient` (indispensable au registre du SW),
  `shouldInterceptRequest` du `WebViewClient`, `BLOB_HOOK_JS`, `DownloadListener` +
  `DccBridge.blobChunk` + `finishExport` (MediaStore ≥ 29 / `getExternalFilesDir` < 29),
  `onShowFileChooser` (import JSON), insets edge-to-edge, `onBackPressed`, debug via
  `chrome://inspect` seulement en build debuggable ;
- renommer la classe interne `DccBridge` → `FlBridge` (ou laisser tel quel, cohérence de
  nommage à trancher : je recommande `FlBridge` + `@JavascriptInterface`).

### É2 — AssetRouter.java
Copier dcc, puis appliquer :
- `PREFIX` = `/fl-sheet/` partout ;
- supprimer `CONTENT_AUTHORITY`, `isAdditionalContent()`, `additionalContent()`,
  `fromContentProvider()`, `forbidden()` ;
- garder : `/` → 302 `/fl-sheet/boot-poc.html`, `/fl-sheet/` → `www/index.html`,
  `/css2` → `fonts/fonts.css`, `/gfont/<f>` → `fonts/<f>`,
  `/fl-sheet/boot-poc.html` → `poc/boot.html`, `/fl-sheet/cgi-worker.mjs` → `poc/cgi-worker.mjs`,
  `/fl-sheet/*.php` → **404** (source jamais servie en statique ; le SW les exécute),
  `/fl-sheet/*` → `www/*` (whitelist `STATIC_EXT`), `/poc/php-src/*.php` → `www/*`,
  `/poc/vendor/*` → `vendor/*`, `/poc/*` → `poc/*` ;
- **ajouter** la route Font Awesome (§4) ;
- garder les en-têtes `Cache-Control: no-store` + `Access-Control-Allow-Origin: *`
  (requis pour les `@font-face` cross-origin).

### É3 — POC navigateur (`poc/`)
> On valide le mécanisme **dans le navigateur** avant de toucher à Gradle : c'est l'ordre de dcc
> (POC → APK) et cela isole 100 % des régressions PHP/IDB du bruit Android.

**`poc/package.json`** :
```json
{ "name": "fabled-lands-android-poc", "private": true, "type": "module",
  "scripts": { "start": "node server.js", "test": "node run.js" },
  "dependencies": {
    "php-cgi-wasm": "0.2.0", "php-wasm-sqlite": "0.2.0", "quickbus": "1.1.0" },
  "devDependencies": { "puppeteer-core": "25.13.0" } }
```
*(garder `php-wasm-zlib` dans la liste de secours : si une requête échoue sur `gz*`, on
l'ajoute au `lib-manifest` + au graphe d'imports.)*

**`poc/server.js`** : copier dcc, remplacer tous les `/dcc-sheet/` par `/fl-sheet/`, supprimer le
garde-fou tokens (`FORBIDDEN`, `iconDirs()`), et aligner `BLOCK_*` sur `_sync-assets.mjs` (§5.5).
Route conservée : `/poc/php-src/*.php` (source brute **hors portée du SW**), `/poc/vendor/*`
servi depuis `node_modules`, `manifest.json` = `{ version: stamp }`.

**`poc/public/lib-manifest.mjs`** :
```js
export const LIB_DIR = '/persist/lib';
export const SHARED_LIBS = [
  { pkg: 'php-wasm-sqlite', file: 'php8.4-sqlite.so', ini: true }, // dlopen absolu
  { pkg: 'php-wasm-sqlite', file: 'libsqlite3.so' },               // LD_LIBRARY_PATH
];
```

**`poc/public/cgi-worker.mjs`** : copier dcc, `const PREFIX = '/fl-sheet/';`,
`docroot = '/persist/www'`, même `ini` (`session.save_path`, `upload_tmp_dir`,
`post_max_size`, `memory_limit`, `date.timezone`, `error_log`), même `sharedLibs`/`env`,
conserver `actions.dumpIdb` / `actions.dumpFs` (diagnostic) et le `fetch` handler limité aux
`*.php` sous le prefix.

**`poc/public/boot.html`** :
```js
const PHP_SOURCES = [
  'login.php', 'register.php', 'change-password.php',
  'api/db.php', 'api/auth.php',
];
const dirs = ['/persist/www', '/persist/www/api', '/persist/sessions', '/persist/tmp', LIB_DIR];
```
- suppression de `manifest.iconDirs` (et de la boucle `icons/`) ;
- conservation du **stamp de version** écrit en dernier (`/config/app-version`) : un build neuf
  → amorçage complet (réécriture des sources PHP et des `.so`, pas de code stale dans l'IDB
  conservée) ; stamp identique → démarrage rapide sans écriture ;
- conservation du script `_diag.php` (preuve d'extension chargée, cf. recette) ;
- `location.replace('/fl-sheet/')` final ;
- `navigator.serviceWorker.register('/fl-sheet/cgi-worker.mjs', { type: 'module', … })`.

**`poc/run.js`** : reprendre la structure (Phase A froide / Phase B redémarrage complet) avec
`host-resolver-rules` bloquant **à la fois** `fonts.googleapis.com`, `fonts.gstatic.com` **et**
`cdnjs.cloudflare.com` (simulation hors-ligne totale).

### É4 — Ressources locales (polices + Font Awesome)

**`_fetch-fonts.mjs`** (copie de dcc, 2 lignes changées) :
- `CSS_URL = https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap` ;
- `KEEP = latin, latin-ext` ;
- réécriture `url(…gstatic…)` → `url(https://appassets.androidplatform.net/gfont/<nom>)` ;
- licences : `OFL-barlowcondensed.txt`, `OFL-spacegrotesk.txt` (raw.githubusercontent.com/google/fonts/…).

**`_fetch-fontawesome.mjs`** (nouveau, même patron) :
1. `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css`
   → `fa/6.5.2/css/all.min.css` ;
2. extraire `url(../webfonts/fa-*.woff2)` → télécharger dans `fa/6.5.2/webfonts/`
   (`fa-solid-900.woff2`, `fa-regular-400.woff2`, `fa-brands-400.woff2`) — **woff2 seulement** :
   le WebView ne demande jamais le `.ttf` déclaré en second ;
3. licences dans `fa/` : `LICENSE.txt` (code : MIT), `LICENSE-ICONS.txt` (icônes : CC BY 4.0),
   `LICENSE-FONTS.txt` (SIL OFL 1.1) — la diffusion dans l'APK impose l'attribution.

### É5 — `_sync-assets.mjs`

Même squelette que dcc (walk + filtres + `rmrf(ASSETS)` + assertions), avec :

```js
const BLOCK_DIRS = new Set(['node_modules', '.git', '.opencode', '.vscode',
  'deploy', 'installeur', 'screenshots', 'test', 'tests', 'dist']);
const BLOCK_FILES = [
  /^\.[a-z]/i,                       // dotfiles (.gitignore, .git…)
  /(^|\/)[^/]*\.md$/i,               // README, CHANGELOG, TODO, PLAN
  /^package(-lock)?\.json$/i,
  /\.pdf$/i,                         // Fabled-Lands-Play-Sheets-Ultimate.pdf
  /\.py$/i, /\.log$/i, /\.bat$/i,
  /^test-import/i,                   // test-import*.json
  /^forms_data\.json$/i, /^mockup-/i,
  /^spec\.txt$/i,
];
const WWW_EXT = new Set(['.html','.css','.js','.mjs','.svg','.png','.webp','.jpg','.jpeg',
  '.gif','.ico','.woff','.woff2','.ttf','.php','.json','.txt']);
```

Quatre « copiers » + assertions :
1. **www** — racine du repo filtrée → `assets/www/` (PHP compris, source brute voulue).
2. **poc** — `poc/public/*` → `assets/poc/` + `manifest.json` généré `{ version: stamp }`
   (`stamp = git rev-parse --short HEAD + '-' + Date.now().toString(36)`, fallback `nogit`).
3. **vendor** — graphe d'imports depuis `php-cgi-wasm/PhpCgiWorker.mjs` + `quickbus` +
   `php-wasm-sqlite` (boucle `IMPORT_RE` identique), **patch php-cgi-wasm appliqué avant copie**
   (§5.3), wasm 8.4 extrait de `php8.4-cgi-worker.mjs`, `.so` listés par `lib-manifest.mjs`
   (2 attendus), `package.json` + LICENSE de chaque paquet.
4. **fonts** — `android/fonts/*` → `assets/fonts/` (≥ 8 woff2 attendus) ;
   et **fa** — `android/fa/*` → `assets/fa/` (css + 3 woff2 attendus).

Assertions bloquantes :
```js
const required = [
  'www/index.html', 'www/login.php', 'www/register.php', 'www/change-password.php',
  'www/api/auth.php', 'www/api/db.php',
  'www/maps/world.png', 'www/maps/book7.png',          // les 8 cartes
  'www/style.css', 'www/style-auth.css', 'www/script.js', 'www/favicon.svg',
  'poc/boot.html', 'poc/cgi-worker.mjs', 'poc/lib-manifest.mjs', 'poc/manifest.json',
  'vendor/php-cgi-wasm/PhpCgiWorker.mjs', 'vendor/php-cgi-wasm/php8.4-cgi-worker.mjs',
  'vendor/quickbus/index.mjs', 'vendor/php-wasm-sqlite/php8.4-sqlite.so',
  'fonts/fonts.css', 'fonts/OFL-barlowcondensed.txt', 'fonts/OFL-spacegrotesk.txt',
  'fa/6.5.2/css/all.min.css', 'fa/6.5.2/webfonts/fa-solid-900.woff2',
];
const FORBIDDEN = /preferences\.db|screenshots\/|\.(pdf|py)$/i;   // + count .so === 2
```
`fail()` sur toute occurrence, puis log `ASSERTIONS OK : N assets, X Mo`.

#### 5.3 Le patch php-cgi-wasm (obligatoire ici aussi)
Reprendre **à l'identique** `VENDOR_PATCHES` de dcc (stdin O(N²) → O(1) par index, 2 fichiers
`PhpCgiWebBase.mjs` / `PhpCgiBase.mjs`, marqueurs idempotents).
**Justification spécifique** : `set_all_preferences` de Fabled envoie ~1 020 clés en un seul POST
JSON → des dizaines de Ko lus octet par octet → watchdog Chromium = « Service Worker is not
responding » → cascade `ERR_FAILED` sur toutes les requêtes. C'est exactement le cas d'usage du
patch. Ne pas le « simplifier ».

### É6 — `_build-android.ps1`
Copier dcc et changer : `$Version` par défaut `1.14`, noms de keystore
(`fabled-lands.keystore`), alias `fl-store`, dname, prefixes de sortie
(`fabled-lands-sheet-$Version-android[-debug].apk`). Conserver :
env (`JAVA_HOME` = JBR d'Android Studio, `ANDROID_HOME` = `%LOCALAPPDATA%\Android\Sdk`),
`local.properties`, `node _sync-assets.mjs` (sauf `-SkipSync`), `gradlew :app:assembleRelease
-PappVersionName=…`, création keystore si absent, `apksigner sign` + `verify`, taille en Mo,
ligne `adb install -r "<apk>"`.

### É7 — `make-android-icons.ps1`
Génère les 5 mipmaps (`ic_launcher.png`, `ic_launcher_foreground.png`),
`mipmap-anydpi-v26/ic_launcher.xml` et `values/ic_launcher_colors.xml`.
Dessin GDI+ reprenant l'esprit de `favicon-sword-shield.svg` (épée + écu) : fond plein
(couleur du favicon, ex. `#1a1a2e` ou palette Fabled : rouge `#e23b2e` / or `#f2bd3d` / papier
`#f1eee8`), zone sûre 66 dp centrée sur 108 dp pour l'icône adaptative.
Un seul projet (`installeur/android`), pas de variante `android-content`.

---

## 6. Recette

### 6.1 POC navigateur — `cd installeur\android\poc && npm install && npm run test`
Gates (adaptées de `run.js`, Fabled‑specific) :

| # | Gate |
|---|---|
| G1 | `#tabBar` rendu + `style.css` > 50 règles, **polices FA + Google bloquées** (host-resolver-rules) |
| G2 | `api/auth.php?action=check` → JSON `logged_in:false` (PHP exécuté par le SW) |
| G3 | inscription SQLite (`ok:true`) + `pseudo` · **G3b** session active (cookie interne) |
| G4 | `/fl-sheet/_diag.php` → `php=8.4`, `chk:sqlite3=OUI`, `fn:password_hash` implicite |
| G5 | rendu de `login.php` (formulaire, pas de source brute `<?php`) puis re-login |
| G6 | session **après rechargement** |
| **Phase B** (restart navigateur) | G7 session persistante · G8 2ᵉ compte créé · G9 double inscription refusée (BDD vivante) |
| G10 | import bulk : `set_all_preferences` avec 1 020 clés en < 5 s (valide le patch stdin) |
| G11 | export : `createObjectURL` + `download=` produit le JSON horodaté |
| G12 | les 8 `maps/*.png` ont `naturalWidth > 0` (hors-ligne) |

### 6.2 APK
```
.\_build-android.ps1 -Version 1.14           # release signée
.\_build-android.ps1 -Version 1.14 -Debug    # adb install rapide
adb install -r "dist\fabled-lands-sheet-1.14-android.apk"
```
- Première ouverture : log jaune d'amorçage (`[boot] …`), redirection, app utilisable.
- `adb logcat -s DCC` → renommer le tag en `FL` (constante `Log.d("FL", …)`).
- Mode avion **activé avant le lancement** : la page se charge intégralement (aucune requête
  externe ne doit apparaître en `ERR_FAILED`).
- Vérifs manuelles : register/login, reprise de session après redémarrage de l'app,
  écriture d'une préférence → `preferences.db` crée dans l'IDB (`dumpFs`),
  export JSON → `Téléchargements/…json`, import JSON → données restaurées,
  toggle dark/light, maps plein écran (pinch-zoom), icônes FA visibles (caret, Sheet…).
- Mise à jour : `adb install -r` avec `versionCode` incrémenté → données IDB conservées,
  stamp différent → réécriture des sources, reconnexion conservée.

---

## 7. Risques & points d'attention

1. **Font Awesome** : seul vrai écart fonctionnel vs dcc. Si `all.min.css` s'avère piloté par des
   chemins absus (`url(/webfonts/…)`), basculer sur le branchement `css/all.min.css` réécrit.
   *Critère de validation : aucun `404` dans `logcat` sur `/ajax/libs/font-awesome/…`.*
2. **Poids des 8 cartes PNG** : `aapt2` ne compresse pas les PNG → l'APK pèsera le poids réel de
   `maps/` + vendor (wasm ≈ 10 Mo) + FA. Mesurer à la 1ʳᵉ compilation ; si > 40 Mo, envisager une
   recompression des cartes (outil externe, hors sync).
3. **SQLite en WAL sur IDBFS** : prouvé par dcc (`data/dcc.db`), mais Fabled crée le fichier
   *directement* dans `api/` → le dossier doit exister **avant** la 1ʳᵉ requête : c'est le rôle du
   `mkdir('/persist/www/api')` de `boot.html` (assertion).
4. **`set_cookie_params(path='/')`** : le pot de cookies interne de `php-cgi-wasm` est clé par nom
   de cookie → sans incidence (prouvé par dcc qui fait `session_start()` pareil).
5. **Ordre de démarrage** : le SW n'est actif qu'après le passage par `boot-poc.html` ; toute
   ouverture directe de `/fl-sheet/api/auth.php` renvoie 404 (comportement voulu, identique dcc).
6. **Keystore** : à conserver (perte = re-signature impossible = réinstallation manuelle).
7. **Aucune permission** : ne pas ajouter `INTERNET` « pour voir » — c'est le contrat
   hors-ligne et la raison pour laquelle les CDN sont neutralisés par les routes locales.
8. **Licences redistribuées dans l'APK** : OFL (polices), MIT + CC BY 4.0 + OFL (FA),
   Apache-2.0 (php-cgi-wasm, modifications documentées), GPL (PHP) — les fichiers LICENSE sont
   copiés par `_sync-assets.mjs` et doivent y rester.

---

## 8. Hors périmètre (itérations suivantes)

- Bridge de thème pour les barres système (clair/sombre synchronisé avec le toggle).
- APK « contenu » compagnon (inutile : pas de ressource non redistribuable ici).
- Play Store / signature Google Play (le keystore sideload actuel suffit pour un usage perso).
- Mode démo/données pré-remplies.

---

## 9. Ordre d'exécution recommandé

1. É0 Gradle (copie) · É1 manifest + MainActivity · É2 AssetRouter — *structure seule, non testée*
2. É3 POC (package.json → server.js → lib-manifest → cgi-worker → boot.html → run.js)
   → **`npm install && npm run test` vert** ← gate obligatoire avant tout build Android
3. É4 polices + FA → `_sync-assets.mjs` (É5) → `node _sync-assets.mjs` vert
4. É6 `_build-android.ps1` + É7 icônes → APK signée installée
5. Recette §6.2, puis fige `PLAN.md` → `README.md` de l'installateur si le dispositif change.
