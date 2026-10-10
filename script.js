const STORAGE_PREFIX = 'fl-';
const ALL_KEYS = [];
/* Recall buttons (last visited book / map) — persisted like any other preference */
const RECALL_BOOK_KEY = 'fl-recall-book';
const RECALL_MAP_KEY = 'fl-recall-map';
ALL_KEYS.push(RECALL_BOOK_KEY, RECALL_MAP_KEY);
const elementMap = new Map();
var previousValues = {};
var logtxt = null;

function obtenirLabel(element, key) {
    if (key === RECALL_BOOK_KEY) return 'Book Recall';
    if (key === RECALL_MAP_KEY) return 'Map Recall';

    if (!element) return key;

    var codewordItem = element.closest('.codeword-item');
    if (codewordItem) {
        var lbl = codewordItem.querySelector('label');
        if (lbl) return lbl.textContent.trim();
    }

    var formField = element.closest('.form-field');
    if (formField) {
        var formLabel = formField.querySelector('.form-label');
        if (formLabel) return formLabel.textContent.trim().replace(/^\S+\s+/, '');
    }

    var parentDiv = element.parentElement;
    if (parentDiv) {
        var label = parentDiv.querySelector('label');
        if (label) return label.textContent.trim().replace(/^\S+\s+/, '');
    }

    var shipTd = element.closest('.ship-td');
    if (shipTd) {
        var shipTr = shipTd.closest('tr');
        var shipTbody = shipTr.closest('tbody');
        var shipTable = shipTbody.closest('table');
        var headers = shipTable.querySelectorAll('thead .ship-th:not(.ship-th-actions)');
        var cellIndex = Array.from(shipTr.children).indexOf(shipTd) - 1;
        var rowIndex = Array.from(shipTbody.children).indexOf(shipTr) + 1;
        if (cellIndex >= 0 && cellIndex < headers.length) {
            return 'Ship ' + headers[cellIndex].textContent.trim() + ' (Row ' + rowIndex + ')';
        }
    }

    var bookTd = element.closest('.book-td');
    if (bookTd) {
        if (element.type === 'checkbox') {
            var cbMatch = key.match(/^fl-book(\d+)-(.+)-c(\d+)$/);
            if (cbMatch) {
                var cbBookNum = cbMatch[1];
                var cbPara = cbMatch[2].replace(/_/g, ' ');
                var cbGiMatch = cbMatch[2].match(/^(\d+)[^-]*-(\d+)/);
                var cbGi = cbGiMatch ? cbGiMatch[2] : '0';
                var cbIndex = parseInt(cbMatch[3]) + 1;
                return 'Book ' + cbBookNum + ' §' + cbPara.split('-')[0] + ' - ' + cbPara + '_' + cbIndex;
            }
        }
        if (element.type === 'text') {
            var inpMatch = key.match(/^fl-book(\d+)-inp-/);
            if (inpMatch) {
                var inpBookNum = inpMatch[1];
                var inpNoteLabel = element.dataset.notelabel || '';
                if (inpNoteLabel) {
                    return 'Book ' + inpBookNum + ' - ' + inpNoteLabel;
                }
            }
        }
    }

    var noteGroup = element.closest('.note-group');
    if (noteGroup) {
        var noteBook = noteGroup.dataset.book || '';
        var notePara = noteGroup.dataset.para || '';
        var noteLabelEl = noteGroup.querySelector('.note-label');
        var noteLabelText = noteLabelEl ? noteLabelEl.textContent.trim() : '';
        if (noteBook && notePara) {
            var noteBookNum = noteBook.replace('book', '');
            return 'Book ' + noteBookNum + ' §' + notePara + ' - ' + noteLabelText;
        }
        return noteLabelText;
    }

    var sectionTitle = element.closest('section');
    if (sectionTitle) {
        var title = sectionTitle.querySelector('.panel-title');
        if (title) return title.textContent.trim();
    }

    var readable = key.replace(/^fl-adventure-/, '').replace(/^fl-notes$/, 'Notes').replace(/^fl-codeword-\d+$/, 'Codeword');
    readable = readable.replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    return readable || key;
}

function ajouterLog(label, oldVal, newVal) {
    if (!logtxt) return;
    var now = new Date();
    var h = String(now.getHours()).padStart(2, '0');
    var m = String(now.getMinutes()).padStart(2, '0');
    var s = String(now.getSeconds()).padStart(2, '0');
    var displayOld = oldVal === '' || oldVal === undefined || oldVal === null ? '(empty)' : oldVal;
    var displayNew = newVal === '' || newVal === undefined || newVal === null ? '(empty)' : newVal;
    var line = h + ':' + m + ':' + s + ' ' + label + ' ' + displayOld + ' => ' + displayNew + '\n';
    logtxt.value = line + logtxt.value;
    var lines = logtxt.value.split('\n');
    if (lines.length > 501) {
        logtxt.value = lines.slice(0, 501).join('\n');
    }
}

function logChange(key, newValue) {
    var oldVal = previousValues[key];
    if (oldVal === undefined || oldVal === null) {
        previousValues[key] = newValue;
        return;
    }
    if (oldVal === newValue) return;
    var el = elementMap.get(key);
    var label = obtenirLabel(el, key);
    ajouterLog(label, oldVal, newValue);
    previousValues[key] = newValue;
}

/* Theme toggle */
const THEME_KEY = 'fl-theme';
const brandMark = document.querySelector('.brand-mark');
function appliquerTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}
(function initTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    if (saved) {
        appliquerTheme(saved);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        appliquerTheme('dark');
    } else {
        appliquerTheme('light');
    }
})();
brandMark.addEventListener('click', function() {
    var current = document.documentElement.getAttribute('data-theme');
    var next = current === 'dark' ? 'light' : 'dark';
    appliquerTheme(next);
    localStorage.setItem(THEME_KEY, next);
});

let phpDisponible = false;
let utilisateurLogue = null;

/* Toast notifications */
var toastContainer = null;
var toastSaveTimer = null;
function showToast(message, type) {
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    var t = document.createElement('div');
    t.className = 'toast toast-' + (type || 'save');
    if (message.indexOf('<') === 0) t.classList.add('toast-icon');
    t.innerHTML = message;
    toastContainer.appendChild(t);
    setTimeout(function(){ t.classList.add('toast-out'); }, 1500);
    setTimeout(function(){ t.remove(); }, 1700);
}
function showToastSave() {
    clearTimeout(toastSaveTimer);
    toastSaveTimer = setTimeout(function(){ showToast('<i class="fa-solid fa-floppy-disk"></i>', 'save'); }, 600);
}

const anonAvatarContainer = document.getElementById('anonAvatarContainer');
const anonAvatarBtn = document.getElementById('anonAvatarBtn');
const anonMenu = document.getElementById('anonMenu');
const anonExportBtn = document.getElementById('anonExportBtn');
const anonImportBtn = document.getElementById('anonImportBtn');
const anonClearBtn = document.getElementById('anonClearBtn');
const anonLoginBtn = document.getElementById('anonLoginBtn');
const anonWelcome = document.getElementById('anonWelcome');
const userAvatarContainer = document.getElementById('userAvatarContainer');
const userAvatarBtn = document.getElementById('userAvatarBtn');
const userAvatarLetter = document.getElementById('userAvatarLetter');
const userWelcome = document.getElementById('userWelcome');
const userMenu = document.getElementById('userMenu');
const changePasswordBtn = document.getElementById('changePasswordBtn');
const importPrefsBtn = document.getElementById('importPrefsBtn');
const logoutBtn = document.getElementById('logoutBtn');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');
const importPrefsFile = document.getElementById('importPrefsFile');
const importFile = document.getElementById('importFile');
const exportBtn = document.getElementById('exportBtn');
const clearDataBtn = document.getElementById('clearDataBtn');

function afficherToast(message, type) {
    let toast = document.querySelector('.toast-message');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast-message';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = 'toast-message' + (type ? ' toast-' + type : '');
    toast.classList.add('visible');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(function() { toast.classList.remove('visible'); }, 3000);
}

