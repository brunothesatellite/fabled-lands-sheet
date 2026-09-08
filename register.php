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
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Create Account – Fabled Lands Companion</title>
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
    <link rel="stylesheet" href="style-auth.css">
</head>
<body>
    <div class="auth-wrapper">
        <div class="back-link"><a href="index.html"><i class="fa-solid fa-arrow-left"></i> Back to site</a></div>
        <div class="auth-card">
        <h1><i class="fa-solid fa-scroll" style="color:var(--red);transform:rotate(-12deg);margin-right:.4rem"></i> Create Account</h1>
        <p class="subtitle">Fabled Lands Companion</p>
        <div class="error" id="errorMsg"></div>
        <form id="registerForm">
            <label for="pseudo">Username</label>
            <input type="text" id="pseudo" name="pseudo" autocomplete="username" required minlength="3" maxlength="20" pattern="[a-zA-Z0-9_\-]+" title="Letters, digits, hyphens (-) and underscores (_) only" placeholder="3 to 20 characters">
            <small class="field-hint">Letters, digits, hyphens and underscores only</small>
            <label for="password">Password</label>
            <input type="password" id="password" name="password" autocomplete="new-password" required minlength="6" placeholder="At least 6 characters">
            <label for="passwordConfirm">Confirm password</label>
            <input type="password" id="passwordConfirm" name="passwordConfirm" autocomplete="new-password" required minlength="6">
            <div style="position:absolute;left:-9999px" aria-hidden="true"><input type="text" name="website" tabindex="-1" autocomplete="off"></div>
            <input type="hidden" name="form_ts" value="<?= time() ?>">
            <button type="submit" class="btn">Create my account</button>
        </form>
        <p class="link">Already have an account? <a href="login.php">Log in</a></p>
        <p class="warning-text"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Make sure to remember your password. It cannot be reset if you forget it.</p>
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
            errorMsg.textContent = 'The passwords do not match.';
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
            errorMsg.textContent = 'Server connection error.';
            errorMsg.classList.add('visible');
        }
    });
    </script>
</body>
</html>
