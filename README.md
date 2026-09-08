# Fabled Lands Companion

A web-based Adventure Sheet application for the **Fabled Lands** gamebook series (books 1 to 7). Designed for mobile-first use (smartphone-compatible), it replaces the paper play sheets with a fully interactive, auto-saving digital companion.

---

## User Manual

### Getting Started

Open `index.html` in a browser. No installation is required for anonymous mode — all data is saved automatically in your browser's local storage.

If the server runs PHP, you can create an account to sync your data across devices.

### Navigation

The top of the screen features a **tab bar** for quick navigation between sections:

| Tab | Description |
|---|---|
| **Adventure Sheet** | Your character's core stats, abilities, possessions, money, titles, and blessings |
| **Ship's Manifest** | Track your fleet: ship type, name, crew quality, cargo, and docking location |
| **Codewords** | A checklist of all codewords encountered across the 7 books |
| **Books** (dropdown) | Per-book paragraph trackers with notes (Books 1–7) |
| **Notes** | A free-form text area for general notes |
| **Maps** (dropdown) | Interactive maps: world map and per-book maps |

### Adventure Sheet

- Fill in your character's **Name**, **Profession**, **God**, **Rank**, and **Defence**.
- Set your six **Ability Scores** (Charisma, Combat, Magic, Sanctity, Scouting, Thievery) from 1 to 12.
- Track your **Current** and **Maximum Stamina**.
- Record up to 12 **Possessions**.
- Write **Resurrection Arrangements**, **Money**, **Titles & Honours**, and **Blessings** in the provided text areas.

All fields auto-save as you type.

### Ship's Manifest

- The table starts with 20 empty rows.
- Each row has fields: Ship Type, Ship Name, Crew Quality, Cargo Capacity, Current Cargo, Where Docked.
- Use the action buttons on each row:
  - **Strikethrough** — cross out a row (e.g. a lost ship).
  - **Trash** — delete the row permanently.
  - **Plus** — insert a new row below.
- Use the **"Ajouter une ligne"** button at the bottom to append a new row.

### Codewords

- A grid of checkboxes for every codeword in the series.
- Check a codeword when you learn it during your adventure.

### Book Paragraphs

- Each book (1–7) has its own tab with a table of **paragraph numbers** and associated **notes**.
- Check the checkbox next to a paragraph when you visit it.
- Some paragraphs have cross-references (e.g. "46 (Money Invested)") shown as note labels on the right panel.
- Write your own notes in the text fields alongside each paragraph group.

### Maps

- Tap a map to view it **fullscreen**.
- Tap again to return to the fitted view.
- In fullscreen mode on mobile, use **pinch-to-zoom** and **drag** to pan around the map.

### User Menu (Avatar Icon)

Click the avatar icon in the top-right corner to open the user menu:

| Action | Description |
|---|---|
| **Export Data** | Downloads a timestamped JSON file with all your saved data |
| **Import Data** | Upload a previously exported JSON file to restore your data (overwrites current data with confirmation) |
| **Clear Data** | Erases all saved data permanently (requires confirmation) |
| **Login** | Navigate to the login page (only if PHP is available) |
| **Change Password** | Update your account password (logged-in users only) |
| **Logout** | End your session |
| **Delete Account** | Permanently delete your account and all associated data (requires password confirmation) |

### Data Persistence

- **Anonymous mode**: Data is stored in the browser's `localStorage`.
- **Logged-in mode**: Data is synced to the server database (SQLite3) via the PHP API.
- Export/import works in both modes and uses a versioned JSON format (`fl-local-storage` v1).

---

## Architecture

### Overview

The project is a **single-page application (SPA)** with a PHP backend for authentication and server-side data persistence. It uses no build tools or frameworks — pure HTML, CSS, and vanilla JavaScript.

```
fabled-lands-sheet/
├── index.html              # Main SPA entry point
├── script.js               # All client-side logic (~900 lines)
├── style.css               # Main stylesheet (UI components)
├── style-auth.css           # Auth pages stylesheet
├── login.php                # Login page
├── register.php             # Registration page
├── change-password.php      # Password change page
├── favicon.svg              # App icon
├── api/
│   ├── auth.php             # REST API (authentication + preferences CRUD)
│   ├── db.php               # Database layer (SQLite3, helpers)
│   └── preferences.db       # SQLite database file (gitignored)
├── maps/                    # Map images
│   ├── world.png
│   ├── book1.png … book7.png
├── spec.txt                 # Original project specification
├── LICENSE                  # MIT License
└── .gitignore
```

### Frontend

#### Single-Page Application (`index.html`)

The entire UI lives in one HTML file. Sections are toggled via **CSS class switching** (`active` on `.tab-panel` elements). No routing library — tab state is managed by `switchTab(tabId)` in JavaScript.

**Tab structure:**
- Top-level tabs: Adventure Sheet, Ship's Manifest, Codewords, Books (dropdown), Notes, Maps (dropdown)
- Dropdown menus for Books and Maps use click-outside detection to close

#### Client-Side Logic (`script.js`)

The JavaScript is organized into functional modules within a single file:

| Module | Responsibility |
|---|---|
| **Preference I/O** | `lirePreference()`, `ecrirePreference()`, `chargerToutesLesPreferences()`, `ecrireToutesLesPreferences()` — abstracted read/write that routes to localStorage or PHP API |
| **User UI** | `mettreAJourUIUtilisateur()`, menu open/close handlers — manages avatar display and dropdown menus |
| **Form Auto-Save** | Binds `input`/`change` events on all `[data-key]` elements with debounced writes (400–500ms) |
| **Codewords** | Dynamically generates 408 codeword checkboxes from a hardcoded array |
| **Book Paragraphs** | `genererParagraphes()` builds paragraph tables + note panels from `bookData` object; paragraphs are grouped by note boundaries |
| **Ship Table** | `genererShipTable()`, `creerLigneShip()` — dynamic row creation with strike/delete/add actions |
| **Map Interaction** | Touch-aware pinch-to-zoom and drag panning for fullscreen maps |
| **Import/Export** | `exporterDonnees()` creates a timestamped JSON blob; import validates format before overwriting |
| **PHP Detection** | `detecterPhp()` probes `api/auth.php?action=check` on load to determine backend availability |