async function apiFetch(action, options) {
    try {
        const url = 'api/auth.php?action=' + action;
        const res = await fetch(url, options || {});
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}

async function detecterPhp() {
    try {
        const res = await fetch('api/auth.php?action=check', { method: 'GET' });
        if (res.ok) {
            const data = await res.json();
            phpDisponible = true;
            if (data.logged_in) {
                utilisateurLogue = { pseudo: data.pseudo };
            }
        }
    } catch (e) {
        phpDisponible = false;
    }
    mettreAJourUIUtilisateur();
}

function mettreAJourUIUtilisateur() {
    if (phpDisponible && utilisateurLogue) {
        anonAvatarContainer.hidden = true;
        userAvatarContainer.hidden = false;
        userAvatarLetter.textContent = utilisateurLogue.pseudo.charAt(0).toUpperCase();
        userWelcome.textContent = 'Welcome ' + utilisateurLogue.pseudo;
    } else if (phpDisponible) {
        anonAvatarContainer.hidden = false;
        userAvatarContainer.hidden = true;
        anonLoginBtn.hidden = false;
    } else {
        anonAvatarContainer.hidden = false;
        userAvatarContainer.hidden = true;
        anonLoginBtn.hidden = true;
    }
}

async function lirePreference(cle) {
    if (phpDisponible && utilisateurLogue) {
        const data = await apiFetch('get_preferences&key=' + encodeURIComponent(cle));
        return data && data.value !== null ? data.value : null;
    }
    return localStorage.getItem(cle);
}

async function ecrirePreference(cle, valeur) {
    if (phpDisponible && utilisateurLogue) {
        var result = await apiFetch('set_preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: cle, value: valeur })
        });
        if (!result || !result.ok) {
            afficherToast('Save failed. Check your connection.', 'error');
            return false;
        }
    } else {
        localStorage.setItem(cle, valeur);
    }
    showToastSave();
    return true;
}

async function ecrireToutesLesPreferences(prefs) {
    if (phpDisponible && utilisateurLogue) {
        var result = await apiFetch('set_all_preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ preferences: prefs })
        });
        if (!result || !result.ok) {
            afficherToast('Batch save failed. Check your connection.', 'error');
            return false;
        }
    } else {
        Object.keys(prefs).forEach(function(cle) {
            if (prefs[cle] !== undefined) localStorage.setItem(cle, prefs[cle]);
        });
    }
    showToast('Données importées', 'load');
    return true;
}

async function chargerToutesLesPreferences() {
    if (phpDisponible && utilisateurLogue) {
        const data = await apiFetch('get_preferences');
        if (!data || !data.preferences) {
            afficherToast('Failed to load server data.', 'error');
            return null;
        }
        var prefs = !Array.isArray(data.preferences) ? data.preferences : {};
        ALL_KEYS.forEach(function(cle) {
            if (!(cle in prefs)) prefs[cle] = '';
        });
        return prefs;
    }
    var prefs = {};
    ALL_KEYS.forEach(function(cle) {
        var val = localStorage.getItem(cle);
        prefs[cle] = val !== null ? val : '';
    });
    return prefs;
}

function fermerMenuAnonyme() {
    anonMenu.hidden = true;
    anonAvatarBtn.setAttribute('aria-expanded', 'false');
}

function fermerMenuUtilisateur() {
    userMenu.hidden = true;
    userAvatarBtn.setAttribute('aria-expanded', 'false');
}

function fermerTousLesMenus() {
    fermerMenuAnonyme();
    fermerMenuUtilisateur();
    var booksMenu = document.getElementById('booksMenu');
    var mapsMenu = document.getElementById('mapsMenu');
    booksMenu.hidden = true;
    mapsMenu.hidden = true;
    booksMenu.style.position = '';
    booksMenu.style.left = '';
    booksMenu.style.top = '';
    mapsMenu.style.position = '';
    mapsMenu.style.left = '';
    mapsMenu.style.top = '';
}

anonAvatarBtn.addEventListener('click', function() {
    var ouvert = !anonMenu.hidden;
    fermerTousLesMenus();
    if (!ouvert) {
        anonMenu.hidden = false;
        anonAvatarBtn.setAttribute('aria-expanded', 'true');
    }
});

userAvatarBtn.addEventListener('click', function() {
    var ouvert = !userMenu.hidden;
    fermerTousLesMenus();
    if (!ouvert) {
        userMenu.hidden = false;
        userAvatarBtn.setAttribute('aria-expanded', 'true');
    }
});

document.addEventListener('click', function(e) {
    if (!anonAvatarContainer.contains(e.target)) fermerMenuAnonyme();
    if (!userAvatarContainer.contains(e.target)) fermerMenuUtilisateur();
    if (!document.getElementById('booksDropdown').contains(e.target)) {
        document.getElementById('booksMenu').hidden = true;
        document.getElementById('booksMenu').style.position = '';
        document.getElementById('booksMenu').style.left = '';
        document.getElementById('booksMenu').style.top = '';
    }
    if (!document.getElementById('mapsDropdown').contains(e.target)) {
        document.getElementById('mapsMenu').hidden = true;
        document.getElementById('mapsMenu').style.position = '';
        document.getElementById('mapsMenu').style.left = '';
        document.getElementById('mapsMenu').style.top = '';
    }
});

anonExportBtn.addEventListener('click', function() { fermerMenuAnonyme(); exporterDonnees(); });
anonImportBtn.addEventListener('click', function() { fermerMenuAnonyme(); importFile.click(); });
anonClearBtn.addEventListener('click', function() {
    fermerMenuAnonyme();
    if (!confirm('Delete all your Fabled Lands data? This action is irreversible.')) return;
    effacerDonnees();
    location.reload();
});
anonLoginBtn.addEventListener('click', function() { fermerMenuAnonyme(); window.location.href = 'login.php'; });
exportBtn.addEventListener('click', function() { fermerMenuUtilisateur(); exporterDonnees(); });
clearDataBtn.addEventListener('click', async function() {
    fermerMenuUtilisateur();
    if (!confirm('Delete all your Fabled Lands data? This action is irreversible.')) return;
    if (phpDisponible && utilisateurLogue) {
        var result = await apiFetch('clear_preferences', { method: 'POST' });
        if (!result || !result.ok) {
            afficherToast('Failed to clear server data.', 'error');
            return;
        }
    }
    effacerDonnees();
    location.reload();
});
changePasswordBtn.addEventListener('click', function() { fermerMenuUtilisateur(); window.location.href = 'change-password.php'; });
logoutBtn.addEventListener('click', async function() {
    fermerMenuUtilisateur();
    await apiFetch('logout', { method: 'POST' });
    utilisateurLogue = null;
    mettreAJourUIUtilisateur();
    afficherToast('Logged out.', 'success');
    location.reload();
});
deleteAccountBtn.addEventListener('click', async function() {
    fermerMenuUtilisateur();
    var motDePasse = prompt('To delete your account, enter your password:');
    if (!motDePasse) return;
    if (!confirm('Are you sure? This action is irreversible.')) return;
    var data = await apiFetch('delete_account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: motDePasse })
    });
    if (data && data.ok) {
        utilisateurLogue = null;
        afficherToast('Account deleted.', 'success');
        location.reload();
    } else {
        afficherToast(data ? data.error : 'Error during deletion.', 'error');
    }
});
importPrefsBtn.addEventListener('click', function() { fermerMenuUtilisateur(); importPrefsFile.click(); });

async function traiterImport(fichier) {
    var sauvegarde = JSON.parse(await fichier.text());
    if (!formatImportValide(sauvegarde)) throw new Error('Invalid format');
    if (!confirm('Import this data?\n\nExport date: ' + new Date(sauvegarde.exportedAt).toLocaleString('en-US') + '\n\nAll existing data will be overwritten.')) return;
    if (phpDisponible && utilisateurLogue) {
        var clearResult = await apiFetch('clear_preferences', { method: 'POST' });
        if (!clearResult || !clearResult.ok) {
            afficherToast('Failed to clear server data. Import aborted.', 'error');
            return;
        }
    } else {
        effacerDonnees();
    }
    var writeOk = await ecrireToutesLesPreferences(sauvegarde.data);
    if (!writeOk) return;
    afficherToast('Data imported successfully!', 'success');
    setTimeout(function() { location.reload(); }, 1000);
}

importPrefsFile.addEventListener('change', async function() {
    var fichier = this.files[0];
    this.value = '';
    if (!fichier) return;
    try {
        await traiterImport(fichier);
    } catch (error) {
        afficherToast('This file does not contain valid data.', 'error');
    }
});

importFile.addEventListener('change', async function() {
    var fichier = this.files[0];
    this.value = '';
    if (!fichier) return;
    try {
        await traiterImport(fichier);
    } catch (error) {
        afficherToast('This file does not contain valid data.', 'error');
    }
});

function obtenirHorodatage(date) {
    var p = function(v) { return String(v).padStart(2, '0'); };
    return date.getFullYear() + p(date.getMonth()+1) + p(date.getDate()) + '-' + p(date.getHours()) + p(date.getMinutes()) + p(date.getSeconds());
}

function exporterDonnees() {
    chargerToutesLesPreferences().then(function(prefs) {
        var sauvegarde = { format: 'fl-local-storage', version: 1, exportedAt: new Date().toISOString(), data: prefs };
        var blob = new Blob([JSON.stringify(sauvegarde, null, 2)], { type: 'application/json' });
        var lien = document.createElement('a');
        lien.href = URL.createObjectURL(blob);
        var prefix = 'fabled-lands';
        if (utilisateurLogue && utilisateurLogue.pseudo) {
            prefix = utilisateurLogue.pseudo.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
        }
        lien.download = prefix + '-' + obtenirHorodatage(new Date()) + '.json';
        lien.click();
        URL.revokeObjectURL(lien.href);
    });
}

