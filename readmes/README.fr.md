<a id="readme-top"></a>

# Claude Aura

<p align="center">
  <a href="../README.md">English</a> ·
  <a href="./README.zh-CN.md">简体中文</a> ·
  <a href="./README.zh-HKTW.md">繁體中文</a> ·
  <a href="./README.hi.md">हिन्दी</a> ·
  <a href="./README.es.md">Español</a> ·
  <strong>Français</strong> ·
  <a href="./README.id.md">Bahasa Indonesia</a> ·
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.ko.md">한국어</a> ·
  <a href="./README.pt-BR.md">Português (Brasil)</a> ·
  <a href="./README.de.md">Deutsch</a> ·
  <a href="./README.it.md">Italiano</a> ·
  <a href="./README.vi.md">Tiếng Việt</a> ·
  <a href="./README.pl.md">Polski</a> ·
  <a href="./README.tr.md">Türkçe</a>
</p>

<p align="center">
  <strong>Donnez au site Claude en direct un thème personnel et réversible sous Windows.</strong><br>
  Thèmes locaux · Pas de patching de Claude Desktop · Retour à l’apparence d’origine en un clic
</p>

<p align="center">
  <a href="#getting-started">Bien démarrer</a> ·
  <a href="#theme-showcase">Voir les thèmes</a> ·
  <a href="#create-a-custom-theme">Créer un thème</a> ·
  <a href="../docs/TROUBLESHOOTING.md">Dépannage</a> ·
  <a href="./SECURITY.md">Sécurité</a>
</p>

<p align="center">
  <img src="../docs/readme-showcase/japanese-film-editorial-dark-new-chat.png"
       alt="Japanese Film Editorial dark new-chat reference preview"
       width="900"><br>
  <sub>Sombre · Nouvelle conversation · démonstration de documentation fournie par les utilisateurs</sub>
</p>

<p align="center"><sub>Prévisualisation de référence · pas un fond de thème importable ni une preuve d’acceptation en direct</sub></p>

> **Independent project.** Claude Aura est un projet indépendant et n’est pas affilié,
> endossé, sponsorisé ou approuvé par Anthropic PBC. Aura affiche le site web en direct
> sur `claude.ai` ; il ne fournit pas Claude ni ne modifie les applications installées d’Anthropic.
> Claude, Anthropic et les noms/marque associés appartiennent à Anthropic PBC. La licence du
> projet ne donne aucun droit sur ces éléments.

<details>
<summary><strong>Public or commercial release trademark note</strong></summary>

