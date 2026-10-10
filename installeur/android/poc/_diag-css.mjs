/* _diag-css.mjs — diagnostic CDP sur appareil : geometrie REELLE du masthead
   et CSS REELLEMENT servie (detecte un ecart entre banc de mesure et WebView).
   Utilisation : node _diag-css.mjs   (adb + debug APK + index.html)          */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const adbBin = path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const SERIAL = process.env.SERIAL || '36091JEHN02009';
const PKG = 'com.fabledlands.sheet';
const PORT = Number(process.env.PORT || 9330);
/* tolere les codes de sortie non nuls (pidof = 1 quand pas de processus) */
const adb = (...a) => {
    try {
        return execFileSync(adbBin, ['-s', SERIAL, ...a], { encoding: 'utf8' })
            .replace(/\r/g, '').trim();
    } catch (e) { return (e.stdout || '').replace(/\r/g, '').trim(); }
};

const debugApk = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist',
    'fabled-lands-sheet-1.14-android-debug.apk');

console.log('D0 installation debug APK ...');
console.log(adb('install', '-r', debugApk));
adb('shell', 'am', 'force-stop', PKG);
adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);

/* CDP : defaultViewport NULL (sinon override 800x600 sur la WebView du tel) */
let browser = null;
for (let i = 0; i < 40 && !browser; i++) {
    const pids = (adb('shell', 'pidof', PKG) || '').split(/\s+/).filter(Boolean);
    for (const pid of pids) {
        try { adb('forward', '--remove', `tcp:${PORT}`); } catch { /* deja absent */ }
        adb('forward', `tcp:${PORT}`, `localabstract:webview_devtools_remote_${pid}`);
        try {
            browser = await puppeteer.connect(
                { browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null });
            break;
        } catch { /* socket pas pret */ }
    }
    if (!browser) await new Promise(r => setTimeout(r, 1000));
}
if (!browser) { console.error('CDP indisponible'); process.exit(1); }

let page = null;
for (let i = 0; i < 60 && !page; i++) {
    const pages = await browser.pages();
    page = pages.find(p => p.url().includes('index.html')
        || p.url().endsWith('/fl-sheet/')) || null;
    if (!page && i % 10 === 9) {
        console.log('urls : ' + (await browser.pages()).map(p => p.url()).join(' | '));
    }
    if (!page) await new Promise(r => setTimeout(r, 1000));
}
if (!page) {
    console.error('index jamais atteint ; urls : '
        + (await browser.pages()).map(p => p.url()).join(' | '));
    process.exit(1);
}
/* attendre l'etat final : les conteneurs d'avatar ne sont visibles qu'apres
   la fin de initialiser() (detecterPhp + etat de connexion) - c'est L'ETAT
   A MESURER, car la colonne avatar resserre la place du titre. */
await page.waitForFunction(
    '!!document.querySelector("#userAvatarContainer:not([hidden]),'
    + ' #anonAvatarContainer:not([hidden])")', { timeout: 30000 })
    .catch(() => console.warn('ATTENTION : aucun conteneur d\'avatar visible'));
await new Promise(r => setTimeout(r, 1500));
console.log('page : ' + page.url());

const info = await page.evaluate(async () => {
    await document.fonts.ready;
    const h1 = document.querySelector('.masthead h1');
    const row = document.querySelector('.masthead > div:first-child');
    const cs = h1 ? getComputedStyle(h1) : null;

    /* toutes les regles h1 declarees (avec la media query parente) */
    const rules = [];
    const walk = (r, cond) => {
        if (r.cssRules) { for (const c of r.cssRules) walk(c, (cond ? cond + ' && ' : '') + (r.conditionText || r.media?.mediaText || '')); return; }
        if (r.selectorText && /(^|,|\s)h1(\s|,|:|\{|$)/.test(r.selectorText)) {
            rules.push(`[${cond || 'top'}] ${r.cssText}`);
        }
    };
    for (const s of [...document.styleSheets]) {
        try { for (const r of s.cssRules) walk(r, ''); } catch { /* cross-origin */ }
    }

    /* sondes : la vraie valeur de vw / de calc / effet autosize */
    const probe = (style) => {
        const d = document.createElement('div');
        d.setAttribute('style', style + ';position:absolute;visibility:hidden;');
        d.textContent = 'Xg';
        document.body.appendChild(d);
        const r = { style, fontSize: getComputedStyle(d).fontSize, w: Math.round(d.getBoundingClientRect().width * 100) / 100 };
        d.remove();
        return r;
    };
    const tab = document.querySelector('.tab, .sheet-tabs .tab, nav .tab');
    return {
        innerWidth, dpr: devicePixelRatio,
        docW: document.documentElement.getBoundingClientRect().width,
        mq600: matchMedia('(max-width:600px)').matches,
        h1Computed: cs && cs.fontSize,
        h1Inline: h1 && h1.style.fontSize || '(aucune)',
        fitFn: typeof window.ajusterTitreMasthead,
        avatarVisible: (() => {
            const c = document.querySelector('#userAvatarContainer:not([hidden]),'
                + ' #anonAvatarContainer:not([hidden])');
            return c ? c.id + ' w=' + Math.round(c.getBoundingClientRect().width) : 'aucun';
        })(),
        h1W: h1 && Math.round(h1.getBoundingClientRect().width * 10) / 10,
        h1DeclRule: rules,
        fontsBarlow: [...document.fonts].filter(f => /Barlow/.test(f.family))
            .map(f => `${f.weight}:${f.status}`).join(', '),
        probes: [
            probe('font-size:100vw'),
            probe('font-size:10.26vw'),
            probe('font-size:calc(10.26vw - 24px)'),
            probe('font-size:18.17px'),
            probe('font-size:1.4rem'),
        ],
        tabComputed: tab && getComputedStyle(tab).fontSize,
        rowGap: row && getComputedStyle(row).gap,
        rowW: row && Math.round(row.getBoundingClientRect().width * 10) / 10,
        children: row ? [...row.children].map(c => {
            const r = c.getBoundingClientRect();
            return `${c.tagName}.${(c.className || '?').split(' ')[0]}`
                + ` x=${Math.round(r.x)} top=${Math.round(r.top)} w=${Math.round(r.width)}`;
        }) : [],
    };
});
console.log(JSON.stringify(info, null, 2));

await browser.disconnect();
try { adb('forward', '--remove', `tcp:${PORT}`); } catch { /* rien */ }