function formatImportValide(s) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) return false;
    if (s.format !== 'fl-local-storage' || s.version !== 1) return false;
    if (typeof s.exportedAt !== 'string' || isNaN(Date.parse(s.exportedAt))) return false;
    if (!s.data || typeof s.data !== 'object' || Array.isArray(s.data)) return false;
    return true;
}

function effacerDonnees() {
    ALL_KEYS.forEach(function(cle) { localStorage.removeItem(cle); });
}

/* Tab navigation */
function switchTab(tabId) {
    document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.tab-subitem').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('#booksDropdown .tab-dropdown-toggle').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('#mapsDropdown .tab-dropdown-toggle').forEach(function(t) { t.classList.remove('active'); });

    var panel = document.getElementById('panel-' + tabId);
    if (panel) panel.classList.add('active');

    var tabBtn = document.querySelector('.tab[data-tab="' + tabId + '"]');
    if (tabBtn) tabBtn.classList.add('active');

    var subBtn = document.querySelector('.tab-subitem[data-tab="' + tabId + '"]');
    if (subBtn) subBtn.classList.add('active');

    if (tabId && tabId.startsWith('book')) {
        document.getElementById('booksDropdown').querySelector('.tab-dropdown-toggle').classList.add('active');
    } else if (tabId && tabId.startsWith('map')) {
        document.getElementById('mapsDropdown').querySelector('.tab-dropdown-toggle').classList.add('active');
    }

    document.getElementById('booksMenu').hidden = true;
    document.getElementById('mapsMenu').hidden = true;
    document.getElementById('booksMenu').style.position = '';
    document.getElementById('booksMenu').style.left = '';
    document.getElementById('booksMenu').style.top = '';
    document.getElementById('mapsMenu').style.position = '';
    document.getElementById('mapsMenu').style.left = '';
    document.getElementById('mapsMenu').style.top = '';
    window.scrollTo(0, 0);

    if (tabId === 'encounter') actualiserFight();
}

document.querySelectorAll('.tab[data-tab]').forEach(function(btn) {
    btn.addEventListener('click', function() { switchTab(this.dataset.tab); });
});

/* Recall helpers */
function normaliserRecallBook(valeur) {
    if (typeof valeur !== 'string') return null;
    var m = valeur.trim().match(/^([1-9]\d?)$/);
    return m ? m[1] : null;
}

function normaliserRecallMap(valeur) {
    if (typeof valeur !== 'string') return null;
    if (valeur.trim().toUpperCase() === 'W') return 'W';
    var m = valeur.trim().match(/^([1-9]\d?)$/);
    return m ? m[1] : null;
}

function appliquerRecallBook(valeur) {
    var v = normaliserRecallBook(valeur);
    if (!v) return;
    var btn = document.getElementById('bookRecall');
    btn.dataset.recallBook = v;
    btn.textContent = '↩ ' + v;
}

function appliquerRecallMap(valeur) {
    var v = normaliserRecallMap(valeur);
    if (!v) return;
    var btn = document.getElementById('mapRecall');
    btn.dataset.recallMap = v;
    btn.textContent = '↩ ' + v;
}

function definirRecallBook(valeur) {
    var v = normaliserRecallBook(valeur);
    if (!v || document.getElementById('bookRecall').dataset.recallBook === v) return;
    appliquerRecallBook(v);
    ecrirePreference(RECALL_BOOK_KEY, v);
    logChange(RECALL_BOOK_KEY, v);
}

function definirRecallMap(valeur) {
    var v = normaliserRecallMap(valeur);
    if (!v || document.getElementById('mapRecall').dataset.recallMap === v) return;
    appliquerRecallMap(v);
    ecrirePreference(RECALL_MAP_KEY, v);
    logChange(RECALL_MAP_KEY, v);
}

async function restaurerRecall(prefs) {
    if (prefs) {
        appliquerRecallBook(prefs[RECALL_BOOK_KEY]);
        appliquerRecallMap(prefs[RECALL_MAP_KEY]);
    } else {
        appliquerRecallBook(await lirePreference(RECALL_BOOK_KEY));
        appliquerRecallMap(await lirePreference(RECALL_MAP_KEY));
    }
    previousValues[RECALL_BOOK_KEY] = document.getElementById('bookRecall').dataset.recallBook;
    previousValues[RECALL_MAP_KEY] = document.getElementById('mapRecall').dataset.recallMap;
}

document.querySelectorAll('.tab-subitem[data-tab]').forEach(function(btn) {
    btn.addEventListener('click', function() {
        var tab = this.dataset.tab;
        if (tab && tab.indexOf('book') === 0) {
            var match = tab.match(/book(\d+)/);
            if (match) definirRecallBook(match[1]);
        }
        if (tab === 'map-world') {
            definirRecallMap('W');
        }
        if (tab && tab.indexOf('map-book') === 0) {
            var m = tab.match(/map-book(\d+)/);
            if (m) definirRecallMap(m[1]);
        }
        switchTab(tab);
    });
});

document.getElementById('bookRecall').addEventListener('click', function(e) {
    e.stopPropagation();
    var book = this.dataset.recallBook || '3';
    var target = 'book' + book + '-paragraphs';
    switchTab(target);
});

document.getElementById('mapRecall').addEventListener('click', function(e) {
    e.stopPropagation();
    var map = this.dataset.recallMap || 'W';
    var target = map === 'W' ? 'map-world' : 'map-book' + map;
    switchTab(target);
});

document.getElementById('booksDropdown').querySelector('.tab-dropdown-toggle').addEventListener('click', function(e) {
    e.stopPropagation();
    var menu = document.getElementById('booksMenu');
    document.getElementById('mapsMenu').hidden = true;
    document.getElementById('mapsMenu').style.position = '';
    document.getElementById('mapsMenu').style.left = '';
    document.getElementById('mapsMenu').style.top = '';
    menu.hidden = !menu.hidden;
    if (!menu.hidden) {
        var rect = this.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.left = rect.left + 'px';
        menu.style.top = rect.bottom + 'px';
    } else {
        menu.style.position = '';
        menu.style.left = '';
        menu.style.top = '';
    }
});

document.getElementById('mapsDropdown').querySelector('.tab-dropdown-toggle').addEventListener('click', function(e) {
    e.stopPropagation();
    var menu = document.getElementById('mapsMenu');
    document.getElementById('booksMenu').hidden = true;
    document.getElementById('booksMenu').style.position = '';
    document.getElementById('booksMenu').style.left = '';
    document.getElementById('booksMenu').style.top = '';
    menu.hidden = !menu.hidden;
    if (!menu.hidden) {
        var rect = this.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.left = rect.left + 'px';
        menu.style.top = rect.bottom + 'px';
    } else {
        menu.style.position = '';
        menu.style.left = '';
        menu.style.top = '';
    }
});

/* Auto-save form fields */
document.querySelectorAll('[data-key]').forEach(function(el) {
    if (!ALL_KEYS.includes(el.dataset.key)) ALL_KEYS.push(el.dataset.key);
    elementMap.set(el.dataset.key, el);
    el.addEventListener('change', function() {
        ecrirePreference(this.dataset.key, this.value);
    });
    if (el.type === 'text' || el.tagName === 'TEXTAREA' || el.type === 'number') {
        el.addEventListener('input', function() {
            clearTimeout(this._saveTimeout);
            var self = this;
            this._saveTimeout = setTimeout(function() {
                ecrirePreference(self.dataset.key, self.value);
            }, 500);
        });
    }
});

function restoreAll(prefs) {
    for (var [cle, el] of elementMap) {
        var val = prefs[cle];
        if (val === undefined || val === '' || val === null) continue;
        if (el.type === 'checkbox') {
            el.checked = val === '1';
        } else if (el.type === 'number' && val === '') {
            el.value = el.getAttribute('value') || '0';
        } else {
            el.value = val;
        }
    }
}

async function chargerFormulaire() {
    for (var i = 0; i < ALL_KEYS.length; i++) {
        var cle = ALL_KEYS[i];
        var val = await lirePreference(cle);
        if (val !== null) {
            var el = elementMap.get(cle);
            if (el && el.type !== 'checkbox') {
                if (el.type === 'number' && (val === '' || val === null)) {
                    el.value = el.getAttribute('value') || '0';
                } else {
                    el.value = val;
                }
            }
        }
    }
}

/* Checkboxes auto-save */
document.querySelectorAll('input[type="checkbox"][data-key]').forEach(function(cb) {
    ALL_KEYS.push(cb.dataset.key);
    elementMap.set(cb.dataset.key, cb);
    cb.addEventListener('change', function() {
        ecrirePreference(this.dataset.key, this.checked ? '1' : '0');
    });
});