> **Before public or commercial release:** Anthropic's current
> [Trademark Guidelines](https://www.anthropic.com/legal/trademark-guidelines)
> require prior approval for its names and marks and prohibit altered marks. A
> disclaimer is not permission. A release that keeps the **Claude Aura** name
> or theme-styled Claude wordmarks needs written permission and appropriate
> legal review.

</details>

<a id="contents"></a>
<details>
<summary><strong>Sommaire</strong></summary>

- [Claude Aura](#claude-aura)
  - [Pourquoi Aura](#why-aura)
  - [Bien démarrer](#quick-start)
    - [Prérequis](#requirements)
    - [Installation](#installation)
    - [Désinstaller](#uninstall)
  - [Présentation des thèmes](#theme-showcase)
    - [Japanese Film Editorial](#japanese-film-editorial)
    - [Japanese Idol](#japanese-idol)
    - [Korean Idol](#korean-idol)
  - [Utiliser Aura](#use-aura)
  - [Créer un thème personnalisé](#create-a-custom-theme)
  - [Comment fonctionne Aura](#how-aura-works)
  - [Sécurité et confidentialité](#safety-and-privacy)
  - [Feuille de route](#roadmap)
  - [Assistance et documentation](#support-and-documentation)
    - [Carte de la documentation](#documentation-map)
  - [Soutien caritatif](#charitable-support)
  - [Licence et mentions](#license-and-notices)
  - [Remerciements](#acknowledgments)

</details>
<a id="about-claude-aura"></a>
<a id="why-aura"></a>
## Pourquoi Aura

- **Utiliser le vrai site Claude.** Aura conserve l’interface réelle et les contrôles natifs au lieu de les remplacer par un écran reconstruit.
- **Gardez le changement local et réversible.** Il applique un style local sans patcher Claude Desktop, et **Original look** retire la couche de présentation d’Aura en un clic.
- **Commencez avec huit thèmes intégrés.** Chacun est une base personnalisable, stable et en lecture seule.
- **Créez des thèmes sans écraser les originaux.** Claude Aura Studio prend en charge couleurs locales, typographie, formes, effets et visuels.

Aura 0.3 thématise uniquement le site en direct pour le moment. Il ne thématise pas encore
Claude Desktop Code ni le terminal Claude Code, et le chat normal dans Aura n’obtient pas d’accès aux projets locaux. Avant la sortie finale, Aura Code doit valider une preuve bloquante de release avec une session officielle de
[Remote Control](https://code.claude.com/docs/en/remote-control) avec thème sur live
`claude.ai/code`; l’export terminal-theme correspondant couvre les environnements restreints sans patcher Claude Desktop.

<details>
<summary><strong>Capacités et exclusions complètes</strong></summary>

Claude Aura ouvre le site réel `claude.ai` dans une fenêtre dédiée Microsoft Edge
WebView2 et applique un thème visuel local. Il s’adresse aux personnes souhaitant
un espace plus personnalisé sans patcher Claude Desktop ni remplacer l’interface
live par une capture.

| Ce qu’Aura fait | Ce qu’Aura ne fait pas |
| --- | --- |
| Charge l’interface live `claude.ai` dans WebView2 | Remplacer Claude par une interface reconstruite |
| Applique un style local réversible | Patch Claude Desktop, `app.asar`, paquets Windows ou signatures de code |
| Fournit huit thèmes intégrés | Modifier les comptes, chats, clés API, modèles ou paramètres du fournisseur |
| Fournit Studio pour les thèmes personnalisés locaux | Se présenter comme produit Anthropic ou système de thèmes officiel |
| Offre **Original look** dans l’app | Supprimer les thèmes sauvegardés en désactivant le style |

</details>

<p align="right">(<a href="#readme-top">Retour en haut</a>)</p>
<a id="getting-started"></a>
## Bien démarrer

<a id="requirements"></a>
### Prérequis

- Windows 10 ou Windows 11
- Accès Internet et compte Claude
- [Node.js 22 ou supérieur](https://nodejs.org/en/download)
- [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

WebView2 est présent sur la plupart des PC Windows récents. Si Aura ne peut pas ouvrir
donc fenêtre navigateur, installez ou réparez Evergreen WebView2 Runtime puis réessayez.
Claude Desktop est optionnel et reste une application séparée.

<a id="installation"></a>
### Installation

1. Téléchargez la
   [dernière release ZIP](https://github.com/erichuang1425/claude-aura/releases).
2. Dans l’Explorateur de fichiers, faites clic droit sur le ZIP et sélectionnez **Extract All**.
3. Ouvrez le dossier extrait et double-cliquez **Install Claude Aura.cmd**.
4. Attendez la fermeture de l’installateur et l’ouverture de la fenêtre **Claude Aura**.
5. Connectez-vous dans Aura si `claude.ai` le demande.
6. Cliquez sur le bouton flottant Aura pour ouvrir Studio, puis choisissez **Themes**.

L’installation ne patch pas ni ne remplace Claude Desktop.

<details>
<summary><strong>Comportement de l’installeur, emplacement de l’application, checkouts de développeur et désinstallation</strong></summary>

L’installateur non élevé exécute ses contrôles intégrés, puis copie les
fichiers applicatifs dans :

```text
%LOCALAPPDATA%\ClaudeAura\app
```

Il crée des raccourcis **Claude Aura** et **Claude Aura Studio** sur le bureau
et dans le menu Démarrer. Les paramètres de thème et la session d’authentification
sont stockés séparément de l’application, donc réinstaller Aura ne les remplace
pas silencieusement.

Les développeurs peuvent cloner le dépôt à la place de télécharger un ZIP et lancer
le même installateur depuis le checkout. Un checkout exécute la suite complète
de tests avant l’installation.

<a id="uninstall"></a>
### Désinstaller

Faites d’abord clic droit sur le bouton flottant Aura et choisissez **Exit Claude Aura**.
Puis ouvrez **Start > Claude Aura > Uninstall Claude Aura**, ou faites un double clic
sur **Uninstall Claude Aura.cmd** dans une release extraite. Le désinstallateur refuse
de poursuivre tant qu’Aura est encore ouvert.

Par défaut, la désinstallation supprime l’application et les raccourcis Aura, mais conserve
les paramètres locaux de thème et le profil de session WebView séparé d’Aura pour une
réinstallation ultérieure. Le désinstallateur demande confirmation avant de supprimer
aussi ces dossiers. Cette suppression optionnelle retire la session locale de connexion
Aura ; elle ne supprime jamais Claude Desktop, le compte Anthropic de l’utilisateur
ou les données de compte côté serveur.

</details>
<p align="right">(<a href="#readme-top">Retour en haut</a>)</p>

<a id="theme-showcase"></a>
## Présentation des thèmes

Le système visuel d’Aura est montré ci-dessous via des références New chat et Conversation.
La prévisualisation Japanese Film Editorial en New chat apparaît en haut de ce README.

**Default · Japanese Film Editorial · Korean Prestige · Cartoon Studio · Anime Twilight · Study Library · Japanese Idol · Korean Idol**

<a id="japanese-film-editorial"></a>
### Japanese Film Editorial

Papier chaud, encre au charbon, indigo atténué et vermillon retenu.

<details>
<summary>Voir la vue Conversation</summary>

<p align="center">
  <img src="../docs/readme-showcase/japanese-film-editorial-dark-conversation.png"
       alt="Japanese Film Editorial dark conversation reference preview"
       width="900"><br>
  <sub>Sombre · Conversation · démonstration de documentation fournie par les utilisateurs</sub>
</p>

</details>

<a id="japanese-idol"></a>
### Japanese Idol

Crème chaude, blush, rose, lilas nacré et détails fins de rubans.

<p align="center">
  <img src="../docs/readme-showcase/japanese-idol-light-new-chat.png"
       alt="Japanese Idol light new-chat reference preview"
       width="900"><br>
  <sub>Clair · Nouvelle conversation · démonstration de documentation fournie par les utilisateurs</sub>
</p>

<details>
<summary>Voir la vue Conversation</summary>

<p align="center">
  <img src="../docs/readme-showcase/japanese-idol-light-conversation.png"
       alt="Japanese Idol light conversation reference preview"
       width="900"><br>
  <sub>Clair · Conversation · démonstration de documentation fournie par les utilisateurs</sub>
</p>

</details>

<a id="korean-idol"></a>
### Korean Idol

Blanc froid, bleu periwinkle, argent holographique et verre musical structuré.

<p align="center">
  <img src="../docs/readme-showcase/korean-idol-light-new-chat.png"
       alt="Korean Idol light new-chat reference preview"
       width="900"><br>
  <sub>Clair · Nouvelle conversation · démonstration de documentation fournie par les utilisateurs</sub>
</p>

<details>
<summary>Voir la vue Conversation</summary>

<p align="center">
  <img src="../docs/readme-showcase/korean-idol-light-conversation.png"
       alt="Korean Idol light conversation reference preview"
       width="900"><br>
  <sub>Clair · Conversation · démonstration de documentation fournie par les utilisateurs</sub>
</p>

</details>

<details>
<summary><strong>Statut de référence et limites de réutilisation</strong></summary>

> **Statut de référence :** ces images fournies par les utilisateurs indiquent la
dirigé visuel visé. Elles peuvent contenir du contenu d’interface illustratif et ne
constituent pas une preuve d’acceptation en direct ni la preuve du comportement
actuel de `claude.ai`. Ce ne sont pas des fonds de thème, ne doivent pas être importées
dans Aura et sont exclues des installateurs de release.
>
> Les prévisualisations peuvent inclure une UI tierce, des noms/marques et des portraits
automatiques. Leur présence ne confère aucun droit de réutilisation. Vérifiez les
 droits applicables pour l’interface, la marque, les visuels et les ressemblances
humanes avant toute publication ou redistribution.

</details>

<a id="built-in-themes"></a>
<details>
<summary><strong>Tous les thèmes intégrés et les IDs stables</strong></summary>

Aura inclut huit thèmes intégrés dans un ordre stable :

| # | Theme | Stable ID |
| ---: | --- | --- |
| 1 | Default | `default` |
| 2 | Japanese Film Editorial | `japanese-film-editorial` |
| 3 | Korean Prestige | `korean-prestige` |
| 4 | Cartoon Studio | `cartoon-studio` |
| 5 | Anime Twilight | `anime-twilight` |
| 6 | Study Library | `study-library` |
| 7 | Japanese Idol | `japanese-idol` |
| 8 | Korean Idol | `korean-idol` |

Les thèmes intégrés sont en lecture seule. Studio crée une copie modifiable quand vous
souhaitez personnaliser l’un d’eux.

</details>

<p align="right">(<a href="#readme-top">Retour en haut</a>)</p>
<a id="use-aura"></a>
## Utiliser Aura

| Action | Ce que cela fait |
| --- | --- |
| Cliquez sur le bouton flottant Aura | Ouvre Claude Aura Studio |
| **Themes** | Ouvre la galerie intégrée et enregistre le thème sélectionné |
| **Create a theme** | Crée ou modifie un thème personnalisé propre à Aura |
| **Personal wallpaper > Choose wallpaper*** | Sélectionne une image locale distincte du thème actif |
| **Clear wallpaper** | Arrête l’usage du fond sans supprimer son fichier source |
| **Original look** | Supprime la couche de présentation Aura et affiche le site live sans le thème choisi |
| **Apply theme** | Restaure le thème Aura sauvegardé après Original look |
| **Open desktop app** | Ouvre Claude Desktop sans le modifier |

Le thème sélectionné persiste entre redémarrages d’Aura. **Original look** désactive
la couche de présentation d’Aura ; il ne supprime ni les thèmes sauvegardés ni le
contenu graphique personnalisé. **Default** est le premier thème intégré d’Aura ; ce
n’est pas Original look.

Le lanceur flottant Aura reste un contrôle circulaire compact. Cliquez-le pour ouvrir
Studio, faites-le glisser pour le déplacer ou clic droit pour ouvrir le menu Aura.

Le wallpaper personnel reste lié au chemin image d’origine. Déplacer ou supprimer ce fichier rend le wallpaper indisponible. L’art importé via l’éditeur suit un autre chemin : Studio copie ou convertit
celui-ci dans les dossiers de thème propres à Aura.

<p align="right">(<a href="#readme-top">Retour en haut</a>)</p>

<a id="create-a-custom-theme"></a>
## Créer un thème personnalisé

1. Ouvrez **Claude Aura Studio** depuis le Bureau ou le menu Démarrer.
2. Ouvrez **Create a theme** et sélectionnez **Customize Default**, ou ouvrez **Themes**,
   choisissez un intégré, puis **Duplicate to customize**.
3. Ajustez les couleurs Light et Dark, la typographie, les formes, les effets et l’art local.
4. Vérifiez les mises en page New chat et Conversation dans l’aperçu Studio.
5. Résolvez les avertissements de contraste ou de taille de fichier.
6. Sélectionnez **Save theme**.

Les fichiers intégrés ne sont jamais écrasés. Si un brouillon devient invalide, il reste
éditable tandis qu’Aura continue d’afficher la dernière version valide.

Les visuels PNG, JPEG, WebP ou AVIF importés sont convertis localement en assets WebP
plafonnés. Studio ne stocke pas le chemin source dans le thème. Voir la
[Theme Kit Specification](../docs/THEME_KIT_SPEC.md) pour l’éditeur complet et le contrat de thème.

Quand disponible, Studio peut utiliser une capture de la vraie fenêtre Aura comme fond
d’édition. Cette capture peut contenir du contenu de conversation, reste en mémoire
afin de la session d’édition courante et n’est jamais écrite sur disque.

<p align="right">(<a href="#readme-top">Retour en haut</a>)</p>

<a id="built-with"></a>
<a id="how-aura-works"></a>
## Comment fonctionne Aura

| Partie | Rôle |
| --- | --- |
| Windows PowerShell et WinForms | Installateur, fenêtre Aura, Studio, raccourcis et commandes locales |
| Microsoft Edge WebView2 | Affiche le vrai site `claude.ai` |
| Node.js 22+ | Valide les thèmes et construit le style local |
| HTML, CSS, JavaScript, SVG et WebP locaux | Fournit les styles d’Aura et les ressources intégrées |

Le projet ne possède pas de dépendance npm runtime ni de police distante.

<p align="right">(<a href="#readme-top">Retour en haut</a>)</p>

<a id="safety-and-privacy"></a>
## Sécurité et confidentialité

- Aura charge le vrai site HTTPS `claude.ai` dans Microsoft Edge WebView2.
- Les pages de connexion du fournisseur ne sont pas thématisées.
- Aura n’ouvre pas de port de remote-debugging ni ne patch Claude Desktop.
- Les fichiers de thème et le visuel importé restent dans les dossiers locaux appartenant à Aura.
- La page live continue de se connecter à Anthropic normalement.
- Le profil WebView contient la session de connexion et doit être protégé.
- Les captures de page en direct de Studio restent en mémoire pendant la session d’édition
  et ne sont pas enregistrées sur disque.
- Ne choisissez pas d’arrière-plan sensible ; la page live peut techniquement accéder
  aux données DOM dans son propre processus.
- L’usage du service live reste soumis aux [Consumer Terms](https://www.anthropic.com/terms)
  et [Usage Policy](https://www.anthropic.com/legal/aup) d’Anthropic.

Lisez [SECURITY.md](./SECURITY.md) pour la frontière de confiance et
[Troubleshooting](../docs/TROUBLESHOOTING.md) pour l’aide connexion/chargement/thème/image/WebView2.

<a id="local-data"></a>
<details>
<summary><strong>Dossiers de données locaux et rétention après désinstallation</strong></summary>

Aura sépare application, paramètres, thèmes, brouillons et profil navigateur :

| Path | Contents |
| --- | --- |
| `%LOCALAPPDATA%\ClaudeAura\app` | Application Aura installée |
| `%LOCALAPPDATA%\ClaudeAura\data` | Paramètres, journaux et état local d’Aura |
| `%LOCALAPPDATA%\ClaudeAura\data\themes` | Thèmes personnalisés sauvegardés et visuels dérivés |
| `%LOCALAPPDATA%\ClaudeAura\data\theme-drafts` | Brouillons Studio en cours |
| `%LOCALAPPDATA%\ClaudeAura\webview` | Profil de connexion WebView2 séparé d’Aura |

Considérez le dossier `webview` comme n’importe quel profil de navigateur connecté.
Ne le publiez ni ne le partagez. La désinstallation par défaut conserve `data` et `webview` ; utilisez la suppression explicite seulement quand vous voulez aussi effacer paramètres locaux, thèmes et profil de connexion séparé.

</details>

<p align="right">(<a href="#readme-top">Retour en haut</a>)</p>
<a id="roadmap"></a>
## Feuille de route

- [x] Companion WebView2 Windows dédié et **Original look** réversible
- [x] Huit thèmes intégrés stables avec support Light et Dark
- [ ] Finaliser et valider l’éditeur visuel no-code de Studio
- [ ] Finaliser et approuver Aura Code pour le Remote Control local officiel de Claude Code avec export terminal-theme correspondant
- [ ] Publier le tutoriel de thème personnalisé de 30 minutes
- [ ] Exécuter le passage de vérification finale avant release

Consultez le
[rapport d’implémentation](../docs/IMPLEMENTATION_REPORT.md) et les
[issues du repository](https://github.com/erichuang1425/claude-aura/issues) pour
l’état public. Une prévisualisation de référence ne remplace pas la preuve d’acceptation
en direct requise.

<p align="right">(<a href="#readme-top">Retour en haut</a>)</p>

<a id="support"></a>
## Assistance et documentation

Commencez par [Troubleshooting](../docs/TROUBLESHOOTING.md). Pour un bug reproductible
ou une demande de fonctionnalité, utilisez la
[page Issues du dépôt](https://github.com/erichuang1425/claude-aura/issues).

Lors d’un signalement de bug, incluez les versions de Windows, Node.js et WebView2,
l’ID du thème actif et les étapes de reproduction. Consultez les logs avant de les partager ;
le journal UI d’Aura se trouve à :

```text
%LOCALAPPDATA%\ClaudeAura\data\aura-ui.log
```

Signalez les problèmes de sécurité via un avis privé de sécurité de dépôt, comme décrit
dans [SECURITY.md](./SECURITY.md).

<a id="documentation-map"></a>
### Carte de la documentation

- [Troubleshooting](../docs/TROUBLESHOOTING.md)
- [Security and trust boundary](./SECURITY.md)
- [Theming guide](../docs/THEMING.md)
- [Theme Kit Specification](../docs/THEME_KIT_SPEC.md)
- [Implementation report](../docs/IMPLEMENTATION_REPORT.md)
- [File Manifest](../docs/FILE_MANIFEST.md)
- [Contributing guide](./CONTRIBUTING.md)
- [Repository issues](https://github.com/erichuang1425/claude-aura/issues)

<a id="contributing"></a>
<details>
<summary><strong>Contrôles de contribution et limites du projet</strong></summary>

Exécutez les contrôles obligatoires avant d’envoyer une modification :

```powershell
npm run check
npm run verify:cycle
```

Pour un audit unique d’un thème intégré :

```powershell
node scripts/theme-cli.mjs qa <id>
```

Maintenez ces limites intactes :

- Ne pas ajouter de dépendance npm ni de police en runtime.
- Conserver l’ordre et les huit IDs de thème stables.
- Ne pas distribuer une interface HTML reconstituée de Claude comme contenu produit.
- Ne pas soumettre d’images de référence comme preuve d’acceptation UI.
- Inclure les informations de source, licence et distribution pour les médias fournis.

Consultez [CONTRIBUTING.md](./CONTRIBUTING.md), le
[guide de création de thèmes](../docs/THEMING.md),
[Theme Kit Specification](../docs/THEME_KIT_SPEC.md) et le
[File Manifest](../docs/FILE_MANIFEST.md) avant de modifier le système de thèmes
ou l’arborescence de release.

</details>

<p align="right">(<a href="#readme-top">Retour en haut</a>)</p>

<a id="charitable-support"></a>
## Soutien caritatif

Claude Aura n’accepte pas de dons personnels, tips, parrainages, paiements de parrainage
ou autre soutien financier. Le propriétaire est actuellement au Royaume-Uni dans le cadre
des [conditions de Student route](https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-student),
qui interdisent l’auto-entreprise ou les activités commerciales, sauf cas limités.
Pour éviter tout conflit potentiel avec ces conditions, le propriétaire ne peut pas
accueillir de dons ou de tips liés au projet tant que celles-ci s’appliquent.

<details>
<summary><strong>Contexte Student-route, associations indépendantes et limites de dons</strong></summary>

Les lecteurs souhaitant soutenir des travaux d’intérêt public peuvent donner
directement à l’une des organisations caritatives suivantes :

- [International Rescue Committee UK](https://help.rescue-uk.org/donate-web)
  aide les personnes touchées par les conflits et les catastrophes, y compris des
  réfugiés qui reconstruisent leur vie au Royaume-Uni. L’International Rescue Committee
  plus large participe aussi à
  [Claude Corps](https://www.anthropic.com/news/claude-corps).
- [CodePath](https://www.every.org/codepath) offre une formation technique gratuite
  et collabore avec Anthropic comme partenaire associatif pour
  [Claude Corps](https://www.anthropic.com/news/claude-corps).

Ces liens mènent directement à des tiers. Claude Aura et son propriétaire ne collectent,
traitent, contrôlent, reçoivent ni ne tirent de bénéfice financier de dons.
Chaque organisation gère son propre recouvrement de dons et ses reçus. Leur présence
en liste n’implique pas d’affiliation, de parrainage, d’agrément ou de partenariat
officiel de collecte avec Claude Aura.

</details>

<a id="license-and-notices"></a>
## Licence et mentions

Le logiciel rédigé par le projet est distribué sous la [MIT License](./LICENSE).
Consultez aussi [NOTICE.md](./NOTICE.md) et [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

La MIT License ne donne aucun droit sur les noms, marques, interface, site web ou
applications d’Anthropic. Les légendes de démonstration ne confèrent pas de droit
de réutilisation sur l’UI affichée, les visuels, noms, marques ou ressemblances humaines.
Les mentions de source et de droits propres à chaque fichier restent applicables.

Consultez les [Anthropic Trademark Guidelines](https://www.anthropic.com/legal/trademark-guidelines)
et les [Consumer Terms](https://www.anthropic.com/terms) actuels. Obtenez l’autorisation
requise avant de publier, modifier ou redistribuer des noms, marques, captures
d’interface, visuels ou ressemblances identifiables protégées. Ce dépôt et ce README
ne confèrent pas cette autorisation.

<a id="acknowledgments"></a>
## Remerciements

- [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin) a inspiré la
  boucle de validation loopback d’origine et le modèle de présentation accessible.
- [claude-desktop-bin](https://github.com/patrickjaja/claude-desktop-bin) a
  inspiré la première cartographie sémantique des thèmes.
- [Best README Template](https://github.com/othneildrew/Best-README-Template) a inspiré
  la structure orientée lecteur de ce README.
- Microsoft Edge WebView2 fournit le runtime navigateur embarqué.

Les licences détaillées et la provenance sont enregistrées dans
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md). Les remerciements n’impliquent
pas d’affiliation, de parrainage ou d’acceptation.

<p align="right">(<a href="#readme-top">Retour en haut</a>)</p>
