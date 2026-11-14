# MQTT Chat + console HUD El Choco

## Chat

```
cp .env.example .env
pnpm install
pnpm start
pnpm test
```

## Console du Patrón (HUD)

Page web qui montre en direct les familles, l'heure du cartel, les services et le journal, depuis MQTT.

```
docker compose up -d broker   # Mosquitto : MQTT 1883 + WebSocket 9001 (ne pas lancer toxiproxy)
pnpm feed                     # publie les familles de démonstration (voir plus bas)
pnpm hud                      # http://localhost:5173
```

Depuis une autre machine : `http://<ip>:5173`, puis dans **Options** régler le broker sur `ws://<ip>:9001`.
`pnpm hud:build` produit `web/dist`.

### Données de démonstration

- `pnpm convert` : pont **temporaire** depuis `../elchoco-common`. Pour chaque dossier, un `chocolaterie.json` (format du contrat, exemple à copier : `Don Freey/chocolaterie.json`) est utilisé tel quel ; sinon `business.json` (brouillon) est converti. Le rapport donne une ligne par dossier : `contrat`, `ok`, `réparé` (virgules finales corrigées) ou `ignoré` (vide, invalide), puis des notes : `NPA inconnus` (code postal absent de l'annuaire, gardé mais listé à part), `cacao ignoré`, `zones ignorées`. Le résultat est écrit dans `data/vitrines/` (instantané committé).
- `pnpm feed` : lit `elchoco-common` (ou `data/vitrines/` avec `--offline`, ou si le dossier manque), emballe chaque fiche dans une enveloppe du contrat et la publie comme le ferait la famille (vitrine + présence retenues, battement toutes les 2 s, bascule ouvert/fermé au hasard) ; un service `time` publie l'heure chaque seconde. Ctrl+C : toutes les familles passent `closed`. Option `--broker mqtt://hôte:1883`.
- `pnpm npa <AMTOVZ_CSV_LV95.csv>` : régénère `web/src/data/npa.json` (codes postaux suisses). Source et licence dans `web/src/data/README.md`. **Données NPA © swisstopo.**

### Carte des territoires

Chaque code postal est une cellule de Voronoï limitée à 3 km autour de son point : les lacs et les Alpes restent vides, le contour du pays apparaît tout seul. Cadrages **Suisse**, **Romandie** (défaut) et **Ma famille**. Rayé rouge = contesté, plusieurs familles revendiquent le NPA.

### Structure : `web/src/{state,panels,fx}`

- `state/` : logique pure et testée (protocole, familles, horloge, options, store, couleurs, territoires).
- `panels/` : HTML/SVG lisible. **Un panneau n'importe jamais `fx/` ni `three`.**
- `fx/` : Three.js (et plus tard le son). **Optionnel** : `main.js` le charge par `import()` dynamique ; sans `fx/`, sans WebGL ou avec les effets sur « aucun », la console fonctionne quand même.

Les tests (`pnpm test`) couvrent `state/`, `panels/` (vues pures), `tools/` et la carte.

### Ajouter un panneau

1. Créer `web/src/panels/mon-panneau.js` qui exporte `{ id, title, select(ctx), view(state), mount(el, ctx) }` (`ctx = { store, options }`) ; `view` est pure et passe toute valeur venant de MQTT par `escapeHtml` ; `mount` renvoie une fonction de démontage (`mountReactive` de `panels/reactive.js` fait le travail).
2. L'ajouter à `panels` dans `web/src/panels/registry.js` (et à `TAB_IDS` de `shell.js` pour avoir un onglet).
3. Un futur service (annuaire, caisse…) s'active dans `panels/services.js` : une ligne dans `SERVICE_SLOTS`.

### Show (milestone B)

- Démarrage : écran noir avec une lumière qui respire (un clic ou une touche débloque le son : les navigateurs interdisent l'audio avant) → les anneaux s'allument l'un après l'autre avec la musique d'intro, et le bouton **ENTRER** attend → textes de démarrage (blagues) puis « Bienvenido, Patrón » (une touche ou un clic les passe) → fondu vers le HUD et musique plus légère. Sans `fx/`, sans WebGL ou avec les effets `none`, la console démarre directement.
- Son synthétisé dans `web/src/fx/sound.js` (table `événement → son`), volume, muet et musique dans les options. Musique chiptune style Game Boy (lead pulse, basse triangle) : un morceau pour l'intro, un autre, léger, pour le HUD ; les mélodies sont des tableaux de notes MIDI dans `TRACKS`.
- `pnpm feed --clock-skew 30 [--skew-family <slug>]` décale l'horodatage d'un nœud (affiché `+30.0 s`) ; `pnpm feed --stagger <ms>` (délai entre deux familles, 1500 par défaut) et `--verbose` (affiche aussi `time` et les heartbeats) ; `pnpm feed --die <slug>` coupe la connexion de cette famille après 10 s (dernière volonté → `died`).