async function chargerCheckboxes() {
    for (var i = 0; i < ALL_KEYS.length; i++) {
        var cle = ALL_KEYS[i];
        var val = await lirePreference(cle);
        if (val !== null) {
            var el = elementMap.get(cle);
            if (el && el.type === 'checkbox') {
                el.checked = val === '1';
            }
        }
    }
}

/* Codewords */
var codewords = [
    "Acid","Afraid","Ague","Aid","Aklar","Alissia","Almanac","Aloft","Altitude","Altruist",
    "Ambuscade","Amcha","Amends","Anchor","Anger","Animal","Anthem","Anvil","Apache","Appease",
    "Apple","Ark","Armour","Artefact","Artery","Ashen","Aspen","Assassin","Assault","Assist",
    "Attar","Auric","Avenge","Avert","Axe","Azure","Bait","Baluster","Barnacle","Bashful",
    "Bastion","Beach","Beltane","Bilge","Bisect","Blemish","Bobbin","Bones","Bookworm","Bosky",
    "Bounty","Boysen","Bridoon","Brisket","Brush","Bullion","Bullseye","Bumble","Bunting","Buzz",
    "Cacogast","Calcium","Callid","Cancel","Catalyst","Cenotaph","Certain","Cerumen","Chance",
    "Cheese","Cheops","Chill","Church","Cithara","Citrus","Civil","Clanger","Colour","Coracle",
    "Cosy","Covet","Crag","Crocus","Cruel","Cull","Curdle","Cushat","Cutlass","Cyclops",
    "Cynosure","Dangle","Dare","Dark","Dawn","Dead","Deathless","Deep","Defend","Deliver",
    "Diamond","Dim","Dirk","Dirty","Discover","Dismal","Dispel","Divest","Dotage","Double",
    "Dove","Drape","Dragon","Drake","Draw","Dread","Dregs","Drifter","Drizzle","Drop",
    "Duress","Dwarf","Earth","Ebb","Ebony","Echo","Eclipse","Ectoplasm","Ecumenical","Edifice",
    "Edify","Efreet","Egret","Eland","Eldritch","Elegant","Element","Elephant","Elite","Elk",
    "Elude","Ember","Enamel","Endless","Energy","Enigma","Enotty","Envoy","Entropy","Epicure",
    "Epistle","Erebus","Errant","Eternal","Ethereal","Evade","Evergreen","Evict","Evil","Evoker",
    "Exorcise","Expunge","Extinguish","Exultant","Face","Faded","Farm","Feral","Fern","Fire",
    "Fist","Flag","Fleet","Flimsy","Flood","Flux","Fog","Foment","Fortress","Fossil",
    "Fracas","Frame","Fresco","Fright","Friz","Frog","Fruit","Fuchsia","Fuligin","Fusty",
    "Future","Gaggle","Gain","Gale","Gallivant","Gamble","Game","Gander","Gannet","Gargoyle",
    "Garland","Gather","Gauche","Gauntlet","Gazelle","Genius","Gentle","Genuflect","Geode",
    "Geyser","Ghastly","Giant","Gibbet","Giggle","Gin","Glacier","Gladden","Glade","Glass",
    "Glide","Glimmer","Glimpse","Glitter","Gloat","Gloom","Glory","Glove","Glutton","Gnash",
    "Gnat","Gnome","Gnu","Goblet","Golem","Gone","Goose","Gore","Gosling","Gossamer",
    "Gourd","Govern","Grace","Graft","Grain","Granite","Granule","Grape","Grapple","Grateful",
    "Grebe","Green","Grief","Grimace","Grime","Grind","Grog","Grotto","Grove","Growl",
    "Grub","Guard","Guilt","Guise","Gulf","Gully","Gush"
];

/* Codeword display filter — visual only, never persisted (no data-key, not in ALL_KEYS) */
var filtreCodewords = document.getElementById('onlyCheckedCodewords');

function appliquerFiltreCodewords() {
    var seulementCochees = filtreCodewords.checked;
    document.querySelectorAll('#codewordsGrid .codeword-item').forEach(function(item) {
        var cb = item.querySelector('input[type="checkbox"]');
        item.hidden = seulementCochees && !(cb && cb.checked);
    });
}

filtreCodewords.addEventListener('change', appliquerFiltreCodewords);

/* Keep the filter in sync when a codeword is checked/unchecked while it is active */
document.getElementById('codewordsGrid').addEventListener('change', function(e) {
    if (!filtreCodewords.checked) return;
    if (e.target && e.target.matches('input[type="checkbox"]')) appliquerFiltreCodewords();
});

/* First visible codeword whose letter is >= the requested one (used when the filter hides targets) */
function premierCodewordVisible(lettre) {
    var items = document.querySelectorAll('#codewordsGrid .codeword-item');
    for (var i = 0; i < items.length; i++) {
        if (items[i].hidden) continue;
        var lbl = items[i].querySelector('label');
        var L = lbl ? lbl.textContent.charAt(0).toUpperCase() : '';
        if (L >= lettre) return items[i];
    }
    return null;
}

function genererCodewords() {
    var grid = document.getElementById('codewordsGrid');
    var firstLetters = {};
    codewords.forEach(function(word, i) {
        var key = 'fl-codeword-' + i;
        ALL_KEYS.push(key);
        var item = document.createElement('div');
        item.className = 'codeword-item';
        var letter = word.charAt(0).toUpperCase();
        if (!firstLetters[letter]) {
            firstLetters[letter] = true;
            item.id = 'cw-' + letter;
        }
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = key;
        cb.dataset.key = key;
        elementMap.set(key, cb);
        cb.addEventListener('change', function() {
            ecrirePreference(this.dataset.key, this.checked ? '1' : '0');
        });
        var lbl = document.createElement('label');
        lbl.htmlFor = key;
        lbl.textContent = word;
        item.appendChild(cb);
        item.appendChild(lbl);
        grid.appendChild(item);
    });
    genererLetterBar(Object.keys(firstLetters).sort());
}

function genererLetterBar(letters) {
    var bar = document.getElementById('letterBar');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    letters.forEach(function(L) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'letter-btn';
        b.textContent = L;
        b.dataset.letter = L;
        b.setAttribute('aria-label', 'Aller au premier codeword en ' + L);
        b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', function() {
            var target = document.getElementById('cw-' + L);
            if (!target || target.hidden) target = premierCodewordVisible(L);
            if (!target) return;
            target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
            bar.querySelectorAll('.letter-btn').forEach(function(x) {
                x.classList.remove('active');
                x.setAttribute('aria-pressed', 'false');
            });
            b.classList.add('active');
            b.setAttribute('aria-pressed', 'true');
            target.classList.remove('flash');
            void target.offsetWidth;
            target.classList.add('flash');
            setTimeout(function() { target.classList.remove('flash'); }, reduceMotion ? 1600 : 1500);
        });
        bar.appendChild(b);
    });

    var tabBar = document.getElementById('tabBar');
    function syncTabbarH() {
        document.documentElement.style.setProperty('--tabbar-h', tabBar.offsetHeight + 'px');
    }
    syncTabbarH();
    if (window.ResizeObserver) new ResizeObserver(syncTabbarH).observe(tabBar);
    window.addEventListener('resize', syncTabbarH);
}

