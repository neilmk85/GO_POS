#!/usr/bin/env bash
# Seed opening stock for PCCP raw materials
# Usage: ./seed_pccp_stock.sh [BASE_URL] [EMAIL] [PASSWORD]

BASE="${1:-http://localhost:8082}"
ADMIN_EMAIL="${2:-admin@pppipeproducts.com}"
ADMIN_PASS="${3:-admin@123}"
CT="Content-Type: application/json"

echo "========================================================="
echo " PCCP Stock Seeder"
echo " Target: $BASE"
echo "========================================================="

# ── Auth ──────────────────────────────────────────────────────
echo ""
echo "→ Logging in..."
LOGIN=$(curl -s -X POST "$BASE/api/auth/login" \
  -H "$CT" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['accessToken'])" 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo "ERROR: Login failed. Response: $LOGIN"
  exit 1
fi
echo "  Token obtained."
AUTH="Authorization: Bearer $TOKEN"

# ── Outlet ────────────────────────────────────────────────────
OUTLET_ID=$(curl -s "$BASE/api/outlets" -H "$AUTH" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('data',[]); print(items[0]['id'] if items else 1)" 2>/dev/null)
OUTLET_ID="${OUTLET_ID:-1}"
echo "  Using outlet id=$OUTLET_ID"

# ── Product lookup helper ─────────────────────────────────────
get_product_id() {
  local name=$1
  local encoded
  encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$name'))")
  local result
  result=$(curl -s "$BASE/api/products?search=$encoded&size=10" -H "$AUTH")
  local id
  id=$(echo "$result" | python3 -c "
import sys, json
d = json.load(sys.stdin)
data = d.get('data', {})
items = data.get('content', data.get('items', []))
target = '$name'.lower()
for item in items:
    if item.get('name', '').lower() == target:
        print(item['id'])
        break
" 2>/dev/null)
  echo "$id"
}

# ── Stock adjustment helper ───────────────────────────────────
add_stock() {
  local product_id=$1
  local qty=$2
  local name=$3
  if [ -z "$product_id" ]; then
    echo "  SKIP (not found): $name"
    return
  fi
  local body
  body=$(python3 -c "import json; print(json.dumps({'productId':$product_id,'outletId':$OUTLET_ID,'quantity':$qty,'reason':'OPENING_STOCK','notes':'Initial opening stock seeded for PCCP manufacturing'}))")
  local result
  result=$(curl -s -X POST "$BASE/api/inventory/adjustments" -H "$AUTH" -H "$CT" -d "$body")
  local ok
  ok=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok' if d.get('success') else 'err:'+d.get('message',''))" 2>/dev/null)
  echo "  $name → qty=$qty [$ok]"
}

# ── Lookup product IDs ────────────────────────────────────────
echo ""
echo "→ Looking up product IDs..."

ID_CELL_PLATE=$(get_product_id "CELL PLATE")
ID_BACK_SHEET=$(get_product_id "BACK-SHEET")
ID_SPIGOT_6=$(get_product_id "SPIGOT 6MM")
ID_SPIGOT_8=$(get_product_id "SPIGOT 8MM")
ID_SPIGOT_10=$(get_product_id "SPIGOT 10MM")
ID_SOCKET_6=$(get_product_id "SOCKET 6MM")
ID_SOCKET_8=$(get_product_id "SOCKET 8MM")
ID_SOCKET_10=$(get_product_id "SOCKET 10MM")
ID_METAL_20=$(get_product_id "20MM METAL")
ID_METAL_10=$(get_product_id "10MM METAL")
ID_CRUSHED_SAND=$(get_product_id "CRUSHED SAND")
ID_DUST=$(get_product_id "DUST (CORE)")
ID_CEMENT_CORE=$(get_product_id "Silo CEMENT (CORE)")
ID_EXTRA_CEMENT=$(get_product_id "EXTRA CEMENT")
ID_CHEMICAL=$(get_product_id "CHEMICAL")
ID_WIRE=$(get_product_id "4MM WINDING WIRE")
ID_CEMENT_COAT=$(get_product_id "Silo CEMENT (COATING)")
ID_LOOSE_CEMENT=$(get_product_id "LOOSE CEMENT")
ID_PLASTER_SAND=$(get_product_id "PLASTER SAND")
ID_CSAND=$(get_product_id "C.SAND")

echo "  Done."

# ── Add stock ─────────────────────────────────────────────────
echo ""
echo "→ Adding opening stock..."

# Spinning — jigs/moulds (pcs)
add_stock "$ID_CELL_PLATE"   "200"    "CELL PLATE"
add_stock "$ID_BACK_SHEET"   "200"    "BACK-SHEET"
add_stock "$ID_SPIGOT_6"     "300"    "SPIGOT 6MM"
add_stock "$ID_SPIGOT_8"     "300"    "SPIGOT 8MM"
add_stock "$ID_SPIGOT_10"    "300"    "SPIGOT 10MM"
add_stock "$ID_SOCKET_6"     "300"    "SOCKET 6MM"
add_stock "$ID_SOCKET_8"     "300"    "SOCKET 8MM"
add_stock "$ID_SOCKET_10"    "300"    "SOCKET 10MM"

# Aggregates / Core materials (kg)
add_stock "$ID_METAL_20"     "50000"  "20MM METAL"
add_stock "$ID_METAL_10"     "30000"  "10MM METAL"
add_stock "$ID_CRUSHED_SAND" "80000"  "CRUSHED SAND"
add_stock "$ID_DUST"         "25000"  "DUST (CORE)"

# Cement (kg)
add_stock "$ID_CEMENT_CORE"  "60000"  "Silo CEMENT (CORE)"
add_stock "$ID_EXTRA_CEMENT" "10000"  "EXTRA CEMENT"
add_stock "$ID_CEMENT_COAT"  "35000"  "Silo CEMENT (COATING)"
add_stock "$ID_LOOSE_CEMENT" "8000"   "LOOSE CEMENT"

# Admixture / Chemical (litre)
add_stock "$ID_CHEMICAL"     "1000"   "CHEMICAL"

# Winding wire (kg)
add_stock "$ID_WIRE"         "6000"   "4MM WINDING WIRE"

# Coating sand (kg)
add_stock "$ID_PLASTER_SAND" "25000"  "PLASTER SAND"
add_stock "$ID_CSAND"        "15000"  "C.SAND"

echo ""
echo "========================================================="
echo " Stock seeding complete for $BASE"
echo "========================================================="
