<?php
session_start();
require_once __DIR__ . '/api/db.php';
$db = getDB();
$user = getUserFromSession($db);
if (!$user) { header('Location: login.php'); exit; }
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Modifier le mot de passe – Fabled Lands Companion</title>
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
    <link rel="stylesheet" href="style-auth.css">
</head>
<body>
    <div class="auth-card">
        <h1><i class="fa-solid fa-scroll" style="color:var(--red);transform:rotate(-12deg);margin-right:.4rem"></i> Modifier le mot de passe</h1>
        <p class="subtitle">Connecté en tant que <strong><?= htmlspecialchars($user['pseudo']) ?></strong></p>
        <div class="error" id="errorMsg"></div>
        <div class="success" id="successMsg"></div>
        <form id="changeForm">
            <label for="oldPassword">Mot de passe actuel</label>
            <input type="password" id="oldPassword" name="oldPassword" autocomplete="current-password" required>
            <label for="newPassword">Nouveau mot de passe</label>
            <input type="password" id="newPassword" name="newPassword" autocomplete="new-password" required minlength="6" placeholder="Au moins 6 caractères">
            <label for="confirmPassword">Confirmer le nouveau mot de passe</label>
            <input type="password" id="confirmPassword" name="confirmPassword" autocomplete="new-password" required>
            <button type="submit" class="btn">Modifier</button>
            <button type="button" class="btn btn-secondary" onclick="window.location.href='index.html'" style="margin-top:.5rem">Annuler</button>
        </form>
    </div>
    <script>
    document.getElementById('changeForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const errorMsg = document.getElementById('errorMsg');
        const successMsg = document.getElementById('successMsg');
        errorMsg.classList.remove('visible');
        successMsg.classList.remove('visible');
        const old_password = document.getElementById('oldPassword').value;
        const new_password = document.getElementById('newPassword').value;
        const confirm = document.getElementById('confirmPassword').value;
        if (new_password !== confirm) {
            errorMsg.textContent = 'Les mots de passe ne correspondent pas.';
            errorMsg.classList.add('visible');
            return;
        }
        try {
            const res = await fetch('api/auth.php?action=change_password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ old_password, new_password })
            });
            const data = await res.json();
            if (data.error) {
                errorMsg.textContent = data.error;
                errorMsg.classList.add('visible');
                return;
            }
            successMsg.textContent = 'Mot de passe modifié avec succès ! Redirection...';
            successMsg.classList.add('visible');
            setTimeout(() => window.location.href = 'index.html', 1500);
        } catch (err) {
            errorMsg.textContent = 'Erreur de connexion au serveur.';
            errorMsg.classList.add('visible');
        }
    });
    </script>
</body>
</html>