/* Book paragraphs */
var bookData = {
    book1: [
        {n:"10",c:4,note:"46 (Money Invested)"},{n:"10 (Town House)",c:1},{n:"16",c:1},{n:"19",c:3},
        {n:"91",c:1,note:"104 (Money Invested)"},{n:"100 (Town House)",c:1},{n:"116",c:1},{n:"160",c:1},
        {n:"169",c:1,note:"177 (Items in Town House)"},{n:"175",c:1},{n:"199",c:1},{n:"207",c:1},
        {n:"232",c:1,note:"300 (Items in Town House)"},{n:"233",c:1},{n:"264",c:1},{n:"305",c:1},
        {n:"310",c:1,note:"327 (Items in Cache)"},{n:"331",c:1},{n:"337",c:1},{n:"361",c:1},
        {n:"398",c:1,note:"400 (Items in Town House)"},{n:"403",c:1},{n:"409",c:1},{n:"446",c:1},
        {n:"454",c:1,note:"434 (Items in Town House)"},{n:"473",c:1},{n:"496",c:1},{n:"504",c:1},
        {n:"542",c:1,note:"605 (Money Banked)"},{n:"610",c:1},{n:"612",c:1},{n:"619",c:1},
        {n:"635",c:1,note:"Notes"},{n:"645",c:1},{n:"649",c:1},{n:"655",c:1},{n:"667",c:1}
    ],
    book2: [
        {n:"2 (Town House)",c:1,note:"36 (Money Banked)"},
        {n:"48 (Town House)",c:1},{n:"57",c:1},
        {n:"71 (Town House)",c:1,note:"39 (Money Invested)"},{n:"160",c:1},{n:"217 (Town House)",c:1},
        {n:"253",c:1,note:"49 (Money Invested)"},{n:"254",c:1},{n:"391",c:1},
        {n:"416",c:1,note:"85 (Money Invested)"},{n:"443",c:1},{n:"465",c:1},
        {n:"542",c:3,note:"154 (Money Invested)"},{n:"547",c:1},{n:"567 (Amulet)",c:1},
        {n:"567 (Tresses)",c:1,note:"171 (Items in Town House)"},{n:"567 (Katana)",c:1},{n:"586",c:1},
        {n:"648",c:1,note:"211 (Items in Town House)"},{n:"679",c:1},{n:"710",c:1},
        {n:"718",c:1,note:"278 (Items in Town House)"},{n:"727",c:1},{n:"728",c:1},
        {n:"754",c:1,note:"348 (Items in Town House)"},{n:"757",c:1},{n:"760",c:1},
        {n:"762",c:1,note:"661 (Locker Box)"},{n:"777",c:1,note:"Notes"}
    ],
    book3: [
        {n:"44 (Shack)",c:1,note:"74 (Items in Shack)"},
        {n:"49",c:1},{n:"56",c:1},{n:"57",c:1},{n:"68",c:1},{n:"84",c:1},{n:"105",c:1},{n:"120",c:1},
        {n:"143",c:1,note:"335 (Items in House)"},
        {n:"183",c:1},{n:"216",c:1},{n:"351",c:3},{n:"466",c:1},{n:"470",c:1},{n:"477",c:1},{n:"494",c:1},
        {n:"509",c:1,note:"607 (Items in College)"},
        {n:"515",c:1},{n:"572 (College)",c:1},{n:"576",c:1},{n:"651",c:1},{n:"659",c:1},{n:"680",c:1},{n:"692",c:1},
        {n:"719",c:1,note:"652 (Money Invested)"},
        {n:"",c:0,note:"Notes"}
    ],
    book4: [
        {n:"10 (Town House)",c:1,note:"450 (Items Protected by Brotherhood)"},
        {n:"40",c:1},{n:"63",c:1},{n:"127",c:1},{n:"173",c:1},{n:"181",c:1},
        {n:"195",c:1,note:"468 (Items in Hordeth's Villa)"},
        {n:"210",c:1},{n:"243",c:1},{n:"259",c:1},{n:"265",c:1},{n:"326",c:1},
        {n:"360",c:1,note:"509 (Items in Town House)"},
        {n:"376",c:1},{n:"395",c:1},{n:"428",c:1},{n:"429",c:1},{n:"437",c:1},
        {n:"440",c:3,note:"526 (Money Invested)"},
        {n:"467",c:3},{n:"491",c:1},{n:"500",c:1},{n:"513",c:1},{n:"522",c:1},
        {n:"545",c:1,note:"586 (Items Left Behind)"},
        {n:"583",c:1},{n:"605",c:1},{n:"704",c:1},
        {n:"",c:0,note:"600 (Money Banked)"},
        {n:"",c:0,note:"Notes"}
    ],
    book5: [
        {n:"16",c:1,note:"115 (Money Invested)"},
        {n:"44",c:1},{n:"93",c:1},{n:"113",c:1},{n:"120",c:1},
        {n:"126",c:1,note:"245 (Items in Castle)"},
        {n:"153",c:1},{n:"165",c:1},{n:"195",c:1},{n:"204",c:1},
        {n:"216",c:1,note:"401 (Status Points)"},
        {n:"227",c:1},{n:"239",c:1},{n:"247",c:1},{n:"269",c:1},
        {n:"325",c:1,note:"560 (Items in Cellar)"},
        {n:"335",c:1},{n:"467",c:1},{n:"493",c:1},{n:"498",c:1},
        {n:"520",c:1,note:"586 (Items in Room)"},
        {n:"534",c:1},{n:"584",c:1},{n:"592",c:1},{n:"596",c:1},
        {n:"602",c:1,note:"601 (Money Banked)"},
        {n:"622",c:1},{n:"644",c:1},{n:"648",c:1},{n:"672",c:1},
        {n:"697",c:1,note:"624 (Palace Rooms)"},
        {n:"714",c:1},
        {n:"",c:0,note:"Notes"}
    ],
    book6: [
        {n:"68",c:1,note:"175 (Money Invested)"},
        {n:"79 (Town House)",c:1},{n:"92",c:1},{n:"106",c:1},
        {n:"109",c:1,note:"238 (Items in Town House)"},
        {n:"123",c:1},{n:"155 (Town House)",c:1},{n:"164",c:4},
        {n:"174",c:1,note:"276 (Worldly Goods)"},
        {n:"233",c:1},{n:"244",c:1},{n:"258",c:1},
        {n:"263",c:1,note:"284 (Items in Town House)"},
        {n:"328",c:1},{n:"345",c:1},{n:"517",c:1},
        {n:"539",c:1,note:"414 (Items in Town House)"},
        {n:"569",c:1},{n:"604",c:1},{n:"650",c:1},
        {n:"668",c:1,note:"440 (Money Invested)"},
        {n:"",c:0,note:"464 (Private Apartments)"},
        {n:"",c:0,note:"512 (Cabinet)"},
        {n:"",c:0,note:"576 (Apartments)"},
        {n:"",c:0,note:"Notes"}
    ],
    book7: [
        {n:"17",c:1,note:"129 (Items in Town House)"},
        {n:"23",c:4},
        {n:"34",c:1},
        {n:"40",c:1},
        {n:"42 (Town House)",c:1,note:"150 (Items Stored in Quarters)"},
        {n:"58",c:1},{n:"94",c:1},{n:"117",c:1},
        {n:"120",c:1,note:"250 (Items Held in Storage)"},
        {n:"124",c:1},{n:"132",c:1},{n:"135",c:1},
        {n:"141",c:1,note:"250 (Duties Remaining)"},
        {n:"146",c:1},{n:"161",c:1},{n:"178",c:1},
        {n:"204",c:1,note:"263 (Items Held in Spire)"},
        {n:"225 (Town House)",c:1},{n:"233",c:1},{n:"266",c:1},
        {n:"270",c:1,note:"307 (Items Held in Theatre)"},
        {n:"292",c:1},{n:"299",c:1},{n:"305",c:1},
        {n:"307",c:2,note:"405 (Items in Town House)"},
        {n:"313",c:1},{n:"316",c:1},{n:"333 (Town House)",c:1},
        {n:"354",c:1,note:"486 (Items in Town House)"},
        {n:"356",c:1},{n:"407",c:1},{n:"412",c:1},
        {n:"424",c:1},
        {n:"426",c:1},{n:"486",c:1},{n:"506",c:1},{n:"557",c:1},
        {n:"560 (Sword)",c:0},{n:"560 (Storm)",c:0},{n:"560 (Horse)",c:0},
        {n:"588 (2nd Trial)",c:0},{n:"588 (3rd Trial)",c:0},{n:"588 (4th Trial)",c:0},
        {n:"610",c:1,note:"599 (Items Left in Atotl's Home)"},
        {n:"618",c:1},{n:"629",c:1},{n:"635",c:1},{n:"645",c:1},{n:"653",c:1},{n:"690",c:1},
        {n:"694",c:1,note:"624 (Items Stored in Clifftop House)"},
        {n:"729",c:1},{n:"777",c:3},{n:"793",c:1},{n:"847",c:1},{n:"865",c:1},{n:"880",c:1},
        {n:"899",c:1,note:"788 (Flask of Oblivion)"},
        {n:"911",c:1},{n:"912",c:1},{n:"927",c:1},{n:"946",c:1},{n:"947",c:1},{n:"962",c:1},{n:"963",c:1},
        {n:"976",c:1,note:"974 (Stolen Items)"},
        {n:"1043",c:1},{n:"1057",c:1},{n:"1061",c:2},{n:"1067",c:1},
        {n:"1136",c:1},{n:"1145",c:1,note:"1150 (Items in Town House)"},
        {n:"1184",c:1},{n:"1189",c:1},
        {n:"1190",c:5,note:"Notes"}
    ]
};

function genererParagraphes(bookId, listId, prefix) {
    var paragraphs = bookData[bookId];
    if (!paragraphs) return;
    if(paragraphs.length === 0) return;
    var notesBodyId = listId.replace('TableBody', 'NotesBody');
    buildBookTables(paragraphs, listId, notesBodyId, bookId);
}

