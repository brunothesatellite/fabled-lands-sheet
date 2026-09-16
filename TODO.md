**Priority**
Add "History" tab with all changes since page loaded (with time HH:MM:ss field value before -> after). Not persisted.
- je veux ajouter un nouvel onglet, tout à la fin des onglets déjà présents, intitulé "Log".
- en mode smartphone, cet onglet sera sur la deuxième ligne, dans la même colonne que "Ships"
- L'onglet "Log" contiendra une unique textarea, comme celle de l'onglet "Notes" mais readonly. On va appeler ce textarea logtxt dans la suite du prompt
- logtxt doit être mis à jour après chaque sauvegarde avec une nouvelle ligne commençant par l'horaire HH:MM:ss de la sauvegarde, ensuite le label HTML de l'élément sauvegardé, l'ancienne valeur et la nouvelle, par exemple "23:47:12 Codeword ARMOUR Unchecked => Checked" ou "17:34:56 Stamina 9 => 3"
- logtxt est effacé à chaque chargement de page et n'est pas persisté.
- fait un plan et donne un exemple de log pour 3 éléments au hasard de chaque onglet pour vérifier le plan. Ne code rien.