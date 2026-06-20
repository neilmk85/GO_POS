#!/usr/bin/env bash
# Seed PCCP master data: customers, vendors, raw materials
# Usage: ./seed_pccp_master_data.sh [BASE_URL]

BASE="${1:-http://localhost:8082}"
ADMIN_EMAIL="${2:-admin@pppipeproducts.com}"
ADMIN_PASS="${3:-admin@123}"
CT="Content-Type: application/json"

echo "========================================================="
echo " PCCP Master Data Seeder"
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

post() {
  local endpoint=$1
  local body=$2
  local result
  result=$(curl -s -X POST "$BASE$endpoint" -H "$AUTH" -H "$CT" -d "$body")
  local id
  id=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id','') if isinstance(d.get('data'),dict) else '')" 2>/dev/null)
  echo "$id"
}

# ── CUSTOMERS ─────────────────────────────────────────────────
echo ""
echo "→ Creating PCCP customers (water boards, municipalities, infrastructure)..."

post /api/customers '{"name":"Maharashtra Jeevan Pradhikaran","phone":"02222617676","email":"procurement@mjp.gov.in","address":"Haji Ali, Mahalaxmi","city":"Mumbai","state":"Maharashtra","pincode":"400034","gstin":"27AABCM1234A1Z5","pan":"AABCM1234A","segment":"VIP","creditLimit":10000000,"discountPercent":0}' > /dev/null
echo "  Maharashtra Jeevan Pradhikaran"

post /api/customers '{"name":"CIDCO - City & Industrial Dev Corp","phone":"02227565100","email":"pipes@cidco.maharashtra.gov.in","address":"CIDCO Bhavan, CBD Belapur","city":"Navi Mumbai","state":"Maharashtra","pincode":"400614","gstin":"27AABCC5678B1Z3","pan":"AABCC5678B","segment":"VIP","creditLimit":20000000,"discountPercent":0}' > /dev/null
echo "  CIDCO"

post /api/customers '{"name":"Pune Municipal Corporation","phone":"02025506800","email":"water@punecorporation.org","address":"Shivajinagar","city":"Pune","state":"Maharashtra","pincode":"411005","gstin":"27AABCP9012C1Z1","pan":"AABCP9012C","segment":"VIP","creditLimit":15000000,"discountPercent":0}' > /dev/null
echo "  Pune Municipal Corporation"

post /api/customers '{"name":"Nagpur Municipal Corporation","phone":"07122567801","email":"procurement@nagpurcity.in","address":"Mahal","city":"Nagpur","state":"Maharashtra","pincode":"440002","gstin":"27AABCN3456D1Z8","pan":"AABCN3456D","segment":"WHOLESALE","creditLimit":8000000,"discountPercent":0}' > /dev/null
echo "  Nagpur Municipal Corporation"

post /api/customers '{"name":"Maharashtra Water Grid Corporation","phone":"02022164444","email":"mwgc@mahawater.gov.in","address":"Mantralaya Annexe","city":"Mumbai","state":"Maharashtra","pincode":"400032","gstin":"27AABCM7890E1Z4","pan":"AABCM7890E","segment":"VIP","creditLimit":50000000,"discountPercent":0}' > /dev/null
echo "  Maharashtra Water Grid Corporation"

post /api/customers '{"name":"Thane Municipal Corporation","phone":"02225334500","email":"water@thanecorporation.gov.in","address":"TMC Building, Vasant Vihar","city":"Thane","state":"Maharashtra","pincode":"400601","gstin":"27AABCT1122F1Z7","pan":"AABCT1122F","segment":"VIP","creditLimit":12000000,"discountPercent":0}' > /dev/null
echo "  Thane Municipal Corporation"

post /api/customers '{"name":"Nashik Municipal Corporation","phone":"02532575020","email":"pipes@nashikcorporation.in","address":"Rajiv Gandhi Bhavan","city":"Nashik","state":"Maharashtra","pincode":"422001","gstin":"27AABCN3344G1Z2","pan":"AABCN3344G","segment":"WHOLESALE","creditLimit":6000000,"discountPercent":0}' > /dev/null
echo "  Nashik Municipal Corporation"

post /api/customers '{"name":"Aurangabad Smart City Dev Corp","phone":"02402332233","email":"infra@aurangabadsmartcity.in","address":"Cidco Colony, N-6","city":"Aurangabad","state":"Maharashtra","pincode":"431003","gstin":"27AABCA5566H1Z6","pan":"AABCA5566H","segment":"WHOLESALE","creditLimit":5000000,"discountPercent":0}' > /dev/null
echo "  Aurangabad Smart City Dev Corp"

post /api/customers '{"name":"MSRDC - Maharashtra State Road Dev Corp","phone":"02224937600","email":"pipes@msrdc.maharashtra.gov.in","address":"Bandra Kurla Complex","city":"Mumbai","state":"Maharashtra","pincode":"400051","gstin":"27AABCM7788I1Z9","pan":"AABCM7788I","segment":"VIP","creditLimit":25000000,"discountPercent":0}' > /dev/null
echo "  MSRDC"