function buildBookTables(paragraphs, leftTbodyId, rightDivId, bookId){
    var leftTbody = document.getElementById(leftTbodyId);
    var rightDiv = document.getElementById(rightDivId);
    if(!leftTbody) return;
    var groups = [];
    var currentGroup = [];
    for(var i = 0; i < paragraphs.length; i++){
        var para = paragraphs[i];
        if(para.note && currentGroup.length > 0){
            groups.push(currentGroup);
            currentGroup = [];
        }
        currentGroup.push(para);
    }
    if(currentGroup.length > 0) groups.push(currentGroup);
    for(var gi = 0; gi < groups.length; gi++){
        var group = groups[gi];
        var firstPara = group[0];
        var isNoteOnly = (firstPara.n === "" && group.length === 1);
        if(!isNoteOnly){
            for(var g = 0; g < group.length; g++){
                var para = group[g];
                var key = 'fl-' + bookId + '-' + para.n.replace(/[^a-zA-Z0-9]/g,'_') + '-' + gi;
                var tr = document.createElement('tr');
                var tdCheck = document.createElement('td');
                tdCheck.className = 'book-td book-td-check';
                var cbCount = para.c || 1;
                for(var c = 0; c < cbCount; c++){
                    var cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.className = 'para-check';
                    var cbKey = key + '-c' + c;
                    cb.dataset.key = cbKey;
                    if(!ALL_KEYS.includes(cbKey)) ALL_KEYS.push(cbKey);
                    elementMap.set(cbKey, cb);
                    cb.addEventListener('change', function(){
                        ecrirePreference(this.dataset.key, this.checked ? '1' : '0');
                    });
                    tdCheck.appendChild(cb);
                }
                tr.appendChild(tdCheck);
                var tdPara = document.createElement('td');
                tdPara.className = 'book-td book-td-para';
                tdPara.textContent = para.n;
                tr.appendChild(tdPara);
                var tdInput = document.createElement('td');
                tdInput.className = 'book-td book-td-input';
                var inp = document.createElement('input');
                inp.type = 'text';
                inp.className = 'para-input';
                inp.dataset.notelabel = firstPara.note || '';
                var inpKey = 'fl-' + bookId + '-inp-' + para.n.replace(/[^a-zA-Z0-9]/g,'_') + '-' + gi;
                inp.dataset.key = inpKey;
                if(!ALL_KEYS.includes(inpKey)) ALL_KEYS.push(inpKey);
                elementMap.set(inpKey, inp);
                inp.addEventListener('input', function(){
                    clearTimeout(this._saveTimeout);
                    var self = this;
                    this._saveTimeout = setTimeout(function(){ ecrirePreference(self.dataset.key, self.value); }, 400);
                });
                inp.addEventListener('change', function(){ ecrirePreference(this.dataset.key, this.value); });
                tdInput.appendChild(inp);
                tr.appendChild(tdInput);
                leftTbody.appendChild(tr);
            }
        }
        if(!rightDiv) continue;
        var noteGroup = document.createElement('div');
        noteGroup.className = 'note-group';
        noteGroup.dataset.para = firstPara.n;
        noteGroup.dataset.book = bookId;
        if(isNoteOnly){
            noteGroup.classList.add('note-group-label');
        }
        if(firstPara.note){
            var lbl = document.createElement('div');
            lbl.className = 'note-label';
            lbl.textContent = firstPara.note;
            noteGroup.appendChild(lbl);
        }
        var noteKey = 'fl-' + bookId + '-note-g' + gi;
        var ta = document.createElement('textarea');
        ta.className = 'note-textarea';
        ta.dataset.key = noteKey;
        if(!ALL_KEYS.includes(noteKey)) ALL_KEYS.push(noteKey);
        elementMap.set(noteKey, ta);
        ta.placeholder = 'Notes...';
        ta.addEventListener('input', function(){
            clearTimeout(this._saveTimeout);
            var self = this;
            this._saveTimeout = setTimeout(function(){ ecrirePreference(self.dataset.key, self.value); }, 400);
        });
        ta.addEventListener('change', function(){ ecrirePreference(this.dataset.key, this.value); });
        noteGroup.appendChild(ta);
        rightDiv.appendChild(noteGroup);
    }
}

/* Ship table */
var SHIP_COLS = ['type','name','crew','cap','cargo','dock'];
var SHIP_COLS_KEYS = ['fl-ship-type','fl-ship-name','fl-ship-crew','fl-ship-cap','fl-ship-cargo','fl-ship-dock'];
var SHIP_INITIAL_ROWS = 20;

function shipKey(row, col){ return SHIP_COLS_KEYS[col] + '-' + row; }
function shipStrikeKey(row){ return 'fl-ship-strike-' + row; }

function creerLigneShip(idx){
    var tr = document.createElement('tr');
    tr.dataset.row = idx;

    var strikeKey = shipStrikeKey(idx);
    if(!ALL_KEYS.includes(strikeKey)) ALL_KEYS.push(strikeKey);

    var tdAct = document.createElement('td');
    tdAct.className = 'ship-td ship-actions';
    var btnStrike = document.createElement('button');
    btnStrike.type = 'button';
    btnStrike.className = 'ship-action-btn';
    btnStrike.title = 'Strike / Unstrike';
    btnStrike.innerHTML = '<i class="fa-solid fa-strikethrough"></i>';
    btnStrike.addEventListener('click', function(){ basculerStrike(tr); });
    var btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'ship-action-btn danger';
    btnDel.title = 'Delete row';
    btnDel.innerHTML = '<i class="fa-solid fa-trash"></i>';
    btnDel.addEventListener('click', function(){ supprimerLigne(tr); });
    var btnAdd = document.createElement('button');
    btnAdd.type = 'button';
    btnAdd.className = 'ship-action-btn';
    btnAdd.title = 'Add row below';
    btnAdd.innerHTML = '<i class="fa-solid fa-plus"></i>';
    btnAdd.addEventListener('click', function(){ ajouterLigneApres(tr); });
    tdAct.appendChild(btnStrike);
    tdAct.appendChild(btnDel);
    tdAct.appendChild(btnAdd);
    tr.appendChild(tdAct);

    for(var c = 0; c < SHIP_COLS.length; c++){
        var td = document.createElement('td');
        td.className = 'ship-td';
        var ta = document.createElement('textarea');
        ta.rows = 2;
        var key = shipKey(idx, c);
        ta.dataset.key = key;
        if(!ALL_KEYS.includes(key)) ALL_KEYS.push(key);
        elementMap.set(key, ta);
        ta.addEventListener('input', function(){
            clearTimeout(this._saveTimeout);
            var self = this;
            this._saveTimeout = setTimeout(function(){ ecrirePreference(self.dataset.key, self.value); }, 400);
        });
        ta.addEventListener('change', function(e){
            ecrirePreference(this.dataset.key, this.value);
            logChange(this.dataset.key, this.value);
            e.stopPropagation();
        });
        td.appendChild(ta);
        tr.appendChild(td);
    }
    return tr;
}

function basculerStrike(tr){
    var idx = tr.dataset.row;
    var key = shipStrikeKey(idx);
    var wasStruck = tr.classList.contains('ship-row-struck');
    tr.classList.toggle('ship-row-struck');
    var struck = tr.classList.contains('ship-row-struck');
    ecrirePreference(key, struck ? '1' : '0').then(function(ok){
        if(!ok) tr.classList.toggle('ship-row-struck', wasStruck);
    });
}

async function supprimerLigne(tr){
    if(!confirm('Delete this row?')) return;
    var idx = tr.dataset.row;
    var taList = tr.querySelectorAll('textarea');
    var parts = [];
    for(var c = 0; c < taList.length; c++){
        var val = taList[c].value.trim();
        if(val) parts.push(SHIP_COLS[c] + '=' + val);
    }
    if(parts.length) ajouterLog('Ship deleted', '', parts.join(', '));
    for(var c = 0; c < SHIP_COLS.length; c++){
        var k = shipKey(idx, c);
        localStorage.removeItem(k);
        if(phpDisponible && utilisateurLogue) await apiFetch('delete_preference',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k})});
        var ki = ALL_KEYS.indexOf(k);
        if(ki !== -1) ALL_KEYS.splice(ki, 1);
    }
    var sk = shipStrikeKey(idx);
    localStorage.removeItem(sk);
    if(phpDisponible && utilisateurLogue) await apiFetch('delete_preference',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:sk})});
    var ski = ALL_KEYS.indexOf(sk);
    if(ski !== -1) ALL_KEYS.splice(ski, 1);
    tr.remove();
}

function ajouterLigneApres(tr){
    var idx = parseInt(tr.dataset.row);
    var tbody = document.getElementById('shipTableBody');
    var rows = Array.from(tbody.querySelectorAll('tr'));
    var newIdx = Date.now();
    var newRow = creerLigneShip(newIdx);
    tr.after(newRow);
    chargerLigneShip(newRow);
}

function genererShipTable(){
    var tbody = document.getElementById('shipTableBody');
    for(var i = 0; i < SHIP_INITIAL_ROWS; i++){
        tbody.appendChild(creerLigneShip(i));
    }
}

