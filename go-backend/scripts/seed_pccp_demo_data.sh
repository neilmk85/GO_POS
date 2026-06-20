#!/usr/bin/env bash
# Seed PCCP demo data: store materials, low-stock, sales orders,
# production orders (various statuses), production entries, finished pipe stock.
# Usage: ./seed_pccp_demo_data.sh [BASE_URL] [EMAIL] [PASSWORD]

BASE="${1:-http://localhost:8082}"
EMAIL="${2:-admin@pppipeproducts.com}"
PASS="${3:-admin@123}"
CT="Content-Type: application/json"

echo "========================================================="
echo " PCCP Demo Data Seeder — $BASE"
echo "========================================================="

TOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H "$CT" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
[ -z "$TOKEN" ] && echo "ERROR: Login failed" && exit 1
AUTH="Authorization: Bearer $TOKEN"
echo "  Logged in."

# ── helpers ───────────────────────────────────────────────────
get_id() {
  python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  data=d.get('data',{})
  if isinstance(data,dict): print(data.get('id',''))
except: pass
"
}

post() { curl -s -X POST "$BASE$1" -H "$AUTH" -H "$CT" -d "$2"; }
put()  { curl -s -X PUT  "$BASE$1" -H "$AUTH" -H "$CT" -d "$2"; }
ptch() { curl -s -X PATCH "$BASE$1" -H "$AUTH" -H "$CT" -d "$2"; }

