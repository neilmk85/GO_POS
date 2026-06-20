#!/bin/bash
# Seed 20 PCCP raw material products + "Raw Materials" category
# Usage: ./seed_raw_materials.sh [BASE_URL] [TOKEN]
# TOKEN can also be set via RAW_SEED_TOKEN env var

BASE_URL="${1:-http://localhost:8080}"
TOKEN="${2:-${RAW_SEED_TOKEN:-}}"
CT="Content-Type: application/json"

# ── Auth ───────────────────────────────────────────────────────────────────────
if [ -z "$TOKEN" ]; then
  echo "→ Obtaining auth token..."
  LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "$CT" \
    -d '{"email":"admin@pos.com","password":"Admin@123"}')
  TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['accessToken'])" 2>/dev/null)
  if [ -z "$TOKEN" ]; then
    echo "ERROR: Could not obtain auth token. Is the server running?"
    echo "Response: $LOGIN"
    exit 1
  fi
  echo "  Token obtained."
fi

AUTH="Authorization: Bearer $TOKEN"

post() {
  local endpoint=$1
  local body=$2
  local result
  result=$(curl -s -X POST "$BASE_URL$endpoint" -H "$AUTH" -H "$CT" -d "$body")
  local id
  id=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id','') if isinstance(d.get('data'),dict) else '')" 2>/dev/null)
  echo "$id"
}

echo "========================================================="
echo " PCCP Raw Materials Seeder"
echo "========================================================="

# ── 1. Create "Raw Materials" category ────────────────────────────────────────
echo ""
echo "→ Creating 'Raw Materials' category..."
CAT_ID=$(post /api/categories '{"name":"Raw Materials","description":"Raw materials used in PCCP pipe production","displayOrder":99,"active":true}')
if [ -z "$CAT_ID" ]; then
  echo "  Category may already exist. Fetching id..."
  CAT_RESP=$(curl -s "$BASE_URL/api/categories?search=Raw+Materials" -H "$AUTH")
  CAT_ID=$(echo "$CAT_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
items = d.get('data', {}).get('items', d.get('data', []))
if isinstance(items, list):
    for c in items:
        if c.get('name','').lower() == 'raw materials':
            print(c['id'])
            break
" 2>/dev/null)
fi
echo "  Raw Materials category id=$CAT_ID"

if [ -z "$CAT_ID" ]; then
  echo "ERROR: Could not create or find 'Raw Materials' category."
  exit 1
fi

# ── 2. Create raw material products ───────────────────────────────────────────
echo ""
echo "→ Creating 20 raw material products..."

create_material() {
  local name=$1
  local uom=${2:-kg}
  local body
  body=$(python3 -c "import json; print(json.dumps({
    'name': '$name',
    'categoryId': $CAT_ID,
    'unitOfMeasure': '$uom',
    'sellingPrice': 0,
    'costPrice': 0,
    'productType': 'PHYSICAL',
    'trackInventory': True,
    'allowNegativeStock': False,
    'reorderLevel': 100,
    'active': True
  }))")
  local id
  id=$(post /api/products "$body")
  echo "  $name → id=$id"
}

# SPINNING materials (11)
create_material "CELL PLATE" "pcs"
create_material "BACK-SHEET" "pcs"
create_material "SPIGOT 6MM" "pcs"
create_material "SPIGOT 8MM" "pcs"
create_material "SPIGOT 10MM" "pcs"
create_material "SOCKET 6MM" "pcs"
create_material "SOCKET 8MM" "pcs"
create_material "SOCKET 10MM" "pcs"
create_material "20MM METAL" "kg"
create_material "10MM METAL" "kg"
create_material "CRUSHED SAND" "kg"
create_material "DUST (CORE)" "kg"
create_material "Silo CEMENT (CORE)" "kg"
create_material "EXTRA CEMENT" "kg"
create_material "CHEMICAL" "litre"

# WINDING material (1)
create_material "4MM WINDING WIRE" "kg"

# COATING materials (5) — note: DUST and Silo CEMENT are separate entries for COATING
create_material "Silo CEMENT (COATING)" "kg"
create_material "LOOSE CEMENT" "kg"
create_material "PLASTER SAND" "kg"
create_material "C.SAND" "kg"

echo ""
echo "========================================================="
echo " Done! 20 raw materials seeded."
echo " Run seed_pccp_pipe_configs.py next to create 128 pipe configs."
echo "========================================================="