async function chargerLigneShip(tr){
    var idx = tr.dataset.row;
    var strikeKey = shipStrikeKey(idx);
    var strikeVal = await lirePreference(strikeKey);
    if(strikeVal === '1') tr.classList.add('ship-row-struck');
    var taList = tr.querySelectorAll('textarea');
    for(var c = 0; c < taList.length; c++){
        var val = await lirePreference(taList[c].dataset.key);
        if(val !== null) taList[c].value = val;
    }
}

async function chargerShipTable(){
    var rows = document.getElementById('shipTableBody').querySelectorAll('tr');
    var promises = [];
    for(var r = 0; r < rows.length; r++){
        promises.push(chargerLigneShip(rows[r]));
    }
    await Promise.all(promises);
}

document.getElementById('shipAddTopBtn').addEventListener('click', function(){
    var tbody = document.getElementById('shipTableBody');
    var newIdx = Date.now();
    var newRow = creerLigneShip(newIdx);
    tbody.appendChild(newRow);
    chargerLigneShip(newRow);
    newRow.scrollIntoView({behavior:'smooth', block:'center'});
});

/* Visionneuse de cartes : overlay plein ecran (fond fixe + croix), zoom et
   deplacement unifies PC (molette + souris) et mobile (pinch + glisser).
   Model repris de dcc-sheet (map-draw.js) : Pointer Events + capture,
   pinch ancre au milieu des doigts, panning BORNE - et surtout le fond
   n'EST PAS l'image : contrairement a l'ancien .map-image.fullscreen (ou
   un glissement hors ecart emportait fond + carte et bloquait l'ecran),
   ici la carte ne peut plus jamais sortir de l'ecran (bornes + marge).
   Le pinch navigateur est neutralise pendant l'ouverture (gesturestart)
   pour qu'un doigt arrive hors image sans zoomer la page entiere. */
(function() {
    'use strict';
    var viewer = document.getElementById('mapViewer');
    var img = document.getElementById('mapViewerImg');
    var croix = document.getElementById('mapViewerClose');
    if (!viewer || !img || !croix) return;

    var ZOOM_MIN = 1, ZOOM_MAX = 12;  /* bornes relatives a la vue "fit" */
    var MARGE = 48;                   /* px de carte minimum visibles */
    var etat = { ouvert: false, fit: 1, scale: 1, tx: 0, ty: 0 };
    var pts = new Map();              /* pointerId -> {x,y} en cours */
    var actif = null;                 /* {id, sx, sy, tx, ty} : glisser 1 pointeur */
    var pinch = null;                 /* {d0, z0, mid:[x,y}] : pincement 2 doigts */
    var gesteBloque = false;
    var dernierDrag = null;           /* garde anti-fermeture apres glissement */

    /* Borne de translation : l'image reste centree si elle est plus petite
       que l'ecran, sinon elle croise toujours le viewport (MARGE px). */
    function bornes() {
        var vw = viewer.clientWidth, vh = viewer.clientHeight;
        var w = img.offsetWidth * etat.scale, h = img.offsetHeight * etat.scale;
        var bx = (w <= vw || vw <= 2 * MARGE) ? (vw - w) / 2 : null;
        var by = (h <= vh || vh <= 2 * MARGE) ? (vh - h) / 2 : null;
        return {
            minX: bx !== null ? bx : MARGE - w, maxX: bx !== null ? bx : vw - MARGE,
            minY: by !== null ? by : MARGE - h, maxY: by !== null ? by : vh - MARGE
        };
    }

    function appliquer() {
        var b = bornes();
        etat.tx = Math.min(b.maxX, Math.max(b.minX, etat.tx));
        etat.ty = Math.min(b.maxY, Math.max(b.minY, etat.ty));
        img.style.transform = 'translate(' + etat.tx + 'px,' + etat.ty
            + 'px) scale(' + etat.scale + ')';
    }

    /* Zoom ancre sur un point ecran (curseur ou milieu des doigts) :
       le point de la carte sous (ax,ay) ne bouge pas. */
    function zoomAncre(prochaine, ax, ay) {
        var s = Math.min(etat.fit * ZOOM_MAX, Math.max(etat.fit * ZOOM_MIN, prochaine));
        if (s === etat.scale) return;
        var wx = (ax - etat.tx) / etat.scale, wy = (ay - etat.ty) / etat.scale;
        etat.scale = s;
        etat.tx = ax - wx * s;
        etat.ty = ay - wy * s;
    }

    function ajusterFit() {
        var vw = viewer.clientWidth, vh = viewer.clientHeight;
        if (!img.naturalWidth || !vw || !vh) return false;
        etat.fit = Math.min(vw / img.naturalWidth, vh / img.naturalHeight);
        etat.scale = etat.fit;
        etat.tx = (vw - img.naturalWidth * etat.scale) / 2;
        etat.ty = (vh - img.naturalHeight * etat.scale) / 2;
        appliquer();
        return true;
    }

    function ouvrir(src, alt) {
        img.src = src;
        img.alt = alt || '';
        viewer.hidden = false;
        etat.ouvert = true;
        document.body.classList.add('viewer-open');
        if (!gesteBloque) {
            document.addEventListener('gesturestart', bloquerGeste);
            gesteBloque = true;
        }
        if (!ajusterFit()) img.addEventListener('load', ajusterFit, { once: true });
        img.addEventListener('error', fermer, { once: true });
        croix.focus({ preventScroll: true });
    }

    function fermer() {
        if (!etat.ouvert) return;
        viewer.hidden = true;
        etat.ouvert = false;
        pts.clear(); pinch = null; actif = null; dernierDrag = null;
        img.classList.remove('dragging');
        img.style.transform = '';
        document.body.classList.remove('viewer-open');
        if (gesteBloque) {
            document.removeEventListener('gesturestart', bloquerGeste);
            gesteBloque = false;
        }
    }

    function bloquerGeste(e) { e.preventDefault(); }

    /* --- ouverture depuis les miniatures des onglets --- */
    document.querySelectorAll('.map-image').forEach(function(m) {
        m.addEventListener('click', function() { ouvrir(m.src, m.alt); });
    });

    /* --- entrees unifiees : souris, doigt, stylet (Pointer Events) --- */
    viewer.addEventListener('pointerdown', function(e) {
        if (e.target === croix) return;          /* la croix gere son clic */
        if (viewer.setPointerCapture) {
            try { viewer.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        }
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        dernierDrag = { bouge: false };
        if (pts.size === 2) {                    /* 2 doigts -> pincement */
            var v = Array.from(pts.values());
            pinch = {
                d0: Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y) || 1,
                z0: etat.scale,
                mid: [(v[0].x + v[1].x) / 2, (v[0].y + v[1].y) / 2]
            };
            actif = null;
            return;
        }
        if (pts.size > 2) return;
        actif = { id: e.pointerId, sx: e.clientX, sy: e.clientY, tx: etat.tx, ty: etat.ty };
        img.classList.add('dragging');
        e.preventDefault();
    });

    viewer.addEventListener('pointermove', function(e) {
        if (!pts.has(e.pointerId)) return;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pinch && pts.size >= 2) {
            var v = Array.from(pts.values());
            var d = Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y) || 1;
            var mid = [(v[0].x + v[1].x) / 2, (v[0].y + v[1].y) / 2];
            var r = viewer.getBoundingClientRect();
            zoomAncre(pinch.z0 * (d / pinch.d0), pinch.mid[0] - r.left, pinch.mid[1] - r.top);
            etat.tx += mid[0] - pinch.mid[0];    /* le milieu des doigts deplace aussi */
            etat.ty += mid[1] - pinch.mid[1];
            pinch.mid = mid;
            appliquer();
            return;
        }
        if (!actif || e.pointerId !== actif.id) return;
        var dx = e.clientX - actif.sx, dy = e.clientY - actif.sy;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dernierDrag.bouge = true;
        etat.tx = actif.tx + dx;
        etat.ty = actif.ty + dy;
        appliquer();
        e.preventDefault();
    });

    function finPointeur(e) {
        pts.delete(e.pointerId);
        if (pts.size < 2) pinch = null;
        if (pts.size === 0) { actif = null; img.classList.remove('dragging'); }
    }
    viewer.addEventListener('pointerup', finPointeur);
    viewer.addEventListener('pointercancel', finPointeur);

    /* --- molette / trackpad (PC) : zoom ancre sur le curseur --- */
    viewer.addEventListener('wheel', function(e) {
        if (!etat.ouvert) return;
        e.preventDefault();
        var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;  /* mode "ligne" */
        var r = viewer.getBoundingClientRect();
        zoomAncre(etat.scale * Math.exp(-dy * 0.0015), e.clientX - r.left, e.clientY - r.top);
        appliquer();
    }, { passive: false });

    /* pas de menu long-press ni de glisser-doser natif sur la carte */
    viewer.addEventListener('contextmenu', function(e) { e.preventDefault(); });
    viewer.addEventListener('dragstart', function(e) { e.preventDefault(); });
    viewer.addEventListener('selectstart', function(e) { e.preventDefault(); });

    /* --- fermeture : croix, clic sur le fond (si pas de glissement), Echap --- */
    croix.addEventListener('click', fermer);
    viewer.addEventListener('click', function(e) {
        if (e.target === viewer && dernierDrag && !dernierDrag.bouge) fermer();
    });
    document.addEventListener('keydown', function(e) {
        if (!etat.ouvert || e.key !== 'Escape') return;
        e.preventDefault();
        fermer();
    });
})();