show() {
  local r="$1" label="$2"
  local ok msg
  ok=$(echo "$r" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',''))" 2>/dev/null)
  msg=$(echo "$r" | python3 -c "import sys,json; print(json.load(sys.stdin).get('message',''))" 2>/dev/null)
  if [ "$ok" = "True" ]; then
    local id
    id=$(echo "$r" | get_id)
    echo "  + $label (id=$id)"
  else
    echo "  ! $label => $msg"
  fi
}

# ── STORE MATERIALS ───────────────────────────────────────────
echo ""
echo "--- Store Materials ---"

R=$(post /api/categories '{"name":"Store Materials","description":"Factory consumables and PPE","displayOrder":98,"active":true}')
STORE_CAT=$(echo "$R" | get_id)
echo "  Category id=$STORE_CAT"

create_store() {
  local name="$1" uom="$2" reorder="$3" qty="$4"
  local body pid r
  body=$(python3 -c "import json; print(json.dumps({'name':'$name','categoryId':$STORE_CAT,'unitOfMeasure':'$uom','sellingPrice':0,'costPrice':0,'productType':'PHYSICAL','itemType':'STORE_MATERIAL','trackInventory':True,'allowNegativeStock':False,'reorderLevel':$reorder,'active':True}))")
  r=$(post /api/products "$body")
  pid=$(echo "$r" | get_id)
  if [ -n "$pid" ]; then
    local sb
    sb=$(python3 -c "import json; print(json.dumps({'productId':$pid,'outletId':1,'quantity':$qty,'reason':'OPENING_STOCK','notes':'Initial store stock'}))")
    post /api/inventory/adjustments "$sb" > /dev/null
    echo "  + $name (id=$pid) => $qty $uom"
  else
    echo "  ! $name ($(echo $r | python3 -c 'import sys,json; print(json.load(sys.stdin).get("message",""))' 2>/dev/null))"
  fi
}

# Normal stock
create_store "Safety Helmets"     "pcs"   20  80
create_store "Safety Gloves"      "pairs" 50  150
create_store "Safety Boots"       "pairs" 20  40
create_store "Reflective Jackets" "pcs"   15  35
create_store "Hydraulic Oil"      "litre" 50  200
create_store "Machine Grease"     "kg"    20  60
create_store "Cutting Discs"      "pcs"   30  120
create_store "Welding Rods"       "kg"    25  80
create_store "Lifting Slings"     "pcs"   5   18
create_store "Fire Extinguishers" "pcs"   5   14
# Intentionally LOW stock (qty < reorder)
create_store "Diesel"             "litre" 500  80
create_store "Generator Oil"      "litre" 100  12
create_store "Maintenance Paint"  "litre" 30   8
create_store "Grinding Wheels"    "pcs"   50   15

# Also drain two raw materials to trigger Low Stock
echo ""
echo "--- Making raw materials low stock ---"
for SEARCH in "CHEMICAL" "DUST"; do
  PID=$(curl -s "$BASE/api/products?search=$SEARCH&size=5" -H "$AUTH" | python3 -c "
import sys,json
d=json.load(sys.stdin)
items=d.get('data',{}).get('content',d.get('data',{}).get('items',[]))
for i in items:
    n=i.get('name','').upper()
    if '$SEARCH'==n or '$SEARCH' in n.split('(')[0].strip():
        print(i['id']); break
" 2>/dev/null)
  if [ -n "$PID" ]; then
    CUR=$(curl -s "$BASE/api/inventory/outlet/1?productId=$PID" -H "$AUTH" | python3 -c "
import sys,json; d=json.load(sys.stdin)
items=d.get('data',{}).get('content',[])
for i in items:
    if str(i.get('productId',''))==str($PID): print(i.get('quantityOnHand','0')); break
" 2>/dev/null)
    CUR=$(python3 -c "print(int(float('${CUR:-0}')))" 2>/dev/null)
    REORDER=$(curl -s "$BASE/api/products/$PID" -H "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('reorderLevel',0))" 2>/dev/null)
    TARGET=$(python3 -c "print(int($REORDER * 0.2))" 2>/dev/null)
    DELTA=$(python3 -c "print($TARGET - $CUR)" 2>/dev/null)
    SB=$(python3 -c "import json; print(json.dumps({'productId':$PID,'outletId':1,'quantity':$DELTA,'reason':'CONSUMPTION','notes':'Production use — running low'}))")
    post /api/inventory/adjustments "$SB" > /dev/null
    echo "  + $SEARCH (id=$PID) adjusted to $TARGET (reorder=$REORDER) => LOW STOCK"
  fi
done

# ── SALES ORDERS ──────────────────────────────────────────────
echo ""
echo "--- Sales Orders ---"

# Lookup PCCP customer IDs by name
echo "--- Looking up customer IDs ---"
get_customer_id() {
  local search="$1"
  local encoded
  encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$search'))")
  curl -s "$BASE/api/customers?search=$encoded&size=5" -H "$AUTH" | python3 -c "
import sys,json
d=json.load(sys.stdin)
items=d.get('data',{}).get('content',d.get('data',{}).get('items',[]))
s='$search'.lower()
for i in items:
    if s in i.get('name','').lower(): print(i['id']); break
" 2>/dev/null
}

CID_MJP=$(get_customer_id "Maharashtra Jeevan")
CID_PMC=$(get_customer_id "Pune Municipal")
CID_CIDCO=$(get_customer_id "CIDCO")
CID_TMC=$(get_customer_id "Thane Municipal")
CID_LT=$(get_customer_id "L&T Infrastructure")
CID_NMC=$(get_customer_id "Nagpur Municipal")
echo "  MJP=$CID_MJP  PMC=$CID_PMC  CIDCO=$CID_CIDCO  TMC=$CID_TMC  LT=$CID_LT  NMC=$CID_NMC"

# SO1 — MJP Mumbai, DRAFT (small order to stay within credit limit)
R=$(python3 -c "
import json,subprocess,os
body=json.dumps({'customerId':int('$CID_MJP'),'outletId':1,'customerPoNumber':'MJP/26/WS/0451','requiredDate':'2026-12-31T00:00:00Z','paymentTerms':'Net 45','shippingAddress':'Bhandup Pumping Station','shippingCity':'Mumbai','shippingState':'Maharashtra','advanceAmount':500000,'notes':'Bhandup-Vikhroli water main replacement','items':[{'pipeConfigId':33,'productName':'PCCP 600mm 4kg','quantity':50,'unitPrice':28500,'taxRate':18},{'pipeConfigId':35,'productName':'PCCP 600mm 7kg','quantity':30,'unitPrice':38000,'taxRate':18}]})
r=subprocess.run(['curl','-s','-X','POST','$BASE/api/sales-orders','-H','$AUTH','-H','Content-Type: application/json','-d',body],capture_output=True,text=True)
print(r.stdout)
")
SO1=$(echo "$R" | get_id); show "$R" "SO1 MJP Mumbai DRAFT (600mm)"

# SO2 — PMC Pune
R=$(python3 -c "
import json,subprocess
body=json.dumps({'customerId':int('$CID_PMC'),'outletId':1,'customerPoNumber':'PMC/26/IW/0812','requiredDate':'2026-11-15T00:00:00Z','paymentTerms':'Net 30','shippingAddress':'Hadapsar Zone Office','shippingCity':'Pune','shippingState':'Maharashtra','advanceAmount':750000,'notes':'Hadapsar-Kondhwa 24x7 water supply project','items':[{'pipeConfigId':25,'productName':'PCCP 500mm 4kg','quantity':40,'unitPrice':18500,'taxRate':18},{'pipeConfigId':27,'productName':'PCCP 500mm 7kg','quantity':35,'unitPrice':24000,'taxRate':18}]})
r=subprocess.run(['curl','-s','-X','POST','$BASE/api/sales-orders','-H','$AUTH','-H','Content-Type: application/json','-d',body],capture_output=True,text=True)
print(r.stdout)
")
SO2=$(echo "$R" | get_id); show "$R" "SO2 PMC Pune (500mm)"
[ -n "$SO2" ] && ptch /api/sales-orders/$SO2/confirm '' > /dev/null && echo "    => CONFIRMED"

# SO3 — CIDCO Navi Mumbai
R=$(python3 -c "
import json,subprocess
body=json.dumps({'customerId':int('$CID_CIDCO'),'outletId':1,'customerPoNumber':'CIDCO/26/NM/1134','requiredDate':'2026-10-31T00:00:00Z','paymentTerms':'Net 45','shippingAddress':'Sector 9 CBD Belapur','shippingCity':'Navi Mumbai','shippingState':'Maharashtra','advanceAmount':1200000,'notes':'Navi Mumbai water distribution Phase 2','items':[{'pipeConfigId':41,'productName':'PCCP 700mm 4kg','quantity':30,'unitPrice':42000,'taxRate':18},{'pipeConfigId':43,'productName':'PCCP 700mm 7kg','quantity':25,'unitPrice':56000,'taxRate':18}]})
r=subprocess.run(['curl','-s','-X','POST','$BASE/api/sales-orders','-H','$AUTH','-H','Content-Type: application/json','-d',body],capture_output=True,text=True)
print(r.stdout)
")
SO3=$(echo "$R" | get_id); show "$R" "SO3 CIDCO Navi Mumbai (700mm)"
[ -n "$SO3" ] && ptch /api/sales-orders/$SO3/confirm '' > /dev/null && echo "    => CONFIRMED"

# SO4 — TMC Thane
R=$(python3 -c "
import json,subprocess
body=json.dumps({'customerId':int('$CID_TMC'),'outletId':1,'customerPoNumber':'TMC/26/WS/0677','requiredDate':'2026-09-30T00:00:00Z','paymentTerms':'Net 30','shippingAddress':'Majiwada Junction','shippingCity':'Thane','shippingState':'Maharashtra','advanceAmount':600000,'notes':'Majiwada-Manpada trunk main','items':[{'pipeConfigId':9,'productName':'PCCP 400mm 4kg','quantity':60,'unitPrice':12000,'taxRate':18},{'pipeConfigId':11,'productName':'PCCP 400mm 7kg','quantity':40,'unitPrice':16500,'taxRate':18}]})
r=subprocess.run(['curl','-s','-X','POST','$BASE/api/sales-orders','-H','$AUTH','-H','Content-Type: application/json','-d',body],capture_output=True,text=True)
print(r.stdout)
")
SO4=$(echo "$R" | get_id); show "$R" "SO4 TMC Thane (400mm)"
[ -n "$SO4" ] && ptch /api/sales-orders/$SO4/confirm '' > /dev/null && echo "    => CONFIRMED"

# SO5 — L&T Mumbai
R=$(python3 -c "
import json,subprocess
body=json.dumps({'customerId':int('$CID_LT'),'outletId':1,'customerPoNumber':'LT/INFRA/26/MH/0391','requiredDate':'2027-03-31T00:00:00Z','paymentTerms':'Net 60','shippingAddress':'Jogeshwari Metro Depot','shippingCity':'Mumbai','shippingState':'Maharashtra','advanceAmount':2000000,'notes':'Mumbai Metro utility diversion 800mm main','items':[{'pipeConfigId':49,'productName':'PCCP 800mm 4kg','quantity':20,'unitPrice':58000,'taxRate':18},{'pipeConfigId':51,'productName':'PCCP 800mm 7kg','quantity':18,'unitPrice':75000,'taxRate':18}]})
r=subprocess.run(['curl','-s','-X','POST','$BASE/api/sales-orders','-H','$AUTH','-H','Content-Type: application/json','-d',body],capture_output=True,text=True)
print(r.stdout)
")
SO5=$(echo "$R" | get_id); show "$R" "SO5 L&T Mumbai Metro (800mm)"
[ -n "$SO5" ] && ptch /api/sales-orders/$SO5/confirm '' > /dev/null && echo "    => CONFIRMED"

# SO6 — NMC Nagpur JJM
R=$(python3 -c "
import json,subprocess
body=json.dumps({'customerId':int('$CID_NMC'),'outletId':1,'customerPoNumber':'NMC/26/JJM/0229','requiredDate':'2026-12-15T00:00:00Z','paymentTerms':'Net 45','shippingAddress':'Dharampeth Zone','shippingCity':'Nagpur','shippingState':'Maharashtra','advanceAmount':300000,'notes':'Jal Jeevan Mission Dharampeth water upgrade','items':[{'pipeConfigId':1,'productName':'PCCP 350mm 4kg','quantity':80,'unitPrice':8500,'taxRate':18},{'pipeConfigId':3,'productName':'PCCP 350mm 7kg','quantity':50,'unitPrice':11500,'taxRate':18}]})
r=subprocess.run(['curl','-s','-X','POST','$BASE/api/sales-orders','-H','$AUTH','-H','Content-Type: application/json','-d',body],capture_output=True,text=True)
print(r.stdout)
")
SO6=$(echo "$R" | get_id); show "$R" "SO6 NMC Nagpur JJM (350mm)"
[ -n "$SO6" ] && ptch /api/sales-orders/$SO6/confirm '' > /dev/null && echo "    => CONFIRMED"

# ── PRODUCTION ORDERS ─────────────────────────────────────────
echo ""
echo "--- Production Orders ---"

mk_po() {
  local so_id="$1" pipe_cfg="$2" qty="$3" start="$4" end="$5" note="$6"
  python3 -c "
import json, subprocess
body = json.dumps({
  'salesOrderId': $so_id if $so_id else None,
  'pipeConfigId': $pipe_cfg,
  'outletId': 1,
  'plannedQty': $qty,
  'plannedStartDate': '${start}T00:00:00Z',
  'plannedEndDate':   '${end}T00:00:00Z',
  'notes': '$note'
})
r = subprocess.run(['curl','-s','-X','POST','$BASE/api/production/orders',
  '-H','$AUTH','-H','Content-Type: application/json','-d',body],
  capture_output=True, text=True)
print(r.stdout)
"
}

po_status() { ptch /api/production/orders/$1/status "{\"status\":\"$2\"}" > /dev/null; }

# PO-A DRAFT — SO1, 600mm 4kg (stays DRAFT)
R=$(mk_po $SO1 33 500 "2026-07-01" "2026-11-30" "MJP Mumbai 600mm 4kg batch 1")
POA=$(echo "$R" | get_id); show "$R" "PO-A DRAFT — 600mm 4kg x500 (MJP)"

# PO-B PLANNED — SO2, 500mm 4kg
R=$(mk_po $SO2 25 400 "2026-06-15" "2026-10-15" "PMC Pune 500mm 4kg")
POB=$(echo "$R" | get_id); show "$R" "PO-B PLANNED — 500mm 4kg x400 (PMC)"
[ -n "$POB" ] && po_status $POB "PLANNED" && echo "    => PLANNED"

# PO-C PLANNED — SO2, 500mm 7kg
R=$(mk_po $SO2 27 350 "2026-07-15" "2026-10-31" "PMC Pune 500mm 7kg")
POC=$(echo "$R" | get_id); show "$R" "PO-C PLANNED — 500mm 7kg x350 (PMC)"
[ -n "$POC" ] && po_status $POC "PLANNED" && echo "    => PLANNED"

# PO-D IN_PROGRESS — SO3, 700mm 4kg
R=$(mk_po $SO3 41 300 "2026-04-01" "2026-09-30" "CIDCO Navi Mumbai 700mm 4kg")
POD=$(echo "$R" | get_id); show "$R" "PO-D IN_PROGRESS — 700mm 4kg x300 (CIDCO)"
[ -n "$POD" ] && po_status $POD "IN_PROGRESS" && echo "    => IN_PROGRESS"

# PO-E IN_PROGRESS — SO4, 400mm 4kg
R=$(mk_po $SO4 9 600 "2026-03-15" "2026-08-31" "TMC Thane 400mm 4kg")
POE=$(echo "$R" | get_id); show "$R" "PO-E IN_PROGRESS — 400mm 4kg x600 (TMC)"
[ -n "$POE" ] && po_status $POE "IN_PROGRESS" && echo "    => IN_PROGRESS"

# PO-F ON_HOLD — SO4, 400mm 7kg (will be set to ON_HOLD after entries)
R=$(mk_po $SO4 11 400 "2026-04-01" "2026-09-30" "TMC Thane 400mm 7kg")
POF=$(echo "$R" | get_id); show "$R" "PO-F (ON_HOLD later) — 400mm 7kg x400 (TMC)"
[ -n "$POF" ] && po_status $POF "IN_PROGRESS"

# PO-G COMPLETED — SO6, 350mm 4kg first batch (will be COMPLETED after entries)
R=$(mk_po $SO6 1 200 "2026-02-01" "2026-05-31" "NMC Nagpur 350mm 4kg first batch")
POG=$(echo "$R" | get_id); show "$R" "PO-G (COMPLETED later) — 350mm 4kg x200 (NMC)"
[ -n "$POG" ] && po_status $POG "IN_PROGRESS"

# PO-H IN_PROGRESS advanced — SO5, 800mm 4kg
R=$(mk_po $SO5 49 200 "2026-05-15" "2026-11-30" "L&T Mumbai Metro 800mm 4kg")
POH=$(echo "$R" | get_id); show "$R" "PO-H IN_PROGRESS advanced — 800mm 4kg x200 (L&T)"
[ -n "$POH" ] && po_status $POH "IN_PROGRESS" && echo "    => IN_PROGRESS"

# ── PRODUCTION ENTRIES ────────────────────────────────────────
echo ""
echo "--- Production Entries ---"

entry() {
  local po_id="$1" stage="$2" proc="$3" comp="$4" date="$5" note="$6"
  local bed_type=""
  [ "$stage" = "DEMOULDING" ] && bed_type='"bedType":"LARGE_BED",'
  local body r ok
  body=$(python3 -c "
import json
d={'productionOrderId':$po_id,'stageType':'$stage','pipesProcessed':$proc,'pipesCompleted':$comp,'entryDate':'${date}T08:00:00Z','notes':'$note'}
if '$stage'=='DEMOULDING': d['bedType']='LARGE_BED'
print(json.dumps(d))")
  r=$(post /api/production/entries "$body")
  ok=$(echo "$r" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok' if d.get('success') else 'err:'+d.get('message','')[:50])" 2>/dev/null)
  echo "  $po_id/$stage p=$proc c=$comp [$ok]"
}

# PO-D (CIDCO 700mm 4kg x300) — through CURING_1
if [ -n "$POD" ]; then
  entry $POD "FABRICATION"         300 298 "2026-04-05" "Cell plate fabrication"
  entry $POD "FABRICATION_TESTING" 298 295 "2026-04-07" "Hydrostatic section test"
  entry $POD "MOULDING"            295 292 "2026-04-10" "Core moulding with spigot socket"
  entry $POD "SPINNING"            292 288 "2026-04-13" "Centrifugal spinning core"
  entry $POD "DEMOULDING"          288 285 "2026-04-18" "Demoulding after set"
  entry $POD "CURING_1"            285 282 "2026-04-28" "Water curing cycle 1"
fi

# PO-E (TMC 400mm 4kg x600) — through WINDING (stage order: FAB→FAB_TEST→MOULD→SPIN→DEMOULD→CURING_1→WINDING→COATING→CURING_2→FINAL)
if [ -n "$POE" ]; then
  entry $POE "FABRICATION"         600 596 "2026-03-20" "Fabrication"
  entry $POE "FABRICATION_TESTING" 596 592 "2026-03-22" "Testing"
  entry $POE "MOULDING"            592 588 "2026-03-26" "Moulding"
  entry $POE "SPINNING"            588 583 "2026-03-30" "Spinning"
  entry $POE "DEMOULDING"          583 578 "2026-04-05" "Demoulding"
  entry $POE "CURING_1"            578 575 "2026-04-20" "Curing 1"
  entry $POE "WINDING"             575 571 "2026-05-10" "Pre-stress wire winding"
fi

# PO-F (TMC 400mm 7kg x400) — partial then ON_HOLD
if [ -n "$POF" ]; then
  entry $POF "FABRICATION"         400 397 "2026-04-05" "Fabrication"
  entry $POF "FABRICATION_TESTING" 397 394 "2026-04-07" "Testing"
  entry $POF "MOULDING"            394 390 "2026-04-10" "Moulding"
  entry $POF "SPINNING"            390 386 "2026-04-14" "Spinning"
  R=$(ptch /api/production/orders/$POF/status '{"status":"ON_HOLD","holdReason":"4mm winding wire shortage — awaiting delivery from JSW Steel. Estimated 2 weeks.","holdQtyProduced":386}')
  show "$R" "PO-F ON_HOLD (wire shortage)"
fi

# PO-G (NMC 350mm 4kg x200) — ALL 10 stages then COMPLETED
# Correct order: FAB→FAB_TEST→MOULD→SPIN→DEMOULD→CURING_1→WINDING→COATING→CURING_2→FINAL_TEST
if [ -n "$POG" ]; then
  entry $POG "FABRICATION"         200 200 "2026-02-05" "Fabrication"
  entry $POG "FABRICATION_TESTING" 200 199 "2026-02-07" "Testing"
  entry $POG "MOULDING"            199 198 "2026-02-10" "Moulding"
  entry $POG "SPINNING"            198 197 "2026-02-14" "Spinning"
  entry $POG "DEMOULDING"          197 196 "2026-02-18" "Demoulding"
  entry $POG "CURING_1"            196 195 "2026-03-01" "Curing 1 — 21 days"
  entry $POG "WINDING"             195 194 "2026-04-01" "Pre-stress winding"
  entry $POG "COATING"             194 193 "2026-04-10" "Cement mortar coating"
  entry $POG "CURING_2"            193 192 "2026-04-22" "Final curing"
  entry $POG "FINAL_TESTING"       192 191 "2026-04-28" "Hydrostatic final test — passed"
  R=$(ptch /api/production/orders/$POG/status '{"status":"COMPLETED"}')
  show "$R" "PO-G COMPLETED"
fi

# PO-H (L&T 800mm 4kg x200) — through COATING
# Stage order: FAB→FAB_TEST→MOULD→SPIN→DEMOULD→CURING_1→WINDING→COATING
if [ -n "$POH" ]; then
  entry $POH "FABRICATION"         200 199 "2026-05-18" "Fabrication"
  entry $POH "FABRICATION_TESTING" 199 198 "2026-05-20" "Testing"
  entry $POH "MOULDING"            198 197 "2026-05-24" "Moulding"
  entry $POH "SPINNING"            197 196 "2026-05-28" "Spinning"
  entry $POH "DEMOULDING"          196 195 "2026-06-02" "Demoulding"
  entry $POH "CURING_1"            195 194 "2026-06-15" "Curing 1"
  entry $POH "WINDING"             194 193 "2026-07-15" "Pre-stress winding"
  entry $POH "COATING"             193 192 "2026-07-22" "Cement mortar coating"
fi

# ── FINISHED PIPE STOCK ───────────────────────────────────────
echo ""
echo "--- Finished Pipe Stock ---"

R=$(post /api/categories '{"name":"Finished PCCP Pipes","description":"Ready-to-dispatch PCCP pipes","displayOrder":97,"active":true}')
PIPE_CAT=$(echo "$R" | get_id)
echo "  Category id=$PIPE_CAT"

pipe_stock() {
  local name="$1" qty="$2" reorder="$3"
  local body pid r sb
  body=$(python3 -c "import json; print(json.dumps({'name':'$name','categoryId':$PIPE_CAT,'unitOfMeasure':'nos','sellingPrice':0,'costPrice':0,'productType':'PHYSICAL','itemType':'FINISHED_PIPE','trackInventory':True,'allowNegativeStock':False,'reorderLevel':$reorder,'active':True}))")
  r=$(post /api/products "$body")
  pid=$(echo "$r" | get_id)
  if [ -n "$pid" ]; then
    sb=$(python3 -c "import json; print(json.dumps({'productId':$pid,'outletId':1,'quantity':$qty,'reason':'PRODUCTION_COMPLETE','notes':'Passed final testing — ready for dispatch'}))")
    post /api/inventory/adjustments "$sb" > /dev/null
    echo "  + $name (id=$pid) => $qty nos"
  else
    echo "  ! $name ($(echo "$r" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("message",""))' 2>/dev/null))"
  fi
}

pipe_stock "PCCP 350mm 4kg"  191  50
pipe_stock "PCCP 350mm 7kg"  125  30
pipe_stock "PCCP 400mm 4kg"   85  30
pipe_stock "PCCP 400mm 7kg"   64  25
pipe_stock "PCCP 500mm 4kg"   48  20
pipe_stock "PCCP 500mm 7kg"   72  20
pipe_stock "PCCP 600mm 4kg"   38  15
pipe_stock "PCCP 700mm 4kg"   22  10
pipe_stock "PCCP 800mm 4kg"   15  10
pipe_stock "PCCP 900mm 7kg"    8   5

echo ""
echo "========================================================="
echo " Done — $BASE"
echo "========================================================="
