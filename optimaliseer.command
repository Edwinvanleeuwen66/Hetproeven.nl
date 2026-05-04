#!/bin/bash

# ─────────────────────────────────────────────
# Het Proeven — PNG naar JPG converter
# Dubbelklik dit bestand in Finder om te starten
# ─────────────────────────────────────────────

# Ga naar de map waar dit script staat (= root van het project)
cd "$(dirname "$0")"

echo ""
echo "🍽  Het Proeven — afbeeldingen optimaliseren"
echo "────────────────────────────────────────────"

# Controleer of sips beschikbaar is (standaard op elke Mac)
if ! command -v sips &> /dev/null; then
  echo "❌ sips niet gevonden — dit werkt alleen op Mac"
  read -p "Druk op Enter om te sluiten..."
  exit 1
fi

IMAGES_MAP="assets/images"

if [ ! -d "$IMAGES_MAP" ]; then
  echo "❌ Map niet gevonden: $IMAGES_MAP"
  echo "   Zet dit script in de root van je Hetproeven.nl project"
  read -p "Druk op Enter om te sluiten..."
  exit 1
fi

# Tel PNG bestanden
AANTAL=$(find "$IMAGES_MAP" -name "*.png" | wc -l | tr -d ' ')

if [ "$AANTAL" -eq 0 ]; then
  echo "✓ Geen PNG bestanden gevonden — alles is al JPG"
  read -p "Druk op Enter om te sluiten..."
  exit 0
fi

echo "📁 $AANTAL PNG bestanden gevonden in $IMAGES_MAP"
echo ""

GECONVERTEERD=0

for PNG in "$IMAGES_MAP"/*.png; do
  [ -f "$PNG" ] || continue

  BESTAND=$(basename "$PNG")
  JPG="${PNG%.png}.jpg"
  GROOTTE_VOOR=$(stat -f%z "$PNG")

  # Converteer PNG naar JPG met kwaliteit 82 via sips (ingebouwd in macOS)
  sips -s format jpeg -s formatOptions 82 "$PNG" --out "$JPG" &> /dev/null

  GROOTTE_NA=$(stat -f%z "$JPG")
  BESPARING=$(echo "scale=0; (1 - $GROOTTE_NA / $GROOTTE_VOOR) * 100" | bc 2>/dev/null || echo "?")

  echo "  ✓ $BESTAND → $(basename $JPG)  (${GROOTTE_VOOR}B → ${GROOTTE_NA}B, ~${BESPARING}% kleiner)"

  # Verwijder originele PNG
  rm "$PNG"

  GECONVERTEERD=$((GECONVERTEERD + 1))
done

echo ""
echo "────────────────────────────────────────────"
echo "✅ $GECONVERTEERD afbeeldingen geconverteerd"
echo ""

# Pas recipes.json aan: vervang .png door .jpg
JSON="data/recipes.json"
if [ -f "$JSON" ]; then
  sed -i '' 's/\.png"/\.jpg"/g' "$JSON"
  echo "✅ recipes.json bijgewerkt (.png → .jpg)"
else
  echo "⚠️  data/recipes.json niet gevonden — pas dit handmatig aan"
fi

# Pas style.css aan
CSS="assets/css/style.css"
if [ -f "$CSS" ]; then
  sed -i '' 's/\.png/\.jpg/g' "$CSS"
  echo "✅ style.css bijgewerkt"
fi

echo ""
echo "────────────────────────────────────────────"
echo "Klaar! Commit en push naar GitHub."
echo ""
read -p "Druk op Enter om te sluiten..."