/* Encounter */
function actualiserFight() {
    var adventureCombat = document.querySelector('[data-key="fl-adventure-combat"]');
    var adventureDefence = document.querySelector('[data-key="fl-adventure-defence"]');
    var adventureStamina = document.querySelector('[data-key="fl-adventure-current-stamina"]');
    var meCombat = document.getElementById('encounter-me-combat');
    var meDefence = document.getElementById('encounter-me-defence');
    var meStamina = document.getElementById('encounter-me-stamina');
    if (adventureCombat) meCombat.value = adventureCombat.value;
    if (adventureDefence) meDefence.value = adventureDefence.value;
    if (adventureStamina) meStamina.value = adventureStamina.value;
}

document.getElementById('encounter-me-stamina').addEventListener('input', function() {
    var adventureStamina = document.querySelector('[data-key="fl-adventure-current-stamina"]');
    if (adventureStamina) {
        adventureStamina.value = this.value;
        adventureStamina.dispatchEvent(new Event('change', { bubbles: true }));
    }
});

document.getElementById('encounter-foe-reset').addEventListener('click', function() {
    document.getElementById('encounter-foe-combat').value = 1;
    document.getElementById('encounter-foe-defence').value = 1;
    document.getElementById('encounter-foe-stamina').value = 1;
});

/* Init */
async function initialiser() {
    logtxt = document.getElementById('logtxt');
    document.getElementById('logClearBtn').addEventListener('click', function() {
        if (logtxt.value && confirm('Clear the entire log?')) {
            logtxt.value = '';
        }
    });

    document.getElementById('content').addEventListener('change', function(e) {
        var el = e.target;
        if (el.dataset && el.dataset.key) {
            var val = el.type === 'checkbox' ? (el.checked ? 'Checked' : 'Unchecked') : el.value;
            logChange(el.dataset.key, val);
        }
    });

    genererCodewords();
    genererShipTable();
    genererParagraphes('book1', 'book1TableBody', 'fl-book1');
    genererParagraphes('book2', 'book2TableBody', 'fl-book2');
    genererParagraphes('book3', 'book3TableBody', 'fl-book3');
    genererParagraphes('book4', 'book4TableBody', 'fl-book4');
    genererParagraphes('book5', 'book5TableBody', 'fl-book5');
    genererParagraphes('book6', 'book6TableBody', 'fl-book6');
    genererParagraphes('book7', 'book7TableBody', 'fl-book7');

    await detecterPhp();

    if (phpDisponible && utilisateurLogue) {
        var prefs = await chargerToutesLesPreferences();
        if (prefs) restoreAll(prefs);
        await restaurerRecall(prefs);
    } else {
        await chargerFormulaire();
        await chargerCheckboxes();
        await restaurerRecall(null);
    }

    await chargerShipTable();

    elementMap.forEach(function(el, key) {
        if (el.type === 'checkbox') {
            previousValues[key] = el.checked ? 'Checked' : 'Unchecked';
        } else {
            previousValues[key] = el.value;
        }
    });

    showToast('Données restaurées', 'load');

    if (phpDisponible && utilisateurLogue) {
        setInterval(function() {
            if (phpDisponible && utilisateurLogue) {
                apiFetch('check');
            }
        }, 300000);
    }
}

/* Sync table heights via CSS flex align-items:stretch — no JS needed */

/* Dice roller */
var faceRotations = {
    1: 'rotateX(0deg) rotateY(0deg)',
    2: 'rotateX(0deg) rotateY(-90deg)',
    3: 'rotateX(-90deg) rotateY(0deg)',
    4: 'rotateX(90deg) rotateY(0deg)',
    5: 'rotateX(0deg) rotateY(90deg)',
    6: 'rotateX(180deg) rotateY(0deg)'
};
var diceAudioCtx = null;
function playDiceSound() {
    if (!diceAudioCtx) diceAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    for (var i = 0; i < 6; i++) {
        (function(delay) {
            setTimeout(function() {
                var osc = diceAudioCtx.createOscillator();
                var gain = diceAudioCtx.createGain();
                osc.type = 'square';
                osc.frequency.value = 800 + Math.random() * 600;
                gain.gain.setValueAtTime(0.08, diceAudioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, diceAudioCtx.currentTime + 0.06);
                osc.connect(gain);
                gain.connect(diceAudioCtx.destination);
                osc.start();
                osc.stop(diceAudioCtx.currentTime + 0.06);
            }, delay);
        })(i * 100 + Math.random() * 40);
    }
}
function rollDie(die) {
    if (die.classList.contains('rolling')) return;
    var result = Math.floor(Math.random() * 6) + 1;
    die.classList.remove('stopped');
    die.classList.add('rolling');
    die.dataset.value = result;
    playDiceSound();
    setTimeout(function() {
        die.classList.remove('rolling');
        die.classList.add('stopped');
        die.querySelector('.face-result').textContent = result;
    }, 800);
}
document.querySelectorAll('.die').forEach(function(die) {
    die.classList.add('stopped');
    die.querySelector('.face-result').textContent = Math.floor(Math.random() * 6) + 1;
    die.addEventListener('click', function() { rollDie(this); });
});

/* Masthead : le titre doit tenir sur UNE ligne en mobile, quel que soit le
   zoom texte systeme et quelle que soit la largeur reelle de l'ecran.
   La WebView d'Android applique le font_scale systeme a TOUTES les fontes
   (x1.15 sur le Pixel 7a de test : settings get system font_scale = 1.15) -
   aucun calcul CSS ne peut anticiper ce multiplicateur. Sans correctif :
   h1 = 18,21px x 1,15 = 20,94px -> 336px dans 325px de place -> 2 lignes.
   On remet la valeur CSS, on mesure la place reelle de la rangee (hors
   avatar, gaps compris) et on ne reduit la fonte que si le titre deborde.
   En desktop, ou si la place suffit deja, la CSS s'applique seule.
   ATTENTION : getComputedStyle renvoie la valeur DEJA zoomee - on ne peut
   donc pas s'en servir comme valeur declaree (le zoom s'appliquerait deux
   fois) ; on etalonne sur une fonte declaree de reference (100px). */
function ajusterTitreMasthead() {
    var rangee = document.querySelector('.masthead > div:first-child');
    var titre = rangee && rangee.querySelector('h1');
    if (!rangee || !titre) return;
    if (!window.matchMedia('(max-width:600px)').matches) {
        if (titre.style.fontSize) titre.style.fontSize = '';   // desktop : CSS seule
        return;
    }
    titre.style.fontSize = '';                                 // valeur CSS de reference
    titre.style.flexShrink = '0';                             // mesures en largeur naturelle
    var enfants = rangee.children;
    var autres = 0;
    for (var i = 0; i < enfants.length; i++) {
        if (enfants[i] !== titre) autres += enfants[i].getBoundingClientRect().width;
    }
    var ecart = parseFloat(getComputedStyle(rangee).gap) || 0;
    /* -1 : marge d'arrondi pour ne jamais declencher l'ellipsis du h1 */
    var budget = rangee.clientWidth - autres - ecart * (enfants.length - 1) - 1;
    var largeur = titre.getBoundingClientRect().width;
    if (budget <= 0 || largeur <= 0 || largeur <= budget) {
        titre.style.flexShrink = '';                          // la CSS suffit
        return;
    }
    /* Etalonnage : largeur obtenue pour 100px de fonte DECLAREE. Le zoom
       texte systeme s'applique aussi aux valeurs en px, il est donc deja
       inclus dans cette mesure - le rapport budget/ref le neutralise. */
    titre.style.fontSize = '100px';
    var ref = titre.getBoundingClientRect().width;
    titre.style.flexShrink = '';
    titre.style.fontSize = ref > 0 ? (100 * budget / ref) + 'px' : '';
}
ajusterTitreMasthead();
if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(ajusterTitreMasthead);   // re-calibre avec Barlow charge
}
if (window.ResizeObserver) {
    var mastheadRangee = document.querySelector('.masthead > div:first-child');
    if (mastheadRangee) new ResizeObserver(ajusterTitreMasthead).observe(mastheadRangee);
}
window.addEventListener('resize', ajusterTitreMasthead);

initialiser();
