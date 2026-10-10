/* ============================================================
   _check-mapviewer-device.mjs — visionneuse sur appareil reel
   ------------------------------------------------------------
   Valide sur la WebView du telephone ce que le banc desktop ne
   peut pas : le pinch 2 doigts (Input.dispatchTouchEvent reel),
   le glisser tactile borne, le clic sur la croix, la garde
   anti-fermeture. Captures via screencap (SHOT=1 par defaut).
   Sortie non nulle => regression.
   ============================================================ */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const PKG = 'com.fabledlands.sheet';
const ORIGIN = 'https://appassets.androidplatform.net';
const PORT = 9232;
const SERIAL = process.env.SERIAL || '36091JEHN02009';
const MARGE = 48;                    /* px de carte min. visibles (cf. script.js) */
const OUT = path.join(here, '_mapviewer-shots');
const adbBin = path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const adb = (...a) => execFileSync(adbBin, ['-s', SERIAL, ...a], { encoding: 'utf8' });

/* ecran allume + debloque si pas de code */
try { adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'); } catch (e) { /* ignore */ }
const wake = adb('shell', 'dumpsys', 'power');
if (/mWakefulness=Asleep/.test(wake)) {
    adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP');
    await sleep(800);
}

const pid = adb('shell', 'pidof', PKG).trim().split('\n')[0];
if (!pid) { console.log('app non demarree : demarrage...'); adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`); await sleep(6000); }
const pid2 = adb('shell', 'pidof', PKG).trim().split('\n')[0];
try { adb('forward', '--remove', `tcp:${PORT}`); } catch (e) { /* pas encore */ }
adb('forward', `tcp:${PORT}`, `localabstract:webview_devtools_remote_${pid2}`);
const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null });
const pages = await browser.pages();
let page = pages.find((p) => p.url().includes('fl-sheet')) || pages[0];
await page.waitForFunction(() => !!document.querySelector('#tabBar'), { timeout: 30000 });

let bad = 0;
const ko = (tag, detail) => { bad++; console.log(`${tag} | ${detail}  <-- BUG`); };
const ok = (tag, detail) => console.log(`${tag} | OK | ${detail}`);

const V = 'document.getElementById("mapViewer")';
const I = 'document.getElementById("mapViewerImg")';

/* ouverture par le VRAI parcours utilisateur : onglets MAPS -> World -> carte */
const ouvrirParUi = () => page.evaluate(async () => {
    const btn = [...document.querySelectorAll('#tabBar button, #tabBar .tab, #tabBar a')]
        .find((b) => /maps/i.test(b.textContent));
    if (btn) { btn.click(); await new Promise((r) => setTimeout(r, 300)); }
    const monde = [...document.querySelectorAll('#mapsDropdown button, #mapsDropdown a, .map-menu button, .map-menu a, button, a')]
        .find((b) => /^world$/i.test(b.textContent.trim()));
    if (monde) { monde.click(); await new Promise((r) => setTimeout(r, 300)); }
    const img = document.querySelector('.map-image');
    if (!img) return 'aucune .map-image';
    img.click();
    return document.getElementById('mapViewer').hidden ? 'viewer non ouvert' : 'ouvert';
});

const etat = () => page.evaluate(`(() => {
    const v = ${V}, i = ${I};
    const m = new DOMMatrixReadOnly(getComputedStyle(i).transform);
    const r = i.getBoundingClientRect(), rv = v.getBoundingClientRect();
    const ix = Math.max(0, Math.min(rv.right, r.right) - Math.max(rv.left, r.left));
    const iy = Math.max(0, Math.min(rv.bottom, r.bottom) - Math.max(rv.top, r.top));
    return { ouvert: !v.hidden, scale: m.a, interX: Math.round(ix), interY: Math.round(iy) };
})()`);

const capture = (nom) => {
    if (!process.env.SHOT) return;
    fs.mkdirSync(OUT, { recursive: true });
    const raw = execFileSync(adbBin, ['-s', SERIAL, 'exec-out', 'screencap', '-p'], { maxBuffer: 1 << 28 });
    fs.writeFileSync(path.join(OUT, nom), raw);
};

/* --- T1 : ouverture via l'UI + vue fit --- */
const ouvert = await ouvrirParUi();
if (ouvert !== 'ouvert') ko('T1 ouverture', ouvert);
else {
    await sleep(400);
    const e0 = await etat();
    if (!(e0.scale > 0 && e0.interX > 0 && e0.interY > 0)) ko('T1 ouverture', JSON.stringify(e0));
    else ok('T1 ouverture', `fit scale=${(e0.scale * 100).toFixed(1)}% carte visible ${e0.interX}x${e0.interY}px`);
}
capture('device-viewer-ouvert.png');

/* --- T2 : pinch 2 doigts reel (touch events) --- */
const av = await etat();
const cdp = await page.createCDPSession();
const point = (id, x, y) => ({ x: Math.round(x), y: Math.round(y), id });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(1, 150, 420), point(2, 250, 420)] });
for (let k = 1; k <= 6; k++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(1, 150 - k * 15, 420), point(2, 250 + k * 15, 420)] });
    await sleep(40);
}
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await sleep(300);
const ap = await etat();
if (!(ap.scale > av.scale * 1.5)) ko('T2 pinch', `scale ${av.scale.toFixed(3)} -> ${ap.scale.toFixed(3)}`);
else ok('T2 pinch', `x${(ap.scale / av.scale).toFixed(2)} (${av.scale.toFixed(3)} -> ${ap.scale.toFixed(3)})`);
capture('device-viewer-pinch.png');

/* --- T3 : glisser tactile borne (la carte ne sort jamais) --- */
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(1, 200, 400)] });
for (let k = 1; k <= 5; k++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(1, 200 - k * 60, 400 - k * 50)] });
    await sleep(40);
}
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await sleep(300);
const e3 = await etat();
if (e3.interX < MARGE - 1 || e3.interY < MARGE - 1) ko('T3 borne', `intersection ${e3.interX}x${e3.interY} < ${MARGE}`);
else ok('T3 borne', `glissements géants -> carte encore visible ${e3.interX}x${e3.interY}px`);
capture('device-viewer-glisse.png');

/* --- T4 : croix ferme ; reouverture + garde anti-glissement --- */
await page.click('#mapViewerClose');
if ((await etat()).ouvert) ko('T4 croix', 'la croix ne ferme pas');
else ok('T4 croix', 'fermeture par la croix');

await ouvrirParUi();
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(1, 20, 20)] });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(1, 140, 160)] });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await sleep(300);
const e4 = await etat();
if (!e4.ouvert) ko('T4 garde-drag', 'un glissement a ferme la visionneuse');
else ok('T4 garde-drag', 'glissement (coin -> centre) sans fermeture parasite');

/* --- T5 : theme sombre applique a la visionneuse --- */
const theme = await page.evaluate(() => {
    const t = document.documentElement.getAttribute('data-theme');
    if (t !== 'dark') { document.querySelector('.brand-mark').click(); return document.documentElement.getAttribute('data-theme'); }
    return t;
});
await sleep(300);
capture('device-viewer-dark.png');
ok('T5 theme', `theme visionneuse = ${theme}`);

/* nettoyage */
await page.click('#mapViewerClose');
await browser.disconnect();
try { adb('forward', '--remove', `tcp:${PORT}`); } catch (e) { /* ignore */ }

console.log(bad ? `\n${bad} controle(s) en echec` : '\nOK : visionneuse appareil (ouverture UI, pinch reel, borne, croix, garde)');
process.exit(bad ? 1 : 0);
