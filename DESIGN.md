---
version: alpha
name: home-features-design
description: Une console d'administration de feature flags construite sur la même méthode que le design.md Nike de référence (contraste typographique fort, grille 8px, palette quasi-monochrome avec accents sémantiques rares), alignée sur home-budget et home-auth pour les tokens, et sur home-remote-mcps pour le thème sombre. Ici le "photography-first" de Nike disparaît : l'interface est un outil dense, sobre et lisible, où le seul élément expressif est le wordmark FEATURES.
colors: |
  | primary | on-primary | surface | canvas | soft-cloud | ink | mute | hairline | hairline-soft | success | warning | error |
  | ------- | ---------- | ------- | ------ | ---------- | --- | ---- | -------- | ------------- | ------- | ------- | ----- |
  | #111111 | #ffffff | #fdf8f8 | #ffffff | #f5f5f5 | #111111 | #707072 | #cacacb | #e5e5e5 | #007d48 | #a15c00 | #ba1a1a |
colors-dark: |
  | primary | on-primary | surface | canvas | soft-cloud | ink | mute | hairline | hairline-soft | success | warning | error |
  | ------- | ---------- | ------- | ------ | ---------- | --- | ---- | -------- | ------------- | ------- | ------- | ----- |
  | #f2f2f0 | #111111 | #101012 | #1c1c1e | #26262a | #f2f2f0 | #9a9a9e | #3a3a3d | #2a2a2c | #34d399 | #fbbf24 | #f87171 |
typography: |
  | display-campaign | heading-xl | heading-lg | heading-md | body-md | body-sm | button-md | label-caps | code |
  | ---------------- | ---------- | ---------- | ---------- | ------- | ------- | --------- | ---------- | ---- |
  | fontFamily: Anton, fontSize: 56px (login) / 26px (wordmark), fontWeight: 500, lineHeight: 0.9, textTransform: uppercase, letterSpacing: -0.05em |
  | fontFamily: Inter, fontSize: 32px, fontWeight: 700, lineHeight: 1.2 |
  | fontFamily: Inter, fontSize: 24px, fontWeight: 600, lineHeight: 1.2 |
  | fontFamily: Inter, fontSize: 18px, fontWeight: 600, lineHeight: 1.5 |
  | fontFamily: Inter, fontSize: 16px, fontWeight: 400, lineHeight: 1.5 |
  | fontFamily: Inter, fontSize: 14px, fontWeight: 400, lineHeight: 1.4 |
  | fontFamily: Inter, fontSize: 16px, fontWeight: 600, lineHeight: 1.5 |
  | fontFamily: Inter, fontSize: 12px, fontWeight: 700, lineHeight: 1.2, letterSpacing: 0.05em, textTransform: uppercase |
  | fontFamily: ui-monospace, fontSize: 13px, fontWeight: 400 (clés de flag, clés de config, clé API) |
rounded: |
  | sm | DEFAULT | lg | full |
  | -- | ------- | -- | ---- |
  | 0.25rem (non utilisé) | 1rem | 2rem | 9999px |
spacing: |
  | xs | sm | md | lg | gutter | xl | section |
  | -- | -- | -- | -- | ------ | -- | ------- |
  | 4px | 8px | 12px | 18px | 16px | 24px | 48px |
components: |
  page-header, user-menu, button-primary, action-link, action-danger, text-input, select,
  card, app-card, data-table, flag-toggle, scope-pill, environment-chip, secret-banner,
  history-panel, dialog, confirm-dialog, menu-button, toast, text-field, app-tabs, flag-row,
  switch, badge, filter-chip, empty-state
---

## Overview

`home-features` (Features) est une console d'administration :
on y gère des apps, leurs environnements, leurs feature flags, leurs configs et
leurs clés d'API. Elle applique la discipline du design.md Nike pris comme
référence méthodologique (le même que `home-jdr/DESIGN.md`, `home-qrcode/DESIGN.md`
et `home-trainer/DESIGN.md`) : peu de tokens, un contraste typographique net entre
un tier d'affichage rarissime et un tier utilitaire dense, une géométrie de
composants restreinte, aucune décoration.