post /api/customers '{"name":"L&T Infrastructure Engineering","phone":"02267555555","email":"procurement.pipes@larsentoubro.com","address":"L&T House, Ballard Estate","city":"Mumbai","state":"Maharashtra","pincode":"400001","gstin":"27AAACL3782C1ZS","pan":"AAACL3782C","segment":"VIP","creditLimit":30000000,"discountPercent":2}' > /dev/null
echo "  L&T Infrastructure Engineering"

post /api/customers '{"name":"Tata Projects Limited","phone":"04067101600","email":"supply.pipes@tataprojects.com","address":"Mithona Towers, Prakash Nagar","city":"Hyderabad","state":"Telangana","pincode":"500016","gstin":"36AAACT3561Q1ZF","pan":"AAACT3561Q","segment":"VIP","creditLimit":20000000,"discountPercent":1}' > /dev/null
echo "  Tata Projects Limited"

post /api/customers '{"name":"NCC Limited","phone":"04023260000","email":"materials@ncclimited.com","address":"NCC House, Madhapur","city":"Hyderabad","state":"Telangana","pincode":"500081","gstin":"36AAACN1370G1Z1","pan":"AAACN1370G","segment":"WHOLESALE","creditLimit":10000000,"discountPercent":1}' > /dev/null
echo "  NCC Limited"

echo ""
echo "  ✓ 12 customers created."

# ── VENDORS ───────────────────────────────────────────────────
echo ""
echo "→ Creating PCCP vendors (cement, wire, aggregate, chemical suppliers)..."

post /api/vendors '{"name":"UltraTech Cement Ltd","contactPerson":"Ramesh Iyer","phone":"02266917000","email":"bulk.sales@ultratechcement.com","address":"B Wing, Ahura Centre, Mahakali Caves Rd","city":"Mumbai","state":"Maharashtra","pincode":"400093","gstin":"27AAACL3782C1ZS","pan":"AAACL3782C","paymentTerms":"Net 30"}' > /dev/null
echo "  UltraTech Cement Ltd"

post /api/vendors '{"name":"ACC Limited","contactPerson":"Sunil Bhatt","phone":"02222185000","email":"sales@acclimited.com","address":"Cement House, 121 Maharshi Karve Rd","city":"Mumbai","state":"Maharashtra","pincode":"400020","gstin":"27AACCA1596N1ZE","pan":"AACCA1596N","paymentTerms":"Net 30"}' > /dev/null
echo "  ACC Limited"

post /api/vendors '{"name":"Ambuja Cements Ltd","contactPerson":"Priya Nair","phone":"02240667000","email":"bulk@ambujacement.com","address":"Elegant Business Park, Andheri East","city":"Mumbai","state":"Maharashtra","pincode":"400059","gstin":"27AAACA3868F1Z5","pan":"AAACA3868F","paymentTerms":"Net 45"}' > /dev/null
echo "  Ambuja Cements Ltd"

post /api/vendors '{"name":"JSW Steel Ltd - Wire Division","contactPerson":"Manoj Verma","phone":"02224251000","email":"wire.sales@jsw.in","address":"JSW Centre, Bandra Kurla Complex","city":"Mumbai","state":"Maharashtra","pincode":"400051","gstin":"27AAACJ4649H1ZA","pan":"AAACJ4649H","paymentTerms":"Net 15"}' > /dev/null
echo "  JSW Steel - Wire Division"

post /api/vendors '{"name":"Tata Steel Wire Products","contactPerson":"Anil Sharma","phone":"06572425700","email":"wire@tatasteel.com","address":"Jamshedpur Works","city":"Jamshedpur","state":"Jharkhand","pincode":"831001","gstin":"20AAACT3561Q1ZF","pan":"AAACT3561Q","paymentTerms":"Net 30"}' > /dev/null
echo "  Tata Steel Wire Products"

post /api/vendors '{"name":"Rathi Steel & Power Ltd","contactPerson":"Vikram Rathi","phone":"07314010000","email":"sales@rathisteel.com","address":"Rathi House, Indore","city":"Indore","state":"Madhya Pradesh","pincode":"452001","gstin":"23AAACR2543B1ZK","pan":"AAACR2543B","paymentTerms":"Net 30"}' > /dev/null
echo "  Rathi Steel & Power Ltd"

post /api/vendors '{"name":"Fosroc Chemicals India Pvt Ltd","contactPerson":"David Thomas","phone":"08025503301","email":"sales@fosroc.com","address":"1 Woodside, Whitefield","city":"Bangalore","state":"Karnataka","pincode":"560066","gstin":"29AAACF1234B1ZP","pan":"AAACF1234B","paymentTerms":"Net 30"}' > /dev/null
echo "  Fosroc Chemicals India"

