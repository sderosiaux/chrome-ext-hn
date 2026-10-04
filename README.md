# HN Distill

Une extension Chrome pour comprendre une discussion Hacker News : ses arguments, ses objections, les expériences des participants et les questions qui restent ouvertes.

## Installation

1. Ouvrir `chrome://extensions`, activer le mode développeur et charger ce dossier avec **Charger l’extension non empaquetée**.
2. Après une mise à jour, recharger l’extension puis la page Hacker News.
3. Ouvrir une discussion et cliquer sur **Distill**, ou sur l’icône de l’extension.
4. Ajouter une clé OpenAI ou Anthropic dans les paramètres. L’analyse démarre après l’enregistrement.

Aucune compilation, aucun serveur et aucune dépendance à installer.

## Archives GitHub

**Archiver sur GitHub** enregistre la synthèse approfondie si elle est déjà terminée, sinon la courte. Le bouton consulte les notes en mémoire et le cache correspondant à la discussion, aux sources et aux paramètres actuels, quel que soit l’onglet affiché. Il ne lance aucune génération et exclut les Q/R, brouillons et notes préparatoires.

Le dépôt proposé est `sderosiaux/saved-youtube-hackernews-reddit-summaries`, commun aux trois extensions. Le premier clic ouvre la configuration, également accessible dans **Paramètres → Archives GitHub**. Renseigner un [jeton GitHub à accès limité](https://github.com/settings/personal-access-tokens/new), autorisé sur ce dépôt avec **Contents: Read and write**. Le même jeton peut être saisi dans les trois extensions ; la connexion de la CLI `gh` n’est pas partagée avec Chrome. Le jeton reste en session, ou sur cet appareil si demandé, jamais dans Chrome Sync. Recharger l’extension pour activer la nouvelle autorisation `api.github.com`.

Chaque clic crée ou actualise `hackernews/<id>.md` via l’API GitHub, sur la branche par défaut ou celle configurée. Le Markdown conserve titre, URL, niveau, langue, références et diagrammes Mermaid. Un contenu identique ne crée pas de commit ; une version courte ne remplace pas une archive approfondie. Un fichier non créé par les extensions n’est pas écrasé. Un lien vers le fichier apparaît après l’archivage.

## Lecture

- **Synthèse** : organisation adaptée au contenu, sans nombre imposé de thèmes. Les témoignages, objections et interprétations restent distingués.
- **Questions-réponses** : un parcours pédagogique par sujet, sans quota de questions. Les positions opposées sont expliquées dans leur contexte.
- **Discussion** : le post initial et les commentaires d’origine, avec accès aux messages parents et aux liens cités.
- **Courte / Approfondie** : chaque nouvelle discussion commence en **Courte** pour un premier aperçu. **Approfondie** développe les raisonnements, exemples et objections, uniquement sur demande ; le choix reste local au fil ouvert. Le niveau règle la profondeur des explications, sans fixer un nombre de questions.
- **Sources** sous chaque idée : références vérifiées contre les identifiants fournis au modèle. Elles ouvrent les commentaires sur place ou sur HN. Cette validation ne constitue pas une vérification indépendante de la véracité des propos.
- Copie en Markdown ou texte, avec références par idée. Les notes interrompues sont explicitement marquées comme incomplètes.

Le lecteur conserve une largeur de texte confortable et de petites marges autour de la fenêtre. Les thèmes se lisent à la suite. Échap ferme les paramètres ou le lecteur ; les flèches naviguent entre les onglets.

Le lecteur, les paramètres et le bouton Distill suivent automatiquement le thème clair ou sombre du système, y compris lors d’un changement pendant la lecture.

La synthèse et les Q/R peuvent contenir des schémas entre les paragraphes : workflow, embranchements, hiérarchie ou relations entre arguments. Ils sont ajoutés lorsqu’ils aident à comprendre, à partir des mêmes sources que le passage et sans appel IA supplémentaire. Le prompt évalue chaque section et chaque mécanisme indépendamment, sans quota global ni obligation d’illustrer chaque section. La lecture courte privilégie les mécanismes essentiels ; la lecture approfondie couvre aussi les autres mécanismes qui gagnent à être visualisés, sans répéter un schéma équivalent. Les notes intermédiaires des longs fils restent textuelles. Les schémas suivent le thème du système et les plus larges défilent horizontalement sur petit écran ; leur description est accessible aux lecteurs d’écran. La copie Markdown les exporte en blocs Mermaid, la copie texte en relations avec des flèches.

Le modèle décrit uniquement un petit graphe JSON. L’extension valide ses nœuds et liens, puis construit elle-même le SVG, sans interpréter de HTML, SVG brut ou code généré. Un schéma incomplet ou invalide reste masqué sans bloquer la lecture du passage. La nouvelle version des prompts renouvelle les résultats lors de la prochaine génération.

L’interface et les notes sont en français par défaut, y compris après migration des anciens réglages anglais. La langue des notes reste configurable : français, anglais, espagnol, allemand, portugais, chinois ou japonais. Le contexte personnel adapte les explications, sans supprimer les avis contraires.

## Sources et longs fils

L’API officielle HN fournit le post initial et permet de résoudre les liens vers un commentaire en discussion complète. L’arbre Algolia accélère la récupération. Son nombre de commentaires et ses branches principales sont comparés aux métadonnées HN ; si l’index est incomplet ou inaccessible, l’extension parcourt les réponses via l’API officielle, avec huit requêtes simultanées au maximum.

Les commentaires courts sont conservés, ainsi que les auteurs et les relations parent/réponse. Les messages supprimés restent des repères de contexte. Les scores de commentaires inconnus ne sont pas inventés. Le HTML est converti en texte et les liens HTTP(S) sont conservés séparément.

Il n’y a pas de plafond de commentaires. Quand le contenu tient dans le budget d’un appel, il est directement envoyé au modèle et la réponse apparaît progressivement. Le budget porte sur la taille réelle du texte et des instructions, pas sur un nombre de messages. Les entrées plus volumineuses sont réparties par branches et, si nécessaire, par passages, avec contexte parental. Chaque lot produit des notes sourcées avant la synthèse globale. Ces notes préparatoires sont visibles pendant la lecture, clairement indiquées comme provisoires ; le temps écoulé et le nombre d’idées reçues permettent de suivre l’avancement. Une réduction supplémentaire intervient seulement si les notes intermédiaires dépassent le budget d’entrée. Elle s’arrête avec une erreur si elle ne progresse plus. Cette synthèse implique une compression ; elle ne promet pas de restituer chaque détail.

Les discussions évoluent : les données sont relues à chaque réouverture du lecteur. Algolia peut présenter un décalage d’indexation que les vérifications de volume et de branches ne détectent pas toujours. L’article externe n’est pas téléchargé : l’analyse porte sur les propos des participants et le post HN.

## Modèles et générations

- **Luna / OpenAI** par défaut : `gpt-6-luna`, Responses API, streaming, JSON Schema strict, `store: false`, raisonnement `none`.
- **Claude / Anthropic** : `claude-sonnet-4-5`, Messages API, streaming et sortie structurée. Les clés Anthropic existantes sont conservées à la migration.

Les sorties ont un schéma commun de sections et d’entrées sourcées. Les références invalides, réponses incomplètes et répétitions sont détectées. Une réponse interrompue ne devient jamais une entrée complète du cache. Les limites propres aux fournisseurs restent applicables ; aucune boucle de continuation automatique ne tente de les contourner.

**Arrêter**, fermer le lecteur ou changer de lecture annule la requête locale. Les passages complets déjà affichés restent disponibles dans cette page. L’annulation ne garantit pas l’arrêt immédiat de la facturation côté fournisseur. Les erreurs HTTP temporaires peuvent être réessayées deux fois avant le début du streaming ; une erreur en cours de génération ne relance pas silencieusement un appel payant.

## Stockage et confidentialité

- Clés API conservées dans `chrome.storage.session` par défaut, ou `chrome.storage.local` si l’option est cochée. Aucun Chrome Sync. Les anciennes clés locales sont migrées sans perte.
- Stockage des clés accessible uniquement aux contextes de confiance de l’extension. Communication avec le lecteur vérifiée par origine, fenêtre et jeton de session.
- Les clés sont envoyées uniquement au fournisseur sélectionné. Le texte de la discussion et le contexte personnel lui sont transmis pour l’analyse. Aucun journal ne contient les prompts ou les clés.
- Notes complètes enregistrées localement : clé de cache calculée sur la source, le modèle, la version du prompt, le mode, la profondeur, la langue et le contexte personnel. Conservation de 30 résultats au maximum dans un budget d’environ 3 Mo. Les résultats trop volumineux restent copiables dans la page.
- Les brouillons restent en mémoire dans la page et disparaissent à son rechargement. Les paramètres permettent d’effacer les clés et les notes enregistrées.
- Aucun suivi, aucune télémétrie, aucun backend propre à l’extension.

## Code

| Fichier | Rôle |
| --- | --- |
| `content.js`, `content.css` | Bouton discret, dialogue natif et iframe isolée |
| `background.js` | Icône Chrome et initialisation du stockage |
| `data.js` | Récupération des arbres, nettoyage HTML, découpage sans suppression de commentaires |
| `prompts.js`, `analysis.js` | Instructions, schéma, validation des sources et détection des répétitions |
| `api_client.js`, `generation.js` | Streaming des deux fournisseurs et synthèse des longs fils |
| `storage.js` | Migration, clés et cache persistant |
| `panel.html`, `panel.js`, `panel.css`, `design-system.css` | Interface de lecture et paramètres |
| `render.js`, `markdown.js` | Affichage sans HTML généré et export sourcé |
| `diagrams.js`, `diagrams.css` | Instructions, validation, dessin SVG et exports des schémas intégrés |

Pour une vérification rapide : charger l’extension, ouvrir un Ask HN avec plusieurs branches, enregistrer une clé, consulter les sources, changer de niveau puis ouvrir les Q/R. Vérifier également l’arrêt d’une génération et la réouverture des notes.