Elle partage ses tokens avec `home-budget` et `home-auth` (même source Stitch) :
`ink #111111`, `mute #707072`, `surface #fdf8f8`, `hairline`/`hairline-soft`,
rayon 1rem, boutons pilule, espacements 8/12/16/24/48, Inter pour tout le texte
et Anton pour le seul wordmark. Elle reprend de `home-budget` le vocabulaire de
classes partagé (`ui.ts` : `buttonPrimary`, `inputClass`,
`cardClass`, `labelClass`) et de `home-remote-mcps` la mécanique du thème sombre
(variables CSS + `darkMode: 'media'`).

**Règle directrice :** la couleur "vivante" est réservée aux signaux
sémantiques (danger, exposition navigateur). Tout le reste est encre sur papier.

**Caractéristiques clés :**

- Un seul tier d'affichage : le wordmark `FEATURES` (Anton, majuscules), dans la
  barre d'en-tête (26px) et sur l'écran de connexion (56px). Jamais ailleurs.
- Titres Inter 700/600 : `heading-xl` pour le titre de page, `heading-md` pour
  le titre de carte. Aucun palier intermédiaire.
- Palette quasi-monochrome ; `{colors.error}` pour les actions destructives,
  `{colors.warning}` pour la portée `web` (clé visible depuis un navigateur).
  `{colors.success}` est défini mais réservé (non utilisé par l'écran actuel).
- Thème clair et sombre automatique (`prefers-color-scheme`), mêmes tokens
  sémantiques, ordre d'élévation identique : `surface` = page, `canvas` = carte.
- Tableaux denses, `label-caps` en en-tête, séparateurs `hairline-soft` sans
  zébrage ; les clés techniques passent en monospace.

## Colors

| Token           | Clair   | Sombre  | Usage                                                      |
| --------------- | ------- | ------- | ---------------------------------------------------------- |
| `ink`           | #111111 | #f2f2f0 | Texte primaire, bouton primaire, interrupteur actif, focus |
| `on-primary`    | #ffffff | #111111 | Texte sur `ink`                                            |
| `surface`       | #fdf8f8 | #101012 | Fond de page, curseur d'interrupteur actif                 |
| `canvas`        | #ffffff | #1c1c1e | Cartes, en-tête, champs de saisie                          |
| `soft-cloud`    | #f5f5f5 | #26262a | Survol, panneau d'historique, fond de clé affichée         |
| `mute`          | #707072 | #9a9a9e | Texte secondaire, interrupteur inactif, placeholders       |
| `hairline`      | #cacacb | #3a3a3d | Bordure de champ, en-tête de tableau, pilule               |
| `hairline-soft` | #e5e5e5 | #2a2a2c | Séparateurs de lignes, contour de carte                    |
| `error`         | #ba1a1a | #f87171 | Suppression, révocation, erreurs                           |
| `warning`       | #a15c00 | #fbbf24 | Portée `web`                                               |
| `success`       | #007d48 | #34d399 | Réservé                                                    |

Contrastes vérifiés : `ink` sur `surface`/`canvas` > 15:1 ; `mute` sur
`canvas` ≥ 4,8:1 clair et ≥ 6:1 sombre ; `error` sur `canvas` ≥ 5:1 dans les
deux thèmes. L'interrupteur inactif utilise `mute` (≥ 3:1 contre le fond) pour
rester lisible comme composant d'interface.

## Typography

| Token              | Taille      | Poids   | Usage                                                       |
| ------------------ | ----------- | ------- | ----------------------------------------------------------- |
| `display-campaign` | 56px / 26px | 500     | Wordmark `FEATURES` (connexion / en-tête)                   |
| `heading-xl`       | 32px        | 700     | Titre de page ("Apps", nom de l'app)                        |
| `heading-md`       | 18px        | 600     | Titre de carte ("Feature flags", "API keys")                |
| `body-md`          | 16px        | 400/600 | Nom de flag, d'app, de clé (600 pour la ligne principale)   |
| `body-sm`          | 14px        | 400     | Métadonnées : slug, dernière évaluation, e-mail             |
| `button-md`        | 16px        | 600     | Boutons                                                     |
| `label-caps`       | 12px        | 700     | En-têtes de tableau, actions de ligne, compteurs, pilules   |
| `code`             | 13px mono   | 400     | Clés de flag/config, en-tête `Authorization`, clé API créée |

Les champs de saisie restent à 16px minimum (pas de zoom iOS au focus).

## Layout

- Grille 8px, tokens `xs` 4 / `sm` 8 / `md` 12 / `gutter` 16 / `xl` 24 / `section` 48.
- Contenu centré, `max-w-5xl` (1024px), marges latérales 20px mobile, 40px dès `md`.
- Barre d'application compacte et collante (`canvas`, filet `hairline-soft`,
  56px + zone de statut iOS via `safe-area-inset-top`) : wordmark à gauche, menu
  utilisateur à droite. L'e-mail et "Log out" vivent dans ce menu, jamais dans la
  barre.
- Chaque domaine (environnements, flags, configs, clés d'API) est une **carte**
  empilée verticalement ; titre `heading-md`, compteur `label-caps` à droite, puis
  contenu, puis le formulaire d'ajout en pied de carte.
- Formulaires en ligne : champs `flex-wrap` qui se replient en colonne sous 640px.
- Tableaux dans un conteneur `overflow-x-auto` : jamais de défilement horizontal
  de la page ; la première colonne garde 10rem minimum.

## Elevation & Depth

Plat. Une carte est un `canvas` cerné d'un filet de 1px `hairline-soft` (box-shadow
de contour, comme `home-budget`), sans ombre portée. Les recouvrements sont
limités à : le panneau du menu (filet `hairline`), la feuille/dialogue modal
(`canvas` sur un voile noir à 50 %, le seul usage d'une couleur hors tokens, faute
de token de voile), les toasts (pilule `ink`) et la bannière de clé fraîchement
créée (bordure 2px `ink`).

## Shapes

| Élément                                                | Rayon            |
| ------------------------------------------------------ | ---------------- |
| Cartes, champs, panneau d'historique                   | `DEFAULT` (1rem) |
| Boutons, pilules, puces d'environnement, interrupteurs | `full`           |

## Components

- **`page-header`** : voir Layout. Le wordmark est un lien vers `/`.
- **`user-menu`** : bouton rond 44px (initiale de l'utilisateur) qui ouvre un
  panneau de disclosure (`aria-expanded`, `aria-controls`) : e-mail en `mute` puis
  "Log out". Se ferme avec Échap (le focus revient au bouton), un clic extérieur
  ou en sortant du panneau au clavier. Panneau `canvas` cerné d'un filet
  `hairline`, sans ombre.
- **`button-primary`** : fond `ink`, texte `on-primary`, pilule, 44px de haut
  minimum, survol à 85% d'opacité. Une action principale par formulaire.
- **`action-link`** : `label-caps` souligné en `mute` (zone 44px), actions de ligne
  neutres ("History", `aria-expanded` quand le panneau est ouvert).
- **`action-danger`** : même forme en `error` ("Delete", "Revoke"), avec un
  `aria-label` qui nomme la cible.
- **`text-input` / `select`** : 44px, bordure `hairline`, fond `canvas`, rayon
  1rem. Chaque champ a un `aria-label` (les placeholders ne sont pas des labels).
  Dans un tableau, variante dense 40px.
- **`card`** : `canvas`, filet `hairline-soft`, padding 16px (24px dès `md`).
- **`data-table`** : en-tête `label-caps` `mute` sur filet `hairline`, lignes
  séparées par `hairline-soft`, cellules `py-md`, nombres et dates en
  `tabular-nums`.
- **`app-card`** : carte cliquable (nom `body-md` 600, description ou slug distinct du
  nom, métadonnées `body-sm` : nombre d'environnements, de flags, dernier
  changement) suivie d'un menu "⋯" ; aucune action destructive visible.
- **`dialog`** : `<dialog>` natif modal ; feuille en bas d'écran sous 640px, carte
  centrée au-delà ; titre `heading-md`, description `body-sm`, bouton de
  fermeture 44px ; le focus initial va au premier champ (`data-autofocus`).
- **`confirm-dialog`** : `dialog` pour une action sensible ; bouton `button-danger`
  (fond `error`), saisie obligatoire de l'identifiant quand `typeToConfirm` est
  fourni, erreur serveur affichée dans le dialogue.
- **`menu-button`** : bouton "⋯" 44px ouvrant un panneau de disclosure d'actions
  (même comportement clavier que `user-menu`).
- **`toast`** : retour d'action en pilule `ink`, zone `aria-live="polite"` toujours
  montée, 4 s (8 s pour une erreur, bordure `error`).
- **`text-field`** : libellé visible `label-caps`, champ, aide `body-sm` liée par
  `aria-describedby` (ex. clé dérivée du nom, affichée en direct).
- **`app-tabs`** : navigation par onglets de la page d'une app (Flags, Configs,
  Environments, API keys) ; onglet actif souligné en `ink` (2px), compteur
  `label-caps`, défilement horizontal sur mobile, 44px de haut. "Flags" reste actif
  sur la page d'un flag.
- **`flag-row`** : une carte par flag sur mobile (nom + clé en monospace, un
  `switch` étiqueté par environnement, badges d'état) ; une ligne de grille dès
  `md` avec un en-tête de colonnes par environnement (les libellés des switches
  deviennent `sr-only`). Le nom n'est pas répété quand il égale la clé.
- **`switch`** : `flag-toggle` + libellé (visible en ligne sur mobile). Optimiste :
  le switch bascule aussitôt, un toast confirme, un échec annule et affiche une
  erreur. Aucune confirmation pour un basculement (rapide mais réversible).
- **`badge`** : pilule `label-caps` ; `neutral` (état d'évaluation), `warning`
  (client-visible), `solid`.
- **`filter-chip`** : pilule 44px `aria-pressed` ; active = fond `ink`.
- **`empty-state`** : carte avec titre, explication et action principale (aucun
  environnement, aucun flag, aucune app).
- **`flag-toggle`** : case à cocher native (`role="switch"`), 44x24px, piste
  `mute` éteinte / `ink` allumée, curseur `canvas` / `surface`. Clavier et lecteurs
  d'écran conservés ; `aria-label` "<flag> in <environnement>".
- **`scope-pill`** : `label-caps` en pilule ; `server` neutre (`ink` sur
  `hairline`), `web` en `warning`.
- **`environment-chip`** : pilule `hairline` avec bouton de suppression rond
  (`aria-label` "Delete environment <nom>").
- **`secret-banner`** : bordure 2px `ink`, clé en monospace sur `soft-cloud`,
  bouton "Copy" ; `role="status"`.
- **`history-panel`** : bloc `soft-cloud` sous la ligne du flag, entrées en
  `body-sm` `mute`.

## Do's and Don'ts

### Do

- Réutiliser les classes de `presentation/ui.ts` avant d'en écrire de nouvelles.
- Passer par les tokens sémantiques (`bg-canvas`, `text-mute`, `border-hairline`),
  jamais par une valeur hexadécimale : c'est ce qui fait fonctionner le thème sombre.
- Mettre un `aria-label` sur tout champ sans libellé visible.
- Garder les cibles tactiles à 44px minimum, sauf deux exceptions assumées : l'éditeur de valeur en tableau (40px) et l'interrupteur (44x24px, conforme WCAG 2.5.8 niveau AA, 24px).

### Don't

- Ne pas utiliser `display-campaign` hors wordmark.
- Ne pas ajouter d'ombre portée ni de dégradé (`hero-gradient` a été retiré).
- Ne pas utiliser `warning` ou `error` pour décorer : ils signalent respectivement
  une exposition navigateur et une action destructive.
- Ne pas introduire de bibliothèque de composants : Tailwind + `ui.ts` suffisent.
- Ne pas utiliser `opacity` Tailwind sur les couleurs sémantiques (`bg-ink/50`) :
  les variables CSS ne le permettent pas.

## Responsive Behavior

| Nom     | Largeur   | Changements clés                                           |
| ------- | --------- | ---------------------------------------------------------- |
| mobile  | < 640px   | Formulaires en colonne, tableaux défilants dans leur carte |
| tablet  | 640-767px | Formulaires en ligne                                       |
| desktop | 768px+    | Marges 40px, padding de carte 24px                         |

## Iteration Guide

1. Un nouveau composant s'exprime d'abord avec carte + tableau + pilule + action.
2. Une nouvelle couleur sémantique exige une variable CSS clair/sombre et une
   entrée dans `tailwind.config.js` ; vérifier le contraste dans les deux thèmes.
3. Toute nouvelle action destructive passe par `confirm-dialog` (jamais
   `window.confirm`), avec saisie de l'identifiant quand l'action est
   irréversible et large (app, flag actif).

## Known Gaps

- Migration en cours des confirmations natives vers `confirm-dialog` : les apps
  l'utilisent déjà, ainsi que les flags ; environnements, configs et clés d'API
  suivent dans la PR suivante de la pile.
- Pas de token de voile (`scrim`) pour le fond des dialogues.
- Pas de bascule manuelle clair/sombre : le thème suit le système, comme
  `home-remote-mcps`.
- `success` n'est pas encore utilisé (aucun état "réussi" persistant à l'écran).