post /api/vendors '{"name":"Sika India Pvt Ltd","contactPerson":"Rajiv Menon","phone":"02066310700","email":"info@sika.com","address":"Kothrud","city":"Pune","state":"Maharashtra","pincode":"411038","gstin":"27AAACS5678C1ZQ","pan":"AAACS5678C","paymentTerms":"Net 30"}' > /dev/null
echo "  Sika India Pvt Ltd"

post /api/vendors '{"name":"Hindustan Zinc Ltd - Aggregate Div","contactPerson":"Harish Gupta","phone":"02942461000","email":"aggregate@hzl.co.in","address":"Yashad Bhawan, Udaipur","city":"Udaipur","state":"Rajasthan","pincode":"313001","gstin":"08AAACH1234D1ZE","pan":"AAACH1234D","paymentTerms":"Net 45"}' > /dev/null
echo "  Hindustan Zinc - Aggregate"

post /api/vendors '{"name":"Nuvoco Vistas Corp Ltd","contactPerson":"Sanjeev Kumar","phone":"02241602000","email":"sales@nuvoco.com","address":"Equinox Business Park, Andheri","city":"Mumbai","state":"Maharashtra","pincode":"400093","gstin":"27AAACN9012E1Z6","pan":"AAACN9012E","paymentTerms":"Net 30"}' > /dev/null
echo "  Nuvoco Vistas Corp Ltd"

echo ""
echo "  ✓ 10 vendors created."

# ── RAW MATERIALS ─────────────────────────────────────────────
echo ""
echo "→ Seeding raw materials..."

create_cat() {
  local name=$1
  local result
  result=$(curl -s -X POST "$BASE/api/categories" -H "$AUTH" -H "$CT" \
    -d "{\"name\":\"$name\",\"description\":\"Raw materials for PCCP pipe production\",\"displayOrder\":99,\"active\":true}")
  local id
  id=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id','') if isinstance(d.get('data'),dict) else '')" 2>/dev/null)
  if [ -z "$id" ]; then
    id=$(curl -s "$BASE/api/categories?search=$(echo $name | sed 's/ /+/g')" -H "$AUTH" | \
      python3 -c "import sys,json; items=json.load(sys.stdin).get('data',{}).get('items',[]); [print(c['id']) for c in items if c.get('name','').lower()=='$(echo $name | tr '[:upper:]' '[:lower:]')']" 2>/dev/null | head -1)
  fi
  echo "$id"
}

create_product() {
  local name=$1 uom=$2 cat_id=$3 reorder=$4
  local body
  body=$(python3 -c "import json; print(json.dumps({'name':'$name','categoryId':$cat_id,'unitOfMeasure':'$uom','sellingPrice':0,'costPrice':0,'productType':'PHYSICAL','itemType':'RAW_MATERIAL','trackInventory':True,'allowNegativeStock':False,'reorderLevel':$reorder,'active':True}))")
  local result
  result=$(curl -s -X POST "$BASE/api/products" -H "$AUTH" -H "$CT" -d "$body")
  local id
  id=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id','') if isinstance(d.get('data'),dict) else '')" 2>/dev/null)
  echo "  $name → id=$id"
}

CAT_ID=$(create_cat "Raw Materials")
echo "  Raw Materials category id=$CAT_ID"
[ -z "$CAT_ID" ] && echo "ERROR: Could not create category" && exit 1

# Spinning materials
create_product "CELL PLATE"             "pcs" "$CAT_ID" 50
create_product "BACK-SHEET"             "pcs" "$CAT_ID" 50
create_product "SPIGOT 6MM"             "pcs" "$CAT_ID" 50
create_product "SPIGOT 8MM"             "pcs" "$CAT_ID" 50
create_product "SPIGOT 10MM"            "pcs" "$CAT_ID" 50
create_product "SOCKET 6MM"             "pcs" "$CAT_ID" 50
create_product "SOCKET 8MM"             "pcs" "$CAT_ID" 50
create_product "SOCKET 10MM"            "pcs" "$CAT_ID" 50
create_product "20MM METAL"             "kg"  "$CAT_ID" 5000
create_product "10MM METAL"             "kg"  "$CAT_ID" 5000
create_product "CRUSHED SAND"           "kg"  "$CAT_ID" 10000
create_product "DUST (CORE)"            "kg"  "$CAT_ID" 5000
create_product "Silo CEMENT (CORE)"     "kg"  "$CAT_ID" 10000
create_product "EXTRA CEMENT"           "kg"  "$CAT_ID" 2000
create_product "CHEMICAL"               "litre" "$CAT_ID" 200
# Winding
create_product "4MM WINDING WIRE"       "kg"  "$CAT_ID" 1000
# Coating
create_product "Silo CEMENT (COATING)"  "kg"  "$CAT_ID" 5000
create_product "LOOSE CEMENT"           "kg"  "$CAT_ID" 2000
create_product "PLASTER SAND"           "kg"  "$CAT_ID" 5000
create_product "C.SAND"                 "kg"  "$CAT_ID" 3000

echo ""
echo "  ✓ 20 raw materials created."

echo ""
echo "========================================================="
echo " Seeding complete for $BASE"
echo "========================================================="
