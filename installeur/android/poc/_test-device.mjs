/* ============================================================
   _test-device.mjs — recette §6.2 sur telephone (Pixel 7a)
   ------------------------------------------------------------
   Le build release ne permet pas l'inspection (WebView non
   debuggable) : ce script installe l'APK DEBUG (meme keystore
   donc install -r sans perte de donnees), lance l'app, se
   branche en CDP sur la WebView et execute les verifs §6.2 :

     D0  APK installe (versionCode identifie)
     D1  boot + redirection vers /fl-sheet/index.html
     D2  icônes FA : fontes woff2 chargees, ZERO requête .ttf
         (regression du fix CORS AssetRouter)
     D3  rechargement hors-ligne : ZERO requete en echec
         (criterion « mode avion »)
     D4  inscription (register.php : form_ts + honeypot) puis
         session active sur action=check
     D5  ecriture preference -> LUE COTE SERIEUR
         (preuve que preferences.db est ecrite dans l'IDB)
     D6  apres am force-stop : session reprise + preference
         preservee + theme preserve  (persistance IDBFS/local)
     D7  export JSON -> fichier reel dans /sdcard/Download
         (DownloadListener -> MediaStore)
     D8  theme clair/sombre (clic .brand-mark)

   Manuel (signale en fin de rapport) : pinch-zoom des cartes,
   import JSON via le selecteur de fichiers, mise a jour
   versionCode (adb install -r avec un versionCode superieur).

   Usage :  node _test-device.mjs      [SERIAL=xxx pour cibler]
   Sortie : code retour != 0 si un controle ECHOUE.
   ============================================================ */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const PKG = 'com.fabledlands.sheet';
const APK = path.resolve(here, '..', 'dist', 'fabled-lands-sheet-1.14-android-debug.apk');
const ORIGIN = 'https://appassets.androidplatform.net';
const PORT = 9229;
const adbBin = path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Erreurs d'environnement (pas de tel, CDP indisponible, APK absent) :
   un message net plutot qu'une pile brute. */
process.on('uncaughtException', (e) => { console.error(`\nERREUR : ${e.message}`); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error(`\nERREUR : ${e && e.message ? e.message : e}`); process.exit(1); });
const results = [];
function check(id, label, ok, detail = '') {
    results.push({ id, label, ok, detail });
    console.log(`[${ok ? 'OK' : 'KO'}] ${id} ${label}${detail ? ' — ' + detail : ''}`);
}
function info(msg) { console.log(`     · ${msg}`); }

function adb(serial, ...args) {
    try {
        return execFileSync(adbBin, serial ? ['-s', serial, ...args] : args,
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
            /* CRLF : sans quoi un etat vaut 'device\r' et jamais 'device',
               et un nom 'export.json\r' ne finit pas par '.json'. */
            .replace(/\r/g, '').trim();
    } catch (e) {
        return ((e.stdout || '') + (e.stderr || '')).replace(/\r/g, '');
    }
}

function findDevice() {
    if (process.env.SERIAL) return process.env.SERIAL;
    const out = adb(null, 'devices').split('\n').slice(1);
    const devs = out.map((l) => l.trim().split(/\s+/)).filter((p) => p[1] === 'device').map((p) => p[0]);
    if (!devs.length) throw new Error('Aucun telephone en etat "device" (branchez-le et autorisez le debogage).');
    const real = devs.filter((d) => !d.startsWith('emulator-'));
    if (real.length === 1) return real[0];
    if (devs.length === 1) return devs[0];
    throw new Error('Plusieurs appareils : ' + devs.join(', ') + ' (preciser SERIAL=).');
}

/* --- 1. Installation de l'APK debug ------------------------------- */
function installApk(serial) {
    if (!fs.existsSync(APK)) throw new Error('APK debug absent : ' + APK + ' (lancer _build-android.ps1 -Debug)');
    let out = adb(serial, 'install', '-r', APK);
    if (!/success/i.test(out)) {
        info('install -r refuse (' + out.replace(/\s+/g, ' ') + ') -> desinstallation (donnees perdues)');
        adb(serial, 'uninstall', PKG);
        out = adb(serial, 'install', APK);
    }
    if (!/success/i.test(out)) throw new Error('install KO : ' + out);
    const dump = adb(serial, 'shell', 'dumpsys', 'package', PKG);
    const vn = (dump.match(/versionName=(\S+)/) || [])[1];
    const vc = (dump.match(/versionCode=(\d+)/) || [])[1];
    return { vn, vc };
}

/* --- 2. Attache CDP a la WebView debug ---------------------------- */
async function connectCDP(serial) {
    for (let i = 0; i < 40; i++) {
        const pids = (adb(serial, 'shell', 'pidof', PKG) || '').split(/\s+/).filter(Boolean);
        for (const pid of pids) {
            try { adb(serial, 'forward', '--remove', `tcp:${PORT}`); } catch (e) { /* pas encore en place */ }
            adb(serial, 'forward', `tcp:${PORT}`, `localabstract:webview_devtools_remote_${pid}`);
            try {
                /* defaultViewport: NULL obligatoire : sinon puppeteer
                   applique Emulation.setDeviceMetricsOverride(800x600) a la
                   WebView du TELEPHONE — la webapp se layout en desktop,
                   coupée a droite ET en bas, et l'override persiste si le
                   processus de test est tue (constate le 10/10/2026). */
                return await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null });
            } catch (e) { /* socket pas pret */ }
        }
        await sleep(1000);
    }
    throw new Error('CDP introuvable : WebView non debogable (APK debug installe ?) ou app non demarree.');
}

