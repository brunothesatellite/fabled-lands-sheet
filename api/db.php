<?php
define('DB_PATH', __DIR__ . '/preferences.db');

function getDB() {
    if (!class_exists('SQLite3')) {
        jsonError('SQLite3 extension not available on this server.', 500);
    }

    $db = @new SQLite3(DB_PATH);
    if (!$db) {
        jsonError('Cannot open the database. Check write permissions on the api/ folder.', 500);
    }

    $db->enableExceptions(true);

    $db->exec('PRAGMA journal_mode=WAL');
    $db->exec('PRAGMA foreign_keys=ON');

    $usersCreated = $db->exec('CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pseudo TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime(\'now\')),
        last_activity_at TEXT DEFAULT NULL
    )');

    $prefsCreated = $db->exec('CREATE TABLE IF NOT EXISTS preferences (
        user_id INTEGER NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (user_id, key),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )');

    if (!$usersCreated || !$prefsCreated) {
        jsonError('Cannot create tables. Check write permissions on preferences.db.', 500);
    }

    $colsResult = $db->query('PRAGMA table_info(users)');
    $hasLastActivity = false;
    while ($col = $colsResult->fetchArray(SQLITE3_ASSOC)) {
        if ($col['name'] === 'last_activity_at') { $hasLastActivity = true; break; }
    }
    if (!$hasLastActivity) {
        $db->exec('ALTER TABLE users ADD COLUMN last_activity_at TEXT DEFAULT NULL');
    }

    return $db;
}

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError($message, $code = 400) {
    jsonResponse(['error' => $message], $code);
}

function getUserFromSession($db) {
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (!isset($_SESSION['user_id'])) return null;
    $stmt = $db->prepare('SELECT id, pseudo FROM users WHERE id = :id');
    $stmt->bindValue(':id', $_SESSION['user_id'], SQLITE3_INTEGER);
    $result = $stmt->execute();
    $user = $result->fetchArray(SQLITE3_ASSOC);
    return $user ?: null;
}

function requireLogin($db) {
    $user = getUserFromSession($db);
    if (!$user) jsonError('Not authenticated', 401);
    touchLastActivity($db, $user['id']);
    return $user;
}

function touchLastActivity($db, $userId) {
    $_SESSION['last_activity'] = time();
    if (isset($_SESSION['last_activity_touched']) && time() - $_SESSION['last_activity_touched'] < 300) return;

    $stmt = $db->prepare('SELECT last_activity_at FROM users WHERE id = :id');
    $stmt->bindValue(':id', $userId, SQLITE3_INTEGER);
    $result = $stmt->execute();
    $row = $result->fetchArray(SQLITE3_ASSOC);

    if ($row && $row['last_activity_at']) {
        $last = strtotime($row['last_activity_at']);
        if (time() - $last < 300) { $_SESSION['last_activity_touched'] = time(); return; }
    }

    $now = gmdate('Y-m-d\TH:i:s\Z');
    $stmt = $db->prepare('UPDATE users SET last_activity_at = :now WHERE id = :id');
    $stmt->bindValue(':now', $now, SQLITE3_TEXT);
    $stmt->bindValue(':id', $userId, SQLITE3_INTEGER);
    $stmt->execute();
    $_SESSION['last_activity_touched'] = time();
}
