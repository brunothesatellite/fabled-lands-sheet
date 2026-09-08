const STORAGE_PREFIX = 'fl-';
const ALL_KEYS = [];

let phpDisponible = false;
let utilisateurLogue = null;

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
        userWelcome.textContent = 'Bienvenue ' + utilisateurLogue.pseudo;
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
        await apiFetch('set_preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: cle, value: valeur })
        });
    } else {
        localStorage.setItem(cle, valeur);
    }
}

async function ecrireToutesLesPreferences(prefs) {
    if (phpDisponible && utilisateurLogue) {
        await apiFetch('set_all_preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ preferences: prefs })
        });
    } else {
        Object.keys(prefs).forEach(function(cle) {
            if (prefs[cle] !== undefined) localStorage.setItem(cle, prefs[cle]);
        });
    }
}

async function chargerToutesLesPreferences() {
    if (phpDisponible && utilisateurLogue) {
        const data = await apiFetch('get_preferences');
        var prefs = data && data.preferences ? data.preferences : {};
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
    document.getElementById('booksMenu').hidden = true;
    document.getElementById('mapsMenu').hidden = true;
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
    if (!document.getElementById('booksDropdown').contains(e.target)) document.getElementById('booksMenu').hidden = true;
    if (!document.getElementById('mapsDropdown').contains(e.target)) document.getElementById('mapsMenu').hidden = true;
});

anonExportBtn.addEventListener('click', function() { fermerMenuAnonyme(); exporterDonnees(); });
anonImportBtn.addEventListener('click', function() { fermerMenuAnonyme(); importFile.click(); });
anonClearBtn.addEventListener('click', function() {
    fermerMenuAnonyme();
    if (!confirm('Effacer toutes vos données Fabled Lands ? Cette action est irréversible.')) return;
    effacerDonnees();
    location.reload();
});
anonLoginBtn.addEventListener('click', function() { fermerMenuAnonyme(); window.location.href = 'login.php'; });
exportBtn.addEventListener('click', function() { fermerMenuUtilisateur(); exporterDonnees(); });
clearDataBtn.addEventListener('click', function() {
    fermerMenuUtilisateur();
    if (!confirm('Effacer toutes vos données Fabled Lands ? Cette action est irréversible.')) return;
    effacerDonnees();
    location.reload();
});
changePasswordBtn.addEventListener('click', function() { fermerMenuUtilisateur(); window.location.href = 'change-password.php'; });
logoutBtn.addEventListener('click', async function() {
    fermerMenuUtilisateur();
    await apiFetch('logout', { method: 'POST' });
    utilisateurLogue = null;
    mettreAJourUIUtilisateur();
    afficherToast('Déconnecté.', 'success');
    location.reload();
});
deleteAccountBtn.addEventListener('click', async function() {
    fermerMenuUtilisateur();
    var motDePasse = prompt('Pour supprimer votre compte, entrez votre mot de passe :');
    if (!motDePasse) return;
    if (!confirm('Êtes-vous sûr ? Cette action est irréversible.')) return;
    var data = await apiFetch('delete_account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: motDePasse })
    });
    if (data && data.ok) {
        utilisateurLogue = null;
        afficherToast('Compte supprimé.', 'success');
        location.reload();
    } else {
        afficherToast(data ? data.error : 'Erreur lors de la suppression.', 'error');
    }
});
importPrefsBtn.addEventListener('click', function() { fermerMenuUtilisateur(); importPrefsFile.click(); });

importPrefsFile.addEventListener('change', async function() {
    var fichier = this.files[0];
    this.value = '';
    if (!fichier) return;
    try {
        var sauvegarde = JSON.parse(await fichier.text());
        if (!formatImportValide(sauvegarde)) throw new Error('Format invalide');
        if (!confirm('Importer ces données ?\n\nDate de l\'export : ' + new Date(sauvegarde.exportedAt).toLocaleString('fr-FR') + '\n\nToutes les données existantes seront écrasées.')) return;
        if (phpDisponible && utilisateurLogue) {
            await apiFetch('clear_preferences', { method: 'POST' });
        } else {
            effacerDonnees();
        }
        await ecrireToutesLesPreferences(sauvegarde.data);
        afficherToast('Données importées avec succès !', 'success');
        setTimeout(function() { location.reload(); }, 1000);
    } catch (error) {
        afficherToast('Ce fichier ne contient pas des données valides.', 'error');
    }
});

