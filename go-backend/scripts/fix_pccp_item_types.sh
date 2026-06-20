#!/usr/bin/env bash
# Fix itemType to RAW_MATERIAL for all PCCP raw material products
# Usage: ./fix_pccp_item_types.sh [BASE_URL] [EMAIL] [PASSWORD]

BASE="${1:-http://localhost:8082}"
ADMIN_EMAIL="${2:-admin@pppipeproducts.com}"
ADMIN_PASS="${3:-admin@123}"
CT="Content-Type: application/json"

echo "========================================================="
echo " Fix itemType → RAW_MATERIAL"
echo " Target: $BASE"
echo "========================================================="

TOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H "$CT" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
[ -z "$TOKEN" ] && echo "ERROR: Login failed" && exit 1
AUTH="Authorization: Bearer $TOKEN"
echo "  Logged in."

fix_product() {
  local name=$1 uom=$2 reorder=$3
  local encoded
  encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$name'))")
  local result
  result=$(curl -s "$BASE/api/products?search=$encoded&size=10" -H "$AUTH")
  local id
  id=$(echo "$result" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data=d.get('data',{})
items=data.get('content',data.get('items',[]))
target='$name'.lower()
for item in items:
    if item.get('name','').lower()==target:
        print(item['id'])
        break
" 2>/dev/null)

  if [ -z "$id" ]; then
    echo "  SKIP (not found): $name"
    return
  fi

  local body
  body=$(python3 -c "import json; print(json.dumps({'name':'$name','categoryId':1,'unitOfMeasure':'$uom','sellingPrice':0,'costPrice':0,'productType':'PHYSICAL','itemType':'RAW_MATERIAL','trackInventory':True,'allowNegativeStock':False,'reorderLevel':$reorder,'active':True}))")
  local ok
  ok=$(curl -s -X PUT "$BASE/api/products/$id" -H "$AUTH" -H "$CT" -d "$body" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print('ok' if d.get('success') else 'err:'+d.get('message',''))" 2>/dev/null)
  echo "  $name (id=$id) → $ok"
}

echo ""
echo "→ Updating products..."

fix_product "CELL PLATE"            "pcs"   50
fix_product "BACK-SHEET"            "pcs"   50
fix_product "SPIGOT 6MM"            "pcs"   50
fix_product "SPIGOT 8MM"            "pcs"   50
fix_product "SPIGOT 10MM"           "pcs"   50
fix_product "SOCKET 6MM"            "pcs"   50
fix_product "SOCKET 8MM"            "pcs"   50
fix_product "SOCKET 10MM"           "pcs"   50
fix_product "20MM METAL"            "kg"    5000
fix_product "10MM METAL"            "kg"    5000
fix_product "CRUSHED SAND"          "kg"    10000
fix_product "DUST (CORE)"           "kg"    5000
fix_product "Silo CEMENT (CORE)"    "kg"    10000
fix_product "EXTRA CEMENT"          "kg"    2000
fix_product "CHEMICAL"              "litre" 200
fix_product "4MM WINDING WIRE"      "kg"    1000
fix_product "Silo CEMENT (COATING)" "kg"    5000
fix_product "LOOSE CEMENT"          "kg"    2000
fix_product "PLASTER SAND"          "kg"    5000
fix_product "C.SAND"                "kg"    3000

echo ""
echo "  Done. Products are now itemType=RAW_MATERIAL."
echo "========================================================="
