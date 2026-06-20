#!/bin/bash
# Seed dummy transportation / loading records for the Transport Report

BASE_URL="http://localhost:8080"
CT="Content-Type: application/json"

# ── Auth: get a fresh token ───────────────────────────────────────────────────
echo "========================================="
echo " Transport Dummy Data Seeder"
echo "========================================="
echo ""
echo "→ Authenticating..."

AUTH_RESP=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "$CT" \
  -d '{"email":"admin@pos.com","password":"admin123"}')

TOKEN=$(echo "$AUTH_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('data', {}).get('accessToken', '') or d.get('token', '') or d.get('data', {}).get('token', ''))
" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "  ⚠  Could not get token automatically. Using hardcoded fallback..."
  TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQHBvcy5jb20iLCJ0eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc4NTM3MjIwLCJpYXQiOjE3NzU5NDUyMjB9.3ipSwmpt8I0uzIBnxqvmP6K9y5Ko4v4hzkJisfERWR0"
fi

AUTH_HEADER="Authorization: Bearer $TOKEN"
echo "  ✓ Ready"

post() {
  local body=$1
  curl -s -X POST "$BASE_URL/api/business/loading-records" \
    -H "$AUTH_HEADER" \
    -H "$CT" \
    -d "$body" > /dev/null
}

echo ""
echo "→ Inserting loading records..."

# ── Vendor: Sharma Transport Co ──────────────────────────────────────────────
post '{"date":"2026-03-01","pipeName":"PCCP 600mm Class 3","quantity":20,"vehicleNo":"MH 12 AB 1234","driverName":"Rajesh Sharma","driverContact":"+91 98765 43210","vendor":"Sharma Transport Co","siteAddress":"Sector 12, Navi Mumbai, Maharashtra","transportRate":"850","notes":"First batch of month"}'
echo "  ✓ 01-Mar Sharma Transport – PCCP 600mm ×20"

post '{"date":"2026-03-05","pipeName":"PCCP 800mm Class 2","quantity":15,"vehicleNo":"MH 12 CD 5678","driverName":"Suresh Kumar","driverContact":"+91 98765 43211","vendor":"Sharma Transport Co","siteAddress":"Thane West Industrial Estate, Maharashtra","transportRate":"1100","notes":"Fragile – handle with care"}'
echo "  ✓ 05-Mar Sharma Transport – PCCP 800mm ×15"

post '{"date":"2026-03-12","pipeName":"PCCP 600mm Class 3","quantity":25,"vehicleNo":"MH 12 AB 1234","driverName":"Rajesh Sharma","driverContact":"+91 98765 43210","vendor":"Sharma Transport Co","siteAddress":"Kalyan Shil Road, Thane, Maharashtra","transportRate":"850","notes":""}'
echo "  ✓ 12-Mar Sharma Transport – PCCP 600mm ×25"

post '{"date":"2026-03-18","pipeName":"PSC 500mm NP3","quantity":30,"vehicleNo":"MH 12 EF 9012","driverName":"Manoj Patil","driverContact":"+91 97654 32109","vendor":"Sharma Transport Co","siteAddress":"Pune-Nashik Highway, Pune, Maharashtra","transportRate":"780","notes":"Night delivery"}'
echo "  ✓ 18-Mar Sharma Transport – PSC 500mm ×30"

# ── Vendor: Ganesh Carriers ───────────────────────────────────────────────────
post '{"date":"2026-03-03","pipeName":"PCCP 1000mm Class 1","quantity":10,"vehicleNo":"GJ 05 XY 2233","driverName":"Bhavesh Patel","driverContact":"+91 96321 54780","vendor":"Ganesh Carriers","siteAddress":"GIDC Phase 4, Ankleshwar, Gujarat","transportRate":"1450","notes":"Long haul – 2 day delivery"}'
echo "  ✓ 03-Mar Ganesh Carriers – PCCP 1000mm ×10"

post '{"date":"2026-03-08","pipeName":"PCCP 800mm Class 2","quantity":12,"vehicleNo":"GJ 05 XY 2233","driverName":"Bhavesh Patel","driverContact":"+91 96321 54780","vendor":"Ganesh Carriers","siteAddress":"Surat Ring Road Project, Surat, Gujarat","transportRate":"1350","notes":""}'
echo "  ✓ 08-Mar Ganesh Carriers – PCCP 800mm ×12"

post '{"date":"2026-03-15","pipeName":"PSC 600mm NP2","quantity":18,"vehicleNo":"GJ 06 PQ 7788","driverName":"Ketan Desai","driverContact":"+91 99870 12345","vendor":"Ganesh Carriers","siteAddress":"Vadodara Water Supply Dept, Vadodara, Gujarat","transportRate":"1200","notes":"COD payment"}'
echo "  ✓ 15-Mar Ganesh Carriers – PSC 600mm ×18"

post '{"date":"2026-03-22","pipeName":"PCCP 1200mm Class 1","quantity":8,"vehicleNo":"GJ 05 XY 2233","driverName":"Bhavesh Patel","driverContact":"+91 96321 54780","vendor":"Ganesh Carriers","siteAddress":"Ahmedabad Metro Project, Ahmedabad, Gujarat","transportRate":"1800","notes":"Crane required at site"}'
echo "  ✓ 22-Mar Ganesh Carriers – PCCP 1200mm ×8"

# ── Vendor: Ravi Logistics ────────────────────────────────────────────────────
post '{"date":"2026-03-06","pipeName":"PSC 500mm NP3","quantity":22,"vehicleNo":"MP 09 LM 4455","driverName":"Arvind Tiwari","driverContact":"+91 94567 89012","vendor":"Ravi Logistics","siteAddress":"Indore-Ujjain Road, Indore, MP","transportRate":"920","notes":""}'
echo "  ✓ 06-Mar Ravi Logistics – PSC 500mm ×22"

post '{"date":"2026-03-14","pipeName":"PCCP 600mm Class 3","quantity":18,"vehicleNo":"MP 09 LM 4455","driverName":"Arvind Tiwari","driverContact":"+91 94567 89012","vendor":"Ravi Logistics","siteAddress":"Bhopal Municipal Corporation Site, Bhopal, MP","transportRate":"950","notes":"Part payment received"}'
echo "  ✓ 14-Mar Ravi Logistics – PCCP 600mm ×18"

post '{"date":"2026-03-20","pipeName":"PSC 400mm NP4","quantity":35,"vehicleNo":"MP 10 RS 6677","driverName":"Santosh Yadav","driverContact":"+91 91234 56789","vendor":"Ravi Logistics","siteAddress":"Jabalpur Smart City, Jabalpur, MP","transportRate":"680","notes":"Priority dispatch"}'
echo "  ✓ 20-Mar Ravi Logistics – PSC 400mm ×35"

post '{"date":"2026-03-27","pipeName":"PCCP 800mm Class 2","quantity":14,"vehicleNo":"MP 09 LM 4455","driverName":"Arvind Tiwari","driverContact":"+91 94567 89012","vendor":"Ravi Logistics","siteAddress":"Indore Water Project Phase 2, Indore, MP","transportRate":"1100","notes":""}'
echo "  ✓ 27-Mar Ravi Logistics – PCCP 800mm ×14"

# ── Vendor: Krishna Road Carriers ────────────────────────────────────────────
post '{"date":"2026-03-04","pipeName":"PSC 600mm NP2","quantity":20,"vehicleNo":"RJ 14 GH 3344","driverName":"Hari Singh Rathod","driverContact":"+91 93456 78901","vendor":"Krishna Road Carriers","siteAddress":"Jaipur Water Supply Line, Jaipur, Rajasthan","transportRate":"1050","notes":""}'
echo "  ✓ 04-Mar Krishna Road Carriers – PSC 600mm ×20"

post '{"date":"2026-03-11","pipeName":"PCCP 600mm Class 3","quantity":16,"vehicleNo":"RJ 14 GH 3344","driverName":"Hari Singh Rathod","driverContact":"+91 93456 78901","vendor":"Krishna Road Carriers","siteAddress":"Ajmer District Water Project, Ajmer, Rajasthan","transportRate":"990","notes":"Cash on delivery"}'
echo "  ✓ 11-Mar Krishna Road Carriers – PCCP 600mm ×16"

post '{"date":"2026-03-25","pipeName":"PSC 800mm NP1","quantity":9,"vehicleNo":"RJ 20 VW 5566","driverName":"Gopal Meena","driverContact":"+91 92345 67890","vendor":"Krishna Road Carriers","siteAddress":"Bikaner Municipal Pipeline, Bikaner, Rajasthan","transportRate":"1380","notes":"Escort required"}'
echo "  ✓ 25-Mar Krishna Road Carriers – PSC 800mm ×9"

# ── April 2026 entries (recent) ────────────────────────────────────────────────
post '{"date":"2026-04-02","pipeName":"PCCP 600mm Class 3","quantity":24,"vehicleNo":"MH 12 AB 1234","driverName":"Rajesh Sharma","driverContact":"+91 98765 43210","vendor":"Sharma Transport Co","siteAddress":"Sector 12, Navi Mumbai, Maharashtra","transportRate":"860","notes":"Rate revised from March"}'
echo "  ✓ 02-Apr Sharma Transport – PCCP 600mm ×24"

post '{"date":"2026-04-05","pipeName":"PSC 500mm NP3","quantity":28,"vehicleNo":"GJ 06 PQ 7788","driverName":"Ketan Desai","driverContact":"+91 99870 12345","vendor":"Ganesh Carriers","siteAddress":"Rajkot Water Works, Rajkot, Gujarat","transportRate":"790","notes":""}'
echo "  ✓ 05-Apr Ganesh Carriers – PSC 500mm ×28"

post '{"date":"2026-04-08","pipeName":"PCCP 1000mm Class 1","quantity":11,"vehicleNo":"MP 10 RS 6677","driverName":"Santosh Yadav","driverContact":"+91 91234 56789","vendor":"Ravi Logistics","siteAddress":"Nagpur Metro Water Line, Nagpur, Maharashtra","transportRate":"1500","notes":"Oversized load permit required"}'
echo "  ✓ 08-Apr Ravi Logistics – PCCP 1000mm ×11"

post '{"date":"2026-04-10","pipeName":"PSC 400mm NP4","quantity":40,"vehicleNo":"RJ 14 GH 3344","driverName":"Hari Singh Rathod","driverContact":"+91 93456 78901","vendor":"Krishna Road Carriers","siteAddress":"Jodhpur Irrigation Dept, Jodhpur, Rajasthan","transportRate":"700","notes":"Two trucks"}'
echo "  ✓ 10-Apr Krishna Road Carriers – PSC 400mm ×40"

post '{"date":"2026-04-12","pipeName":"PCCP 800mm Class 2","quantity":17,"vehicleNo":"MH 12 CD 5678","driverName":"Suresh Kumar","driverContact":"+91 98765 43211","vendor":"Sharma Transport Co","siteAddress":"Pune Ring Road Project, Pune, Maharashtra","transportRate":"1150","notes":""}'
echo "  ✓ 12-Apr Sharma Transport – PCCP 800mm ×17"

post '{"date":"2026-04-15","pipeName":"PSC 600mm NP2","quantity":21,"vehicleNo":"GJ 05 XY 2233","driverName":"Bhavesh Patel","driverContact":"+91 96321 54780","vendor":"Ganesh Carriers","siteAddress":"Gandhinagar Smart City Project, Gandhinagar, Gujarat","transportRate":"1220","notes":"Final leg of phase 1"}'
echo "  ✓ 15-Apr Ganesh Carriers – PSC 600mm ×21"

echo ""
echo "========================================="
echo " ✓ Done! $(curl -s "$BASE_URL/api/business/loading-records" -H "$AUTH_HEADER" | python3 -c "import sys,json; d=json.load(sys.stdin); rows=d.get('data',[]); print(len(rows) if isinstance(rows,list) else '?')" 2>/dev/null) loading records now in DB"
echo "========================================="