importFile.addEventListener('change', async function() {
    var fichier = this.files[0];
    this.value = '';
    if (!fichier) return;
    try {
        var sauvegarde = JSON.parse(await fichier.text());
        if (!formatImportValide(sauvegarde)) throw new Error('Format invalide');
        if (!confirm('Importer ces données ?\n\nDate de l\'export : ' + new Date(sauvegarde.exportedAt).toLocaleString('fr-FR') + '\n\nToutes les données existantes seront écrasées.')) return;
        if (phpDisponible && utilisateurLogue) {
            await apiFetch('clear_preferences', { method: 'POST' });
        } else {
            effacerDonnees();
        }
        await ecrireToutesLesPreferences(sauvegarde.data);
        afficherToast('Données importées avec succès !', 'success');
        setTimeout(function() { location.reload(); }, 1000);
    } catch (error) {
        afficherToast('Ce fichier ne contient pas des données valides.', 'error');
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
        lien.download = 'fabled-lands-' + obtenirHorodatage(new Date()) + '.json';
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

    var panel = document.getElementById('panel-' + tabId);
    if (panel) panel.classList.add('active');

    var tabBtn = document.querySelector('.tab[data-tab="' + tabId + '"]');
    if (tabBtn) tabBtn.classList.add('active');

    var subBtn = document.querySelector('.tab-subitem[data-tab="' + tabId + '"]');
    if (subBtn) subBtn.classList.add('active');

    document.getElementById('booksMenu').hidden = true;
    document.getElementById('mapsMenu').hidden = true;
    window.scrollTo(0, 0);
}

document.querySelectorAll('.tab[data-tab]').forEach(function(btn) {
    btn.addEventListener('click', function() { switchTab(this.dataset.tab); });
});

document.querySelectorAll('.tab-subitem[data-tab]').forEach(function(btn) {
    btn.addEventListener('click', function() { switchTab(this.dataset.tab); });
});

document.getElementById('booksDropdown').querySelector('.tab-dropdown-toggle').addEventListener('click', function(e) {
    e.stopPropagation();
    var menu = document.getElementById('booksMenu');
    document.getElementById('mapsMenu').hidden = true;
    menu.hidden = !menu.hidden;
});

document.getElementById('mapsDropdown').querySelector('.tab-dropdown-toggle').addEventListener('click', function(e) {
    e.stopPropagation();
    var menu = document.getElementById('mapsMenu');
    document.getElementById('booksMenu').hidden = true;
    menu.hidden = !menu.hidden;
});

/* Auto-save form fields */
document.querySelectorAll('[data-key]').forEach(function(el) {
    if (!ALL_KEYS.includes(el.dataset.key)) ALL_KEYS.push(el.dataset.key);
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

async function chargerFormulaire() {
    for (var i = 0; i < ALL_KEYS.length; i++) {
        var cle = ALL_KEYS[i];
        var val = await lirePreference(cle);
        if (val !== null) {
            var el = document.querySelector('[data-key="' + cle + '"]');
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
    cb.addEventListener('change', function() {
        ecrirePreference(this.dataset.key, this.checked ? '1' : '0');
    });
});

async function chargerCheckboxes() {
    for (var i = 0; i < ALL_KEYS.length; i++) {
        var cle = ALL_KEYS[i];
        var val = await lirePreference(cle);
        if (val !== null) {
            var el = document.querySelector('[data-key="' + cle + '"]');
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

function genererCodewords() {
    var grid = document.getElementById('codewordsGrid');
    codewords.forEach(function(word, i) {
        var key = 'fl-codeword-' + i;
        ALL_KEYS.push(key);
        var item = document.createElement('div');
        item.className = 'codeword-item';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = key;
        cb.dataset.key = key;
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
                var inpKey = 'fl-' + bookId + '-inp-' + para.n.replace(/[^a-zA-Z0-9]/g,'_') + '-' + gi;
                inp.dataset.key = inpKey;
                if(!ALL_KEYS.includes(inpKey)) ALL_KEYS.push(inpKey);
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
        } else {
            var trEmpty = document.createElement('tr');
            trEmpty.className = 'book-tr-empty';
            var tdE1 = document.createElement('td');
            tdE1.className = 'book-td book-td-check';
            trEmpty.appendChild(tdE1);
            var tdE2 = document.createElement('td');
            tdE2.className = 'book-td book-td-para';
            trEmpty.appendChild(tdE2);
            var tdE3 = document.createElement('td');
            tdE3.className = 'book-td book-td-input';
            trEmpty.appendChild(tdE3);
            leftTbody.appendChild(trEmpty);
        }
        if(!rightDiv) continue;
        var noteGroup = document.createElement('div');
        noteGroup.className = 'note-group';
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

    var tdAct = document.createElement('td');
    tdAct.className = 'ship-td ship-actions';
    var btnStrike = document.createElement('button');
    btnStrike.type = 'button';
    btnStrike.className = 'ship-action-btn';
    btnStrike.title = 'Barrer / Débarrer';
    btnStrike.innerHTML = '<i class="fa-solid fa-strikethrough"></i>';
    btnStrike.addEventListener('click', function(){ basculerStrike(tr); });
    var btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'ship-action-btn danger';
    btnDel.title = 'Supprimer la ligne';
    btnDel.innerHTML = '<i class="fa-solid fa-trash"></i>';
    btnDel.addEventListener('click', function(){ supprimerLigne(tr); });
    var btnAdd = document.createElement('button');
    btnAdd.type = 'button';
    btnAdd.className = 'ship-action-btn';
    btnAdd.title = 'Ajouter une ligne en dessous';
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
        ta.addEventListener('input', function(){
            clearTimeout(this._saveTimeout);
            var self = this;
            this._saveTimeout = setTimeout(function(){ ecrirePreference(self.dataset.key, self.value); }, 400);
        });
        ta.addEventListener('change', function(){ ecrirePreference(this.dataset.key, this.value); });
        td.appendChild(ta);
        tr.appendChild(td);
    }
    return tr;
}

function basculerStrike(tr){
    var idx = tr.dataset.row;
    var key = shipStrikeKey(idx);
    tr.classList.toggle('ship-row-struck');
    var struck = tr.classList.contains('ship-row-struck');
    ecrirePreference(key, struck ? '1' : '0');
}

function supprimerLigne(tr){
    if(!confirm('Supprimer cette ligne ?')) return;
    var idx = tr.dataset.row;
    for(var c = 0; c < SHIP_COLS.length; c++){
        var k = shipKey(idx, c);
        localStorage.removeItem(k);
        if(phpDisponible && utilisateurLogue) apiFetch('delete_preference',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k})});
        var ki = ALL_KEYS.indexOf(k);
        if(ki !== -1) ALL_KEYS.splice(ki, 1);
    }
    var sk = shipStrikeKey(idx);
    localStorage.removeItem(sk);
    if(phpDisponible && utilisateurLogue) apiFetch('delete_preference',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:sk})});
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
    ALL_KEYS.push(strikeKey);
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
    for(var r = 0; r < rows.length; r++){
        await chargerLigneShip(rows[r]);
    }
}

document.getElementById('shipAddTopBtn').addEventListener('click', function(){
    var tbody = document.getElementById('shipTableBody');
    var newIdx = Date.now();
    var newRow = creerLigneShip(newIdx);
    tbody.appendChild(newRow);
    chargerLigneShip(newRow);
    newRow.scrollIntoView({behavior:'smooth', block:'center'});
});

/* Map zoom */
document.querySelectorAll('.map-image').forEach(function(img) {
    img.addEventListener('click', function() {
        if(this.classList.contains('fullscreen')){
            this.classList.remove('fullscreen');
            this.style.transform = '';
            this._mapScale = 1;
            this._mapX = 0;
            this._mapY = 0;
        } else {
            this.classList.add('fullscreen');
            this._mapScale = 1;
            this._mapX = 0;
            this._mapY = 0;
        }
    });

    var lastDist = 0;
    var lastMid = {x:0, y:0};
    var dragging = false;
    var dragStart = {x:0, y:0};

    img.addEventListener('touchstart', function(e){
        if(!this.classList.contains('fullscreen')) return;
        if(e.touches.length === 2){
            e.preventDefault();
            var dx = e.touches[0].clientX - e.touches[1].clientX;
            var dy = e.touches[0].clientY - e.touches[1].clientY;
            lastDist = Math.sqrt(dx*dx + dy*dy);
            lastMid = {
                x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                y: (e.touches[0].clientY + e.touches[1].clientY) / 2
            };
        } else if(e.touches.length === 1 && this._mapScale > 1){
            e.preventDefault();
            dragging = true;
            dragStart.x = e.touches[0].clientX - this._mapX;
            dragStart.y = e.touches[0].clientY - this._mapY;
        }
    }, {passive:false});

    img.addEventListener('touchmove', function(e){
        if(!this.classList.contains('fullscreen')) return;
        if(e.touches.length === 2){
            e.preventDefault();
            var dx = e.touches[0].clientX - e.touches[1].clientX;
            var dy = e.touches[0].clientY - e.touches[1].clientY;
            var dist = Math.sqrt(dx*dx + dy*dy);
            var mid = {
                x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                y: (e.touches[0].clientY + e.touches[1].clientY) / 2
            };
            if(lastDist > 0){
                var ratio = dist / lastDist;
                var newScale = Math.min(Math.max(this._mapScale * ratio, 1), 5);
                this._mapScale = newScale;
                this._mapX += mid.x - lastMid.x;
                this._mapY += mid.y - lastMid.y;
                this.style.transform = 'translate('+this._mapX+'px,'+this._mapY+'px) scale('+this._mapScale+')';
                this.style.transformOrigin = '0 0';
            }
            lastDist = dist;
            lastMid = mid;
        } else if(e.touches.length === 1 && dragging){
            e.preventDefault();
            this._mapX = e.touches[0].clientX - dragStart.x;
            this._mapY = e.touches[0].clientY - dragStart.y;
            this.style.transform = 'translate('+this._mapX+'px,'+this._mapY+'px) scale('+this._mapScale+')';
            this.style.transformOrigin = '0 0';
        }
    }, {passive:false});

    img.addEventListener('touchend', function(e){
        if(!this.classList.contains('fullscreen')) return;
        if(e.touches.length < 2) lastDist = 0;
        if(e.touches.length === 0) dragging = false;
        if(this._mapScale <= 1){
            this._mapScale = 1;
            this._mapX = 0;
            this._mapY = 0;
            this.style.transform = '';
        }
    });
});

/* Init */
async function initialiser() {
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
    await chargerFormulaire();
    await chargerCheckboxes();
    await chargerShipTable();
}

/* Sync table heights via CSS flex align-items:stretch — no JS needed */

initialiser();
