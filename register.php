<?php
session_start();
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
require_once __DIR__ . '/api/db.php';
$db = getDB();
$user = getUserFromSession($db);
if ($user) { header('Location: index.html'); exit; }
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Créer un compte – Fabled Lands Companion</title>
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
    <link rel="stylesheet" href="style-auth.css">
</head>
<body>
    <div class="auth-wrapper">
        <div class="back-link"><a href="index.html"><i class="fa-solid fa-arrow-left"></i> Retour au site</a></div>
        <div class="auth-card">
        <h1><i class="fa-solid fa-scroll" style="color:var(--red);transform:rotate(-12deg);margin-right:.4rem"></i> Créer un compte</h1>
        <p class="subtitle">Fabled Lands Companion</p>
        <div class="error" id="errorMsg"></div>
        <form id="registerForm">
            <label for="pseudo">Pseudo</label>
            <input type="text" id="pseudo" name="pseudo" autocomplete="username" required minlength="3" maxlength="20" pattern="[a-zA-Z0-9_\-]+" title="Lettres, chiffres, tirets (-) et underscores (_) uniquement" placeholder="3 à 20 caractères">
            <small class="field-hint">Lettres, chiffres, tirets et underscores uniquement</small>
            <label for="password">Mot de passe</label>
            <input type="password" id="password" name="password" autocomplete="new-password" required minlength="6" placeholder="Au moins 6 caractères">
            <label for="passwordConfirm">Confirmer le mot de passe</label>
            <input type="password" id="passwordConfirm" name="passwordConfirm" autocomplete="new-password" required minlength="6">
            <div style="position:absolute;left:-9999px" aria-hidden="true"><input type="text" name="website" tabindex="-1" autocomplete="off"></div>
            <input type="hidden" name="form_ts" value="<?= time() ?>">
            <button type="submit" class="btn">Créer mon compte</button>
        </form>
        <p class="link">Déjà un compte ? <a href="login.php">Se connecter</a></p>
        <p class="warning-text"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Retenez bien votre mot de passe. Il ne sera pas possible de le réinitialiser si vous l'oubliez.</p>
    </div>
    </div>
    <script>
    document.getElementById('registerForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const errorMsg = document.getElementById('errorMsg');
        errorMsg.classList.remove('visible');
        const pseudo = document.getElementById('pseudo').value.trim();
        const password = document.getElementById('password').value;
        const passwordConfirm = document.getElementById('passwordConfirm').value;
        const formTs = document.querySelector('[name="form_ts"]').value;
        const website = document.querySelector('[name="website"]').value;
        if (password !== passwordConfirm) {
            errorMsg.textContent = 'Les mots de passe ne correspondent pas.';
            errorMsg.classList.add('visible');
            return;
        }
        try {
            const res = await fetch('api/auth.php?action=register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pseudo, password, form_ts: formTs, website })
            });
            const data = await res.json();
            if (data.error) {
                errorMsg.textContent = data.error;
                errorMsg.classList.add('visible');
                return;
            }
            window.location.href = 'index.html';
        } catch (err) {
            errorMsg.textContent = 'Erreur de connexion au serveur.';
            errorMsg.classList.add('visible');
        }
    });
    </script>
</body>
</html>