**Data key convention:** All stored values use the `fl-` prefix (e.g. `fl-adventure-name`, `fl-codeword-42`, `fl-book1-10-c0`). Keys are collected in the `ALL_KEYS` array at page load for bulk operations.

#### Styling

Two CSS files share the same design system:

- **`style.css`** — Main app styles: tab bar, forms, ship table, codewords grid, book paragraph tables, map viewer, toast notifications
- **`style-auth.css`** — Auth card pages (login, register, change password)

**Design tokens** (CSS custom properties):
```css
--ink: #171717      /* Dark text/backgrounds */
--paper: #f1eee8    /* Page background */
--muted: #706d68    /* Secondary text */
--line: #d7d1c8     /* Borders */
--red: #e23b2e      /* Primary accent */
--yellow: #f2bd3d   /* Highlight/shadow accent */
--white: #fffdf8    /* Card/field background */
```

**Typography:**
- Headings: **Barlow Condensed** (bold, uppercase)
- Body: **Space Grotesk**
- Icons: **Font Awesome 6.5.2** (CDN)

**Responsive behavior:** Mobile breakpoint at 600px collapses triple/double form grids to single column, reduces font sizes, and stacks book paragraph panels vertically.

### Backend

#### Server Requirements

- PHP 8.2+ with `curl` and `sqlite3` extensions
- Apache or Nginx with PHP-FPM
- Write permissions on `api/` directory (for SQLite database creation)

#### API Endpoint (`api/auth.php`)

A single entry point using query parameter routing (`?action=<action>`). All responses are JSON.

| Action | Method | Auth Required | Description |
|---|---|---|---|
| `check` | GET | No | Returns login status and pseudo |
| `register` | POST | No | Creates account (pseudo + password, bcrypt cost 12) |
| `login` | POST | No | Authenticates user, starts session |
| `logout` | POST | Yes | Destroys session |
| `change_password` | POST | Yes | Updates password after verifying old one |
| `delete_account` | POST | Yes | Deletes user + all preferences (requires password) |
| `get_preferences` | GET | Yes | Returns all preferences, or a single one if `&key=` is provided |
| `set_preferences` | POST | Yes | Upserts a single key-value preference |
| `set_all_preferences` | POST | Yes | Bulk upsert (used by import) |
| `delete_preference` | POST | Yes | Deletes a single preference key |

**Anti-abstraction on register:** Honeypot field (`website`) + minimum form time (3 seconds).

#### Database Layer (`api/db.php`)

Uses PHP's built-in **SQLite3** extension with WAL journal mode.

**Schema:**

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pseudo TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    last_activity_at TEXT DEFAULT NULL
);

CREATE TABLE preferences (
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (user_id, key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Helper functions:**
- `getDB()` — Opens/creates DB, runs migrations, returns handle
- `getUserFromSession()` — Reads `$_SESSION['user_id']` and fetches user
- `requireLogin()` — Enforces authentication (returns 401 JSON error if not logged in)
- `touchLastActivity()` — Throttled update of `last_activity_at` (max once per 5 minutes)
- `jsonResponse()` / `jsonError()` — Standardized JSON output

The database file `api/preferences.db` is gitignored and created automatically on first request.

### Data Flow

```
┌─────────────────────────────────────────────────┐
│  Browser (index.html + script.js)               │
│                                                  │
│  [data-key] inputs ──change──► ecrirePreference()│
│                                    │             │
│                          ┌─────────┴──────────┐  │
│                          │ logged in?          │  │
│                          │  YES  →  PHP API    │  │
│                          │  NO   →  localStorage│ │
│                          └─────────┬──────────┘  │
│                                    │             │
│  on load ◄── chargerFormulaire()  │             │
│          ◄── chargerCheckboxes()   │             │
│          ◄── chargerShipTable()    │             │
└─────────────────────────────────────────────────┘
                          │
                    POST/GET fetch()
                          │
                          ▼
┌─────────────────────────────────────────────────┐
│  PHP Backend (api/auth.php)                     │
│                                                  │
│  action router ──► SQLite3 (preferences.db)     │
│                    users + preferences tables    │
└─────────────────────────────────────────────────┘
```

### Import/Export Format

```json
{
  "format": "fl-local-storage",
  "version": 1,
  "exportedAt": "2026-09-08T12:00:00.000Z",
  "data": {
    "fl-adventure-name": "Roland",
    "fl-adventure-combat": "8",
    "fl-codeword-42": "1",
    "...": "..."
  }
}
```

### Key Design Decisions

1. **No framework** — Keeps the project lightweight and dependency-free. The entire app runs from static files + a single PHP API.
2. **Dual persistence** — localStorage for offline/anonymous use, SQLite for multi-device sync. The preference abstraction layer makes this seamless.
3. **Procedural JS** — No modules, no bundler. All functions are global, organized by domain in the single `script.js` file.
4. **CSS-only tab switching** — No router. The `active` class toggles panel visibility. Browser back button is not used.
5. **Debounced auto-save** — Text inputs save after 400–500ms of inactivity to avoid excessive API calls while keeping data safe.
6. **Server-agnostic** — The frontend works without PHP (anonymous mode). The backend is optional and detected at startup.
