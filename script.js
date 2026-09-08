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
        return data && data.preferences ? data.preferences : {};
    }
    var prefs = {};
    ALL_KEYS.forEach(function(cle) {
        var val = localStorage.getItem(cle);
        if (val !== null) prefs[cle] = val;
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
        var val = this.type === 'number' ? (this.value || '0') : this.value;
        ecrirePreference(this.dataset.key, val);
    });
    if (el.type === 'text' || el.tagName === 'TEXTAREA' || el.type === 'number') {
        el.addEventListener('input', function() {
            clearTimeout(this._saveTimeout);
            var self = this;
            this._saveTimeout = setTimeout(function() {
                var val = self.type === 'number' ? (self.value || '0') : self.value;
                ecrirePreference(self.dataset.key, val);
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
            if (el) {
                if (el.type === 'number') {
                    el.value = val || '0';
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
        {n:"10",d:"(Money Invested)"},{n:"10",d:"(Town House)"},{n:"16"},
        {n:"19"},{n:"91"},{n:"104",d:"(Money Invested)"},{n:"100",d:"(Town House)"},
        {n:"116"},{n:"160"},{n:"169"},{n:"177",d:"(Items in Town House)"},{n:"175"},
        {n:"199"},{n:"207"},{n:"232"},{n:"300",d:"(Items in Town House)"},{n:"233"},
        {n:"264"},{n:"305"},{n:"310"},{n:"327",d:"(Items in Cache)"},{n:"331"},
        {n:"337"},{n:"361"},{n:"398"},{n:"400",d:"(Items in Town House)"},{n:"403"},
        {n:"409"},{n:"446"},{n:"454"},{n:"434",d:"(Items in Town House)"},{n:"473"},
        {n:"496"},{n:"504"},{n:"542"},{n:"605",d:"(Money Banked)"},{n:"610"},
        {n:"612"},{n:"619"},{n:"635"},{n:"645"},{n:"649"},{n:"655"},{n:"667"}
    ],
    book2: [
        {n:"2",d:"(Town House)"},{n:"36",d:"(Money Banked)"},{n:"48",d:"(Town House)"},
        {n:"57"},{n:"71",d:"(Town House)"},{n:"39",d:"(Money Invested)"},{n:"160"},
        {n:"217",d:"(Town House)"},{n:"253"},{n:"49",d:"(Money Invested)"},{n:"254"},
        {n:"391"},{n:"416"},{n:"85",d:"(Money Invested)"},{n:"443"},{n:"465"},
        {n:"542"},{n:"154",d:"(Money Invested)"},{n:"547"},{n:"567",d:"(Amulet)"},
        {n:"567",d:"(Tresses)"},{n:"171",d:"(Items in Town House)"},{n:"567",d:"(Katana)"},
        {n:"586"},{n:"648"},{n:"211",d:"(Items in Town House)"},{n:"679"},
        {n:"710"},{n:"718"},{n:"278",d:"(Items in Town House)"},{n:"727"},
        {n:"728"},{n:"754"},{n:"348",d:"(Items in Town House)"},{n:"757"},
        {n:"760"},{n:"762"},{n:"661",d:"(Locker Box)"},{n:"777"}
    ],
    book3: [
        {n:"44",d:"(Shack)"},{n:"74",d:"(Items in Shack)"},{n:"49"},{n:"56"},
        {n:"57"},{n:"68"},{n:"84"},{n:"105"},{n:"120"},{n:"143"},
        {n:"335",d:"(Items in House)"},{n:"183"},{n:"216"},{n:"351"},
        {n:"466"},{n:"470"},{n:"477"},{n:"494"},{n:"509"},
        {n:"607",d:"(Items in College)"},{n:"515"},{n:"572",d:"(College)"},
        {n:"576"},{n:"651"},{n:"659"},{n:"680"},{n:"692"},{n:"719"},
        {n:"652",d:"(Money Invested)"}
    ],
    book4: [
        {n:"10",d:"(Town House)"},{n:"450",d:"(Items Protected by Brotherhood)"},
        {n:"40"},{n:"63"},{n:"127"},{n:"173"},{n:"181"},{n:"195"},
        {n:"468",d:"(Items in Hordeth's Villa)"},{n:"210"},{n:"243"},{n:"259"},
        {n:"265"},{n:"326"},{n:"360"},{n:"509",d:"(Items in Town House)"},{n:"376"},
        {n:"395"},{n:"428"},{n:"429"},{n:"437"},{n:"440"},
        {n:"526",d:"(Money Invested)"},{n:"467"},{n:"491"},{n:"500"},
        {n:"513"},{n:"522"},{n:"545"},{n:"586",d:"(Items Left Behind)"},
        {n:"583"},{n:"605"},{n:"704"},{n:"600",d:"(Money Banked)"}
    ],
    book5: [
        {n:"16"},{n:"115",d:"(Money Invested)"},{n:"44"},{n:"93"},{n:"113"},
        {n:"120"},{n:"126"},{n:"245",d:"(Items in Castle)"},{n:"153"},{n:"165"},
        {n:"195"},{n:"204"},{n:"216"},{n:"401",d:"(Status Points)"},{n:"227"},
        {n:"239"},{n:"247"},{n:"269"},{n:"325"},{n:"560",d:"(Items in Cellar)"},
        {n:"335"},{n:"467"},{n:"493"},{n:"498"},{n:"520"},
        {n:"586",d:"(Items in Room)"},{n:"534"},{n:"584"},{n:"592"},
        {n:"596"},{n:"602"},{n:"601",d:"(Money Banked)"},{n:"622"},
        {n:"644"},{n:"648"},{n:"672"},{n:"697"},{n:"624",d:"(Palace Rooms)"},{n:"714"}
    ],
    book6: [
        {n:"68"},{n:"175",d:"(Money Invested)"},{n:"79",d:"(Town House)"},
        {n:"92"},{n:"106"},{n:"109"},{n:"238",d:"(Items in Town House)"},{n:"123"},
        {n:"155",d:"(Town House)"},{n:"164"},{n:"174"},{n:"276",d:"(Worldly Goods)"},
        {n:"233"},{n:"244"},{n:"258"},{n:"263"},{n:"284",d:"(Items in Town House)"},
        {n:"328"},{n:"345"},{n:"517"},{n:"539"},{n:"414",d:"(Items in Town House)"},
        {n:"569"},{n:"604"},{n:"650"},{n:"668"},{n:"440",d:"(Money Invested)"},
        {n:"464",d:"(Private Apartments)"},{n:"512",d:"(Cabinet)"},
        {n:"576",d:"(Apartments)"}
    ],
    book7a: [
        {n:"17"},{n:"560",d:"(Sword)"},{n:"129",d:"(Items in Town House)"},
        {n:"23"},{n:"560",d:"(Storm)"},{n:"34"},{n:"560",d:"(Horse)"},
        {n:"40"},{n:"588",d:"(2nd Trial)"},{n:"42",d:"(Town House)"},
        {n:"588",d:"(3rd Trial)"},{n:"150",d:"(Items Stored in Quarters)"},
        {n:"58"},{n:"588",d:"(4th Trial)"},{n:"94"},{n:"117"},{n:"120"},
        {n:"250",d:"(Items Held in Storage)"},{n:"124"},{n:"132"},{n:"135"},
        {n:"141"},{n:"250",d:"(Duties Remaining)"},{n:"146"},{n:"161"},{n:"178"},
        {n:"204"},{n:"263",d:"(Items Held in Spire)"},{n:"225",d:"(Town House)"},
        {n:"233"},{n:"266"},{n:"270"},{n:"307",d:"(Items Held in Theatre)"},
        {n:"292"},{n:"299"},{n:"305"},{n:"307"},{n:"405",d:"(Items in Town House)"},
        {n:"313"},{n:"316"},{n:"333",d:"(Town House)"},{n:"354"},
        {n:"486",d:"(Items in Town House)"},{n:"356"},{n:"407"},{n:"412"},
        {n:"424"},{n:"426"},{n:"486"},{n:"506"},{n:"557"}
    ],
    book7b: [
        {n:"610"},{n:"599",d:"(Items Left in Atotl's Home)"},{n:"618"},
        {n:"629"},{n:"635"},{n:"645"},{n:"653"},{n:"690"},{n:"694"},
        {n:"624",d:"(Items Stored in Clifftop House)"},{n:"729"},{n:"777"},
        {n:"793"},{n:"847"},{n:"865"},{n:"880"},{n:"899"},
        {n:"788",d:"(Flask of Oblivion)"},{n:"911"},{n:"912"},{n:"927"},
        {n:"946"},{n:"947"},{n:"962"},{n:"963"},{n:"974",d:"(Stolen Items)"},
        {n:"976"},{n:"1043"},{n:"1057"},{n:"1061"},{n:"1067"},
        {n:"1136"},{n:"1145"},{n:"1150",d:"(Items in Town House)"},
        {n:"1184"},{n:"1189"},{n:"1190"}
    ]
};

function genererParagraphes(bookId, listId, prefix) {
    var list = document.getElementById(listId);
    if (!list) return;
    var paragraphs = bookData[bookId];
    if (!paragraphs) return;
    paragraphs.forEach(function(para, i) {
        var key = prefix + '-para-' + para.n + '-' + i;
        ALL_KEYS.push(key);
        var item = document.createElement('div');
        item.className = 'paragraph-item';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = key;
        cb.dataset.key = key;
        cb.addEventListener('change', function() {
            ecrirePreference(this.dataset.key, this.checked ? '1' : '0');
        });
        var num = document.createElement('span');
        num.className = 'para-number';
        num.textContent = para.n;
        var desc = document.createElement('span');
        desc.className = 'para-desc';
        desc.textContent = para.d || '';
        item.appendChild(cb);
        item.appendChild(num);
        item.appendChild(desc);
        list.appendChild(item);
    });
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
        var ki = ALL_KEYS.indexOf(k);
        if(ki !== -1) ALL_KEYS.splice(ki, 1);
    }
    var sk = shipStrikeKey(idx);
    localStorage.removeItem(sk);
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
    newRow.scrollIntoView({behavior:'smooth', block:'center'});
});

/* Map zoom */
document.querySelectorAll('.map-image').forEach(function(img) {
    img.addEventListener('click', function() {
        this.classList.toggle('fullscreen');
    });
});

/* Init */
async function initialiser() {
    genererCodewords();
    genererShipTable();
    genererParagraphes('book1', 'book1-list', 'fl-book1');
    genererParagraphes('book2', 'book2-list', 'fl-book2');
    genererParagraphes('book3', 'book3-list', 'fl-book3');
    genererParagraphes('book4', 'book4-list', 'fl-book4');
    genererParagraphes('book5', 'book5-list', 'fl-book5');
    genererParagraphes('book6', 'book6-list', 'fl-book6');
    genererParagraphes('book7a', 'book7a-list', 'fl-book7');
    genererParagraphes('book7b', 'book7b-list', 'fl-book7');

    await detecterPhp();
    await chargerFormulaire();
    await chargerCheckboxes();
    await chargerShipTable();
}

initialiser();