async function pageOf(browser) {
    for (let i = 0; i < 30; i++) {
        const pages = await browser.pages();
        const p = pages.find((x) => x.url().includes('appassets.androidplatform.net'));
        if (p) return p;
        if (pages[0] && pages[0].url() !== 'about:blank') return pages[0];
        await sleep(1000);
    }
    throw new Error('aucune page WebView exposee en CDP');
}

/* --- 3. Recette ---------------------------------------------------- */
const serial = findDevice();
console.log(`Appareil : ${serial}`);
console.log(`APK      : ${path.basename(APK)}\n`);

const ver = installApk(serial);
check('D0', 'APK debug installe', ver.vc !== undefined,
    `versionName=${ver.vn} versionCode=${ver.vc}`);

const air = adb(serial, 'shell', 'settings', 'get', 'global', 'airplane_mode_on');
info(`mode avion : ${air === '1' ? 'ACTIF (criterion offline valide)' : 'inactif — D3 reste valable (aucune requete hors appassets)'}`);

adb(serial, 'shell', 'am', 'force-stop', PKG);
adb(serial, 'shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
await sleep(1500);

let browser = await connectCDP(serial);
let page = await pageOf(browser);
let failures = [];
const attachFail = () => {
    failures = [];
    page.on('requestfailed', (r) => failures.push(`${r.url()} -> ${r.failure()?.errorText}`));
};
attachFail();

/* Reprise apres « detached Frame » : boot -> index (ou un reload)
   detachent la frame CDP ; on re-acquiert un handle propre et on
   rejoue l'etape. Sans quoi une seule navigation casse toute la suite. */
async function op(fn) {
    for (let i = 0; i < 2; i++) {
        try { return await fn(); }
        catch (e) {
            if (i === 1 || !/detached|Target closed|Session closed|frame/i.test(e.message)) throw e;
            info('frame detachee, reconnexion CDP : ' + e.message.split('\n')[0]);
            await sleep(500);
            try { await browser.disconnect(); } catch (e2) { /* deja ferme */ }
            browser = await connectCDP(serial);
            page = await pageOf(browser);
            attachFail();
        }
    }
}

/* D1 : attendre la fin de l'amorçage. ATTENTION : boot-poc.html est
   lui-meme en /fl-sheet/ — attendre « /fl-sheet/ » ne suffit pas, la
   suite s'executerait sur la page d'amorçage (0 woff2, reload qui
   detachait la frame...). On poll l'URL de la cible depuis
   l'exterieur, en re-acquerant le handle a chaque tour. */
let bootUrl = '';
for (let i = 0; i < 120; i++) {
    page = await pageOf(browser);
    bootUrl = page.url();
    if (bootUrl.includes('/fl-sheet/index.html')) break;
    await sleep(1000);
}
attachFail();
try {
    await page.waitForSelector('#tabBar', { timeout: 20000 });
    check('D1', 'boot + redirection vers index.html', true, bootUrl.replace(ORIGIN, ''));
} catch (e) {
    check('D1', 'boot + redirection vers index.html', false,
        'arrete sur ' + (bootUrl.replace(ORIGIN, '') || '(aucune page)'));
}

/* D2 : icônes FA (regression fix CORS) */
const fa = await op(() => page.evaluate(async () => {
    try { await document.fonts.ready; } catch (e) { /* ignore */ }
    const res = performance.getEntriesByType('resource').map((e) => e.name);
    return {
        ttf: res.filter((n) => /\.ttf(\?|$)/i.test(n)),
        woff2: res.filter((n) => /fa-solid|fa-regular|fa-brands/.test(n) && n.includes('.woff2')),
        solid: document.fonts.check('900 1em "Font Awesome 6 Free"'),
        regular: document.fonts.check('400 1em "Font Awesome 6 Free"'),
    };
}));
check('D2', 'icônes FA : woff2 chargees, 0 requete .ttf',
    fa.ttf.length === 0 && fa.woff2.length > 0 && fa.solid,
    `${fa.woff2.length} woff2, ttf=${fa.ttf.length}, solid=${fa.solid}, regular=${fa.regular}`);

/* D3 : rechargement — aucune requete en echec (hors-ligne) */
failures.length = 0;
let reloadNote = '';
try {
    await op(() => page.reload({ waitUntil: 'networkidle2', timeout: 45000 }));
} catch (e) {
    /* Un timeout networkidle2 n'est pas un echec en soi (SW actif) :
       on juge sur les requetes reellement en echec. */
    reloadNote = 'reload: ' + e.message.split('\n')[0];
}
try {
    await sleep(1500);
    const fontFail = await op(() => page.evaluate(() => document.fonts.status));
    check('D3', 'rechargement : 0 requete en echec', failures.length === 0 && fontFail === 'loaded',
        (failures.length ? failures.slice(0, 3).join(' | ') : 'aucune') + ` (fonts=${fontFail})` + (reloadNote ? ' [' + reloadNote + ']' : ''));
} catch (e) {
    check('D3', 'rechargement : 0 requete en echec', false, e.message);
}

/* D4 : inscription (form_ts + honeypot geres par register.php) */
try {
    await op(async () => {
        await page.goto(`${ORIGIN}/fl-sheet/register.php`, { waitUntil: 'networkidle2', timeout: 60000 });
        await page.waitForSelector('#registerForm', { timeout: 15000 });
        const pseudo = 'devtest' + String(Date.now()).slice(-5);
        const pw = 'Fl-Test-2026';
        await page.type('#pseudo', pseudo);
        await page.type('#password', pw);
        await page.type('#passwordConfirm', pw);
        /* form_ts impose >= 3s au moment du POST (anti-rejeu) */
        await sleep(3500);
        await page.click('#registerForm button[type=submit]');
        /* Succes = redirection vers index.html ; echec = #errorMsg affiche
           (on capture le texte, sinon le diagnostic se limiterait a un timeout). */
        const outcome = await Promise.race([
            page.waitForFunction(() => location.href.includes('index.html'), { timeout: 30000 })
                .then(() => 'redirect'),
            page.waitForFunction(() => {
                const e = document.querySelector('#errorMsg');
                return e && e.classList.contains('visible') && e.textContent.trim();
            }, { timeout: 30000 }).then(() => 'error'),
        ]);
        if (outcome === 'error') {
            const msg = await page.evaluate(() => document.querySelector('#errorMsg').textContent);
            check('D4', 'inscription + session active', false, 'register.php: ' + msg);
        } else {
            const chk = await page.evaluate(() =>
                fetch('api/auth.php?action=check', { cache: 'no-store' }).then((r) => r.json()));
            check('D4', 'inscription + session active', chk.logged_in === true,
                `pseudo=${chk.pseudo || '(aucun)'} [attendu ${pseudo}]`);
            globalThis.__pseudo = pseudo;
        }
    });
} catch (e) {
    check('D4', 'inscription + session active', false, e.message);
}

/* D5 : preference ecrite puis lue COTE SERIEUR (preferences.db) */
try {
    await op(() => page.waitForFunction(() => typeof ecrirePreference === 'function', { timeout: 15000 }));
    const val = 'd5-' + Date.now();
    const wrote = await op(() => page.evaluate(async (v) => {
        const ok = await ecrirePreference('fl-devtest', v);
        return { ok, logue: !!utilisateurLogue, php: phpDisponible };
    }, val));
    const srv = await op(() => page.evaluate(() =>
        fetch('api/auth.php?action=get_preferences&key=fl-devtest', { cache: 'no-store' })
            .then((r) => r.json())));
    check('D5', 'preference ecrite -> relue depuis le serveur',
        wrote.ok && wrote.logue && srv.value === val,
        `logge=${wrote.logue}, php=${wrote.php}, serveur=${JSON.stringify(srv.value)}`);
    globalThis.__val = val;
} catch (e) {
    check('D5', 'preference ecrite -> relue depuis le serveur', false, e.message);
}

/* D8a : bascule de theme (avant force-stop pour tester la persistence) */
let themeAvant = null;
try {
    themeAvant = await op(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')));
    await op(() => page.click('.brand-mark'));
    const themeApres = await op(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')));
    const stored = await op(() => page.evaluate(() => localStorage.getItem('fl-theme')));
    check('D8', 'bascule clair/sombre (clic .brand-mark)',
        themeApres && themeApres !== themeAvant && stored === themeApres,
        `${themeAvant} -> ${themeApres} (localStorage=${stored})`);
    globalThis.__theme = themeApres;
} catch (e) {
    check('D8', 'bascule clair/sombre (clic .brand-mark)', false, e.message);
}

/* D7 : export JSON -> /sdcard/Download (DownloadListener -> MediaStore) */
try {
    const before = new Set((adb(serial, 'shell', 'ls', '/sdcard/Download') || '').split('\n'));
    await op(() => page.waitForFunction(() => typeof exporterDonnees === 'function', { timeout: 15000 }));
    await op(() => page.evaluate(() => { try { exporterDonnees(); } catch (e) { window.__expErr = String(e); } }));
    let nouveau = null;
    for (let i = 0; i < 20 && !nouveau; i++) {
        await sleep(1000);
        const now = (adb(serial, 'shell', 'ls', '/sdcard/Download') || '').split('\n');
        nouveau = now.find((f) => f.endsWith('.json') && !before.has(f)) || null;
    }
    const expErr = await op(() => page.evaluate(() => window.__expErr || null));
    check('D7', 'export JSON -> /sdcard/Download', !!nouveau,
        nouveau || expErr || 'aucun nouveau .json apres 20s');
} catch (e) {
    check('D7', 'export JSON -> /sdcard/Download', false, e.message);
}

/* D6 : force-stop -> session, preference et theme doivent survivre */
try {
    const val = globalThis.__val;
    const theme = globalThis.__theme;
    adb(serial, 'shell', 'am', 'force-stop', PKG);
    await sleep(2500);
    adb(serial, 'shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
    try { await browser.disconnect(); } catch (e) { /* deja ferme */ }
    await sleep(2500);
    browser = await connectCDP(serial);
    page = await pageOf(browser);
    /* meme piege que D1 : attendre index.html, pas simplement /fl-sheet/
       (boot-poc.html est lui-meme sous /fl-sheet/) */
    await op(() => page.waitForFunction(
        () => location.href.includes('/fl-sheet/index.html') && document.readyState === 'complete',
        { timeout: 120000 }));
    const chk = await page.evaluate(() =>
        fetch('api/auth.php?action=check', { cache: 'no-store' }).then((r) => r.json()));
    check('D6a', 'session reprise apres redemarrage app', chk.logged_in === true,
        `pseudo=${chk.pseudo || '(aucun)'}`);
    if (val) {
        const srv = await page.evaluate(() =>
            fetch('api/auth.php?action=get_preferences&key=fl-devtest', { cache: 'no-store' })
                .then((r) => r.json()));
        check('D6b', 'preference preservee (preferences.db en IDBFS)', srv.value === val,
            `serveur=${JSON.stringify(srv.value)}`);
    } else {
        check('D6b', 'preference preservee (preferences.db en IDBFS)', false, 'D5 en echec, non mesurable');
    }
    if (theme) {
        const t = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
        check('D6c', 'theme preserve apres redemarrage', t === theme, `${theme} -> ${t}`);
    }
} catch (e) {
    check('D6a', 'session reprise apres redemarrage app', false, e.message);
}

/* D9 : cartes webp chargees sur l'appareil */
try {
    const maps = await op(() => page.evaluate(() =>
        [...document.querySelectorAll('img[src*="maps/"]')].map((i) => ({ s: i.getAttribute('src'), w: i.naturalWidth }))));
    check('D9', 'cartes maps/*.webp decodees',
        maps.length > 0 && maps.every((m) => m.w > 0),
        maps.length ? `${maps.length} images, min w=${Math.min(...maps.map((m) => m.w))}` : 'aucune img maps/ sur la page');
} catch (e) {
    check('D9', 'cartes maps/*.webp decodees', false, e.message);
}

/* --- 4. Bilan ------------------------------------------------------ */
const ko = results.filter((r) => !r.ok);
console.log('\n================ BILAN §6.2 ================');
for (const r of results) console.log(` ${r.ok ? '✔' : '✘'} ${r.id} ${r.label}`);
console.log(`\n${results.length - ko.length}/${results.length} controles OK`);
console.log('Manuels (a faire a la main) : pinch-zoom carte, import JSON (selecteur de fichiers),');
console.log('mise a jour versionCode (rebuilder avec -VersionCode 2 puis install -r).');

try { await browser.disconnect(); } catch (e) { /* rien */ }
adb(serial, 'forward', '--remove', `tcp:${PORT}`);
process.exit(ko.length ? 1 : 0);
