<?php
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);
session_start();
require_once __DIR__ . '/db.php';

header('X-Content-Type-Options: nosniff');
header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? $_POST['action'] ?? null;
if (!$action) jsonError('Action manquante');

try {
    $db = getDB();
} catch (Throwable $e) {
    jsonError('Erreur de connexion à la base de données : ' . $e->getMessage(), 500);
}

switch ($action) {

    case 'check':
        $user = getUserFromSession($db);
        if ($user) touchLastActivity($db, $user['id']);
        jsonResponse([
            'logged_in' => $user !== null,
            'pseudo' => $user ? $user['pseudo'] : null
        ]);

    case 'register':
        $input = json_decode(file_get_contents('php://input'), true);
        $pseudo = trim($input['pseudo'] ?? '');
        $password = $input['password'] ?? '';

        if (!empty($input['website'])) jsonError('Erreur de connexion au serveur.');
        $formTs = intval($input['form_ts'] ?? 0);
        if (!$formTs || time() - $formTs < 3) jsonError('Erreur de connexion au serveur.');

        $stmt = $db->prepare('SELECT id FROM users WHERE pseudo = :pseudo');
        $stmt->bindValue(':pseudo', $pseudo, SQLITE3_TEXT);
        $result = $stmt->execute();
        if ($result->fetchArray()) jsonError('Ce pseudo est déjà utilisé.');

        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        $stmt = $db->prepare('INSERT INTO users (pseudo, password_hash) VALUES (:pseudo, :hash)');
        $stmt->bindValue(':pseudo', $pseudo, SQLITE3_TEXT);
        $stmt->bindValue(':hash', $hash, SQLITE3_TEXT);
        $stmt->execute();

        $_SESSION['user_id'] = $db->lastInsertRowID();
        jsonResponse(['ok' => true, 'pseudo' => $pseudo]);

    case 'login':
        $input = json_decode(file_get_contents('php://input'), true);
        $pseudo = trim($input['pseudo'] ?? '');
        $password = $input['password'] ?? '';

        if (!$pseudo || !$password) jsonError('Pseudo et mot de passe requis.');

        $stmt = $db->prepare('SELECT id, password_hash FROM users WHERE pseudo = :pseudo');
        $stmt->bindValue(':pseudo', $pseudo, SQLITE3_TEXT);
        $result = $stmt->execute();
        $user = $result->fetchArray(SQLITE3_ASSOC);

        if (!$user || !password_verify($password, $user['password_hash']))
            jsonError('Pseudo ou mot de passe incorrect.');

        $_SESSION['user_id'] = $user['id'];
        jsonResponse(['ok' => true, 'pseudo' => $pseudo]);

    case 'logout':
        session_destroy();
        jsonResponse(['ok' => true]);

    case 'change_password':
        $user = requireLogin($db);
        $input = json_decode(file_get_contents('php://input'), true);
        $oldPassword = $input['old_password'] ?? '';
        $newPassword = $input['new_password'] ?? '';

        if (strlen($newPassword) < 6)
            jsonError('Le nouveau mot de passe doit contenir au moins 6 caractères.');

        $stmt = $db->prepare('SELECT password_hash FROM users WHERE id = :id');
        $stmt->bindValue(':id', $user['id'], SQLITE3_INTEGER);
        $result = $stmt->execute();
        $row = $result->fetchArray(SQLITE3_ASSOC);

        if (!password_verify($oldPassword, $row['password_hash']))
            jsonError('Le mot de passe actuel est incorrect.');

        $hash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);
        $stmt = $db->prepare('UPDATE users SET password_hash = :hash WHERE id = :id');
        $stmt->bindValue(':hash', $hash, SQLITE3_TEXT);
        $stmt->bindValue(':id', $user['id'], SQLITE3_INTEGER);
        $stmt->execute();

        jsonResponse(['ok' => true]);

    case 'delete_account':
        $user = requireLogin($db);
        $input = json_decode(file_get_contents('php://input'), true);
        $password = $input['password'] ?? '';

        $stmt = $db->prepare('SELECT password_hash FROM users WHERE id = :id');
        $stmt->bindValue(':id', $user['id'], SQLITE3_INTEGER);
        $result = $stmt->execute();
        $row = $result->fetchArray(SQLITE3_ASSOC);

        if (!password_verify($password, $row['password_hash']))
            jsonError('Mot de passe incorrect.');

        $stmt = $db->prepare('DELETE FROM preferences WHERE user_id = :id');
        $stmt->bindValue(':id', $user['id'], SQLITE3_INTEGER);
        $stmt->execute();

        $stmt = $db->prepare('DELETE FROM users WHERE id = :id');
        $stmt->bindValue(':id', $user['id'], SQLITE3_INTEGER);
        $stmt->execute();

        session_destroy();
        jsonResponse(['ok' => true]);

    case 'get_preferences':
        $user = requireLogin($db);
        $key = $_GET['key'] ?? null;

        if ($key) {
            $stmt = $db->prepare('SELECT value FROM preferences WHERE user_id = :uid AND key = :key');
            $stmt->bindValue(':uid', $user['id'], SQLITE3_INTEGER);
            $stmt->bindValue(':key', $key, SQLITE3_TEXT);
            $result = $stmt->execute();
            $row = $result->fetchArray(SQLITE3_ASSOC);
            jsonResponse(['key' => $key, 'value' => $row ? $row['value'] : null]);
        }

        $stmt = $db->prepare('SELECT key, value FROM preferences WHERE user_id = :uid');
        $stmt->bindValue(':uid', $user['id'], SQLITE3_INTEGER);
        $result = $stmt->execute();
        $prefs = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $prefs[$row['key']] = $row['value'];
        }
        jsonResponse(['preferences' => $prefs]);

    case 'delete_preference':
        $user = requireLogin($db);
        $input = json_decode(file_get_contents('php://input'), true);
        $key = $input['key'] ?? null;
        if (!$key) jsonError('Clé requise.');
        $stmt = $db->prepare('DELETE FROM preferences WHERE user_id = :uid AND key = :key');
        $stmt->bindValue(':uid', $user['id'], SQLITE3_INTEGER);
        $stmt->bindValue(':key', $key, SQLITE3_TEXT);
        $stmt->execute();
        jsonResponse(['ok' => true]);

    case 'clear_preferences':
        $user = requireLogin($db);
        $stmt = $db->prepare('DELETE FROM preferences WHERE user_id = :uid');
        $stmt->bindValue(':uid', $user['id'], SQLITE3_INTEGER);
        $stmt->execute();
        jsonResponse(['ok' => true]);

    case 'set_preferences':
        $user = requireLogin($db);
        $input = json_decode(file_get_contents('php://input'), true);
        $key = $input['key'] ?? null;
        $value = $input['value'] ?? null;

        if (!$key || $value === null) jsonError('Clé et valeur requises.');

        $stmt = $db->prepare('INSERT INTO preferences (user_id, key, value) VALUES (:uid, :key, :value) ON CONFLICT(user_id, key) DO UPDATE SET value = :value2');
        $stmt->bindValue(':uid', $user['id'], SQLITE3_INTEGER);
        $stmt->bindValue(':key', $key, SQLITE3_TEXT);
        $stmt->bindValue(':value', $value, SQLITE3_TEXT);
        $stmt->bindValue(':value2', $value, SQLITE3_TEXT);
        $stmt->execute();

        jsonResponse(['ok' => true]);

    case 'set_all_preferences':
        $user = requireLogin($db);
        $input = json_decode(file_get_contents('php://input'), true);
        $prefs = $input['preferences'] ?? null;

        if (!$prefs || !is_array($prefs)) jsonError('Préférences requises.');

        $db->exec('BEGIN');
        $stmt = $db->prepare('INSERT INTO preferences (user_id, key, value) VALUES (:uid, :key, :value) ON CONFLICT(user_id, key) DO UPDATE SET value = :value2');
        foreach ($prefs as $key => $value) {
            $stmt->bindValue(':uid', $user['id'], SQLITE3_INTEGER);
            $stmt->bindValue(':key', (string)$key, SQLITE3_TEXT);
            $stmt->bindValue(':value', (string)$value, SQLITE3_TEXT);
            $stmt->bindValue(':value2', (string)$value, SQLITE3_TEXT);
            $stmt->execute();
        }
        $db->exec('COMMIT');

        jsonResponse(['ok' => true]);

    default:
        jsonError('Action inconnue.');
}
