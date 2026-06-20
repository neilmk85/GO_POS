#!/usr/bin/env bash
# Seed demo data: machines, shifts, overhead configs, production order + entries
# set -e  # disabled so we see all output on partial failures

BASE="http://localhost:8080"
OUTLET_ID=1

echo "========================================================="
echo " PCCP Demo Data Seeder"
echo "========================================================="

# ── Auth ──────────────────────────────────────────────────────
echo ""
echo "→ Logging in..."
TOKEN=$(curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pos.com","password":"Admin@123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")
echo "  Token obtained."

AUTH="-H \"Authorization: Bearer $TOKEN\""

api_post() {
  local path=$1
  local body=$2
  curl -s -X POST "$BASE$path" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$body"
}

api_patch() {
  local path=$1
  local body=$2
  curl -s -X PATCH "$BASE$path" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$body"
}

api_get() {
  local path=$1
  curl -s "$BASE$path" -H "Authorization: Bearer $TOKEN"
}

# ── Shift Templates ───────────────────────────────────────────
echo ""
echo "→ Creating shift templates..."

for shift in \
  '{"outletId":1,"shiftName":"A","startTime":"06:00","endTime":"14:00","active":true}' \
  '{"outletId":1,"shiftName":"B","startTime":"14:00","endTime":"22:00","active":true}' \
  '{"outletId":1,"shiftName":"C","startTime":"22:00","endTime":"06:00","active":true}'
do
  NAME=$(echo $shift | python3 -c "import sys,json; print(json.load(sys.stdin)['shiftName'])")
  RES=$(api_post "/api/production/shift-templates" "$shift")
  ID=$(echo $RES | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id','?'))" 2>/dev/null)
  echo "  Shift $NAME → id=$ID"
done

# ── Machines ──────────────────────────────────────────────────
echo ""
echo "→ Creating production machines..."

MACHINES=(
  '{"machineCode":"SPM-01","name":"Spinning Machine 1","machineType":"SPINNING","outletId":1,"capacity":12,"hourlyRate":450}'
  '{"machineCode":"SPM-02","name":"Spinning Machine 2","machineType":"SPINNING","outletId":1,"capacity":12,"hourlyRate":450}'
  '{"machineCode":"WND-01","name":"Winding Machine 1","machineType":"WINDING","outletId":1,"capacity":20,"hourlyRate":380}'
  '{"machineCode":"CTG-01","name":"Coating Machine 1","machineType":"COATING","outletId":1,"capacity":25,"hourlyRate":320}'
  '{"machineCode":"FAB-01","name":"Fabrication Machine 1","machineType":"FABRICATION","outletId":1,"capacity":30,"hourlyRate":280}'
  '{"machineCode":"CUR-01","name":"Curing Bed 1","machineType":"CURING","outletId":1,"capacity":50,"hourlyRate":120}'
)

declare -a MACHINE_IDS
for m in "${MACHINES[@]}"; do
  CODE=$(echo $m | python3 -c "import sys,json; print(json.load(sys.stdin)['machineCode'])")
  RES=$(api_post "/api/production/machines" "$m")
  ID=$(echo $RES | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id','?'))" 2>/dev/null)
  MACHINE_IDS+=($ID)
  echo "  $CODE → id=$ID"
done

# ── Overhead Configs ──────────────────────────────────────────
echo ""
echo "→ Creating overhead configs..."

OVERHEADS=(
  '{"outletId":1,"name":"Factory Overhead","description":"General factory running costs","ratePerPipe":250}'
  '{"outletId":1,"name":"Electricity","description":"Power consumption per pipe","ratePerPipe":85}'
  '{"outletId":1,"name":"Labour Overhead","description":"Indirect labour costs","ratePerPipe":120}'
  '{"outletId":1,"name":"Depreciation","description":"Machinery depreciation","ratePerPipe":65}'
)

for o in "${OVERHEADS[@]}"; do
  NAME=$(echo $o | python3 -c "import sys,json; print(json.load(sys.stdin)['name'])")
  RES=$(api_post "/api/production/overhead-configs" "$o")
  ID=$(echo $RES | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id','?'))" 2>/dev/null)
  echo "  $NAME → id=$ID"
done

# ── Pipe Config lookup: 600mm / 10kg ─────────────────────────
echo ""
echo "→ Looking up pipe config (600mm / 10kg)..."
PC_RES=$(api_get "/api/production/pipe-configs/lookup?diameterMm=600&pressureClass=10kg")
PC_ID=$(echo $PC_RES | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
PC_NAME=$(echo $PC_RES | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['name'])" 2>/dev/null)
echo "  Found: $PC_NAME (id=$PC_ID)"

# ── Production Order ──────────────────────────────────────────
echo ""
echo "→ Creating production order..."
PO_BODY="{\"pipeConfigId\":$PC_ID,\"outletId\":$OUTLET_ID,\"plannedQty\":50,\"plannedStartDate\":\"2026-04-01T00:00:00Z\",\"plannedEndDate\":\"2026-04-30T00:00:00Z\",\"notes\":\"Demo order - 600mm 10kg, qty 50\"}"
PO_RES=$(api_post "/api/production/orders" "$PO_BODY")
PO_ID=$(echo $PO_RES | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
PO_NUM=$(echo $PO_RES | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['poNumber'])" 2>/dev/null)
echo "  Created: $PO_NUM (id=$PO_ID)"

# Move to IN_PROGRESS
api_patch "/api/production/orders/$PO_ID/status" '{"status":"IN_PROGRESS"}' > /dev/null
echo "  Status → IN_PROGRESS"

# ── Production Entries (stages 1–6) ──────────────────────────
echo ""
echo "→ Adding production entries..."

FAB_M=${MACHINE_IDS[4]}   # FAB-01
SPM_M=${MACHINE_IDS[0]}   # SPM-01
WND_M=${MACHINE_IDS[2]}   # WND-01
CTG_M=${MACHINE_IDS[3]}   # CTG-01
CUR_M=${MACHINE_IDS[5]}   # CUR-01

ENTRIES=(
  "{\"productionOrderId\":$PO_ID,\"pipeConfigId\":$PC_ID,\"outletId\":$OUTLET_ID,\"stageType\":\"FABRICATION\",\"pipesProcessed\":50,\"pipesCompleted\":50,\"pipesRejected\":0,\"entryDate\":\"2026-04-01T00:00:00Z\",\"shiftName\":\"A\",\"machineId\":$FAB_M,\"notes\":\"Fabrication complete\"}"
  "{\"productionOrderId\":$PO_ID,\"pipeConfigId\":$PC_ID,\"outletId\":$OUTLET_ID,\"stageType\":\"FABRICATION_TESTING\",\"pipesProcessed\":50,\"pipesCompleted\":48,\"pipesRejected\":2,\"entryDate\":\"2026-04-02T00:00:00Z\",\"shiftName\":\"A\",\"notes\":\"2 rejected on visual inspection\"}"
  "{\"productionOrderId\":$PO_ID,\"pipeConfigId\":$PC_ID,\"outletId\":$OUTLET_ID,\"stageType\":\"MOULDING\",\"pipesProcessed\":48,\"pipesCompleted\":48,\"pipesRejected\":0,\"entryDate\":\"2026-04-03\",\"shiftName\":\"A\",\"machineId\":$FAB_M}"
  "{\"productionOrderId\":$PO_ID,\"pipeConfigId\":$PC_ID,\"outletId\":$OUTLET_ID,\"stageType\":\"SPINNING\",\"pipesProcessed\":48,\"pipesCompleted\":47,\"pipesRejected\":1,\"entryDate\":\"2026-04-05\",\"shiftName\":\"A\",\"machineId\":$SPM_M}"
  "{\"productionOrderId\":$PO_ID,\"pipeConfigId\":$PC_ID,\"outletId\":$OUTLET_ID,\"stageType\":\"DEMOULDING\",\"pipesProcessed\":47,\"pipesCompleted\":47,\"pipesRejected\":0,\"entryDate\":\"2026-04-06\",\"shiftName\":\"B\",\"bedType\":\"LARGE_BED\"}"
  "{\"productionOrderId\":$PO_ID,\"pipeConfigId\":$PC_ID,\"outletId\":$OUTLET_ID,\"stageType\":\"CURING_1\",\"pipesProcessed\":47,\"pipesCompleted\":47,\"pipesRejected\":0,\"entryDate\":\"2026-04-10\",\"shiftName\":\"A\",\"machineId\":$CUR_M,\"notes\":\"7 day curing complete\"}"
  "{\"productionOrderId\":$PO_ID,\"pipeConfigId\":$PC_ID,\"outletId\":$OUTLET_ID,\"stageType\":\"WINDING\",\"pipesProcessed\":47,\"pipesCompleted\":46,\"pipesRejected\":1,\"entryDate\":\"2026-04-12\",\"shiftName\":\"A\",\"machineId\":$WND_M}"
  "{\"productionOrderId\":$PO_ID,\"pipeConfigId\":$PC_ID,\"outletId\":$OUTLET_ID,\"stageType\":\"COATING\",\"pipesProcessed\":46,\"pipesCompleted\":46,\"pipesRejected\":0,\"entryDate\":\"2026-04-13\",\"shiftName\":\"B\",\"machineId\":$CTG_M}"
  "{\"productionOrderId\":$PO_ID,\"pipeConfigId\":$PC_ID,\"outletId\":$OUTLET_ID,\"stageType\":\"FINAL_TESTING\",\"pipesProcessed\":46,\"pipesCompleted\":45,\"pipesRejected\":1,\"entryDate\":\"2026-04-14\",\"shiftName\":\"A\",\"notes\":\"1 failed hydrostatic test\"}"
)

STAGE_NAMES=("FABRICATION" "FABRICATION_TESTING" "MOULDING" "SPINNING" "DEMOULDING" "CURING_1" "WINDING" "COATING" "FINAL_TESTING")

for i in "${!ENTRIES[@]}"; do
  RES=$(api_post "/api/production/entries" "${ENTRIES[$i]}")
  ENTRY_ID=$(echo $RES | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id','ERR: '+d.get('message','?')))" 2>/dev/null)
  echo "  ${STAGE_NAMES[$i]} → entry id=$ENTRY_ID"
done

# ── Compute cost sheet ────────────────────────────────────────
echo ""
echo "→ Computing cost sheet..."
CS_RES=$(api_post "/api/production/orders/$PO_ID/cost-sheet/compute" "{}")
COST=$(echo $CS_RES | python3 -c "import sys,json; d=json.load(sys.stdin); cs=d.get('data',{}); print(f\"total=₹{float(cs.get('totalCost',0)):,.2f}  per_pipe=₹{float(cs.get('costPerPipe',0)):,.2f}\")" 2>/dev/null)
echo "  $COST"

echo ""
echo "========================================================="
echo " Done! Summary:"
echo "  • 3 shift templates (A / B / C)"
echo "  • 6 machines (Fab / Spinning×2 / Winding / Coating / Curing)"
echo "  • 4 overhead configs  (total ₹520/pipe)"
echo "  • 1 production order  $PO_NUM  — 600mm 10kg  qty=50"
echo "  • 9 stage entries     (all stages complete, 45 final tested)"
echo "  • Cost sheet computed"
echo "========================================================="
echo ""
echo "  Open http://localhost:3003 → Production → Production Orders"
