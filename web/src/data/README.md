# Données NPA

`npa.json` : tous les codes postaux suisses (≈3190) avec nom, canton, langue et coordonnées LV95 (km), pour la carte des territoires.

- **Source** : swisstopo, *Amtliches Ortschaftenverzeichnis* (open data), `ortschaftenverzeichnis_plz_2056.csv.zip` sur <https://data.geo.admin.ch>.
- **Licence / attribution** : données ouvertes, mention **© swisstopo** obligatoire (pied de la carte).
- **Régénérer** : télécharger et décompresser le zip **hors du dépôt**, puis `pnpm npa <chemin>/AMTOVZ_CSV_LV95.csv`.
- Pour chaque NPA on garde la commune qui porte la plus grande part d'adresses (`Adressenanteil`).
