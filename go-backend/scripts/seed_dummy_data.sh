#!/bin/bash
# Seed dummy data: categories, vendors, customers, products

BASE_URL="http://localhost:8080"
AUTH_HEADER="Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQHBvcy5jb20iLCJ0eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc4NTM3MjIwLCJpYXQiOjE3NzU5NDUyMjB9.3ipSwmpt8I0uzIBnxqvmP6K9y5Ko4v4hzkJisfERWR0"
CT="Content-Type: application/json"

post() {
  local endpoint=$1
  local body=$2
  local result=$(curl -s -X POST "$BASE_URL$endpoint" -H "$AUTH_HEADER" -H "$CT" -d "$body")
  local id=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id','') if isinstance(d.get('data'),dict) else '')" 2>/dev/null)
  echo "$id"
}

echo "========================================="
echo " PP Pipes Products - Dummy Data Seeder"
echo "========================================="

# ─────────────────────────────────────────────
# 1. CATEGORIES
# ─────────────────────────────────────────────
echo ""
echo "→ Creating categories..."

CAT_PIPES=$(post /api/categories '{"name":"Pipes & Tubes","description":"All types of pipes and tubes","displayOrder":1,"active":true}')
echo "  Pipes & Tubes: id=$CAT_PIPES"

CAT_FITTINGS=$(post /api/categories '{"name":"Fittings & Connectors","description":"Pipe fittings, elbows, tees, reducers","displayOrder":2,"active":true}')
echo "  Fittings & Connectors: id=$CAT_FITTINGS"

CAT_VALVES=$(post /api/categories '{"name":"Valves & Controls","description":"Ball valves, gate valves, check valves","displayOrder":3,"active":true}')
echo "  Valves & Controls: id=$CAT_VALVES"

CAT_TOOLS=$(post /api/categories '{"name":"Tools & Equipment","description":"Plumbing and pipe installation tools","displayOrder":4,"active":true}')
echo "  Tools & Equipment: id=$CAT_TOOLS"

CAT_ADHESIVES=$(post /api/categories '{"name":"Adhesives & Sealants","description":"Pipe cement, PTFE tape, sealants","displayOrder":5,"active":true}')
echo "  Adhesives & Sealants: id=$CAT_ADHESIVES"

# Sub-categories under Pipes
CAT_CPVC=$(post /api/categories "{\"name\":\"CPVC Pipes\",\"description\":\"Chlorinated PVC pipes\",\"parentId\":$CAT_PIPES,\"displayOrder\":1,\"active\":true}")
echo "  CPVC Pipes (sub): id=$CAT_CPVC"

CAT_UPVC=$(post /api/categories "{\"name\":\"UPVC Pipes\",\"description\":\"Unplasticized PVC pipes\",\"parentId\":$CAT_PIPES,\"displayOrder\":2,\"active\":true}")
echo "  UPVC Pipes (sub): id=$CAT_UPVC"

CAT_GI=$(post /api/categories "{\"name\":\"GI Pipes\",\"description\":\"Galvanized iron pipes\",\"parentId\":$CAT_PIPES,\"displayOrder\":3,\"active\":true}")
echo "  GI Pipes (sub): id=$CAT_GI"

# ─────────────────────────────────────────────
# 2. VENDORS / SUPPLIERS
# ─────────────────────────────────────────────
echo ""
echo "→ Creating vendors..."

post /api/vendors '{"name":"Ashirvad Pipes Pvt Ltd","contactPerson":"Rajesh Kumar","phone":"9876543210","email":"sales@ashirvad.com","address":"123, Industrial Area, Phase 1","city":"Ahmedabad","state":"Gujarat","pincode":"380015","gstin":"24AABCA1234B1Z5","pan":"AABCA1234B","paymentTerms":"Net 30"}' > /dev/null
echo "  Ashirvad Pipes Pvt Ltd"

post /api/vendors '{"name":"Supreme Industries Ltd","contactPerson":"Priya Sharma","phone":"9876543211","email":"procurement@supreme.co.in","address":"456, MIDC Estate","city":"Pune","state":"Maharashtra","pincode":"411018","gstin":"27AAICS5678C1Z3","pan":"AAICS5678C","paymentTerms":"Net 15"}' > /dev/null
echo "  Supreme Industries Ltd"

post /api/vendors '{"name":"Finolex Industries Ltd","contactPerson":"Amit Patel","phone":"9876543212","email":"sales@finolex.com","address":"789, Pipeline Road","city":"Pune","state":"Maharashtra","pincode":"411057","gstin":"27AABCF9876D1Z1","pan":"AABCF9876D","paymentTerms":"Net 45"}' > /dev/null
echo "  Finolex Industries Ltd"

post /api/vendors '{"name":"Astral Poly Technik Ltd","contactPerson":"Deepak Singh","phone":"9876543213","email":"info@astralpipes.com","address":"Plot 12, GIDC","city":"Ahmedabad","state":"Gujarat","pincode":"382430","gstin":"24AABCA5432E1Z9","pan":"AABCA5432E","paymentTerms":"Net 30"}' > /dev/null
echo "  Astral Poly Technik Ltd"

post /api/vendors '{"name":"Prince Pipes & Fittings","contactPerson":"Suresh Mehta","phone":"9876543214","email":"sales@princepipes.com","address":"23, Industrial Zone","city":"Mumbai","state":"Maharashtra","pincode":"400072","gstin":"27AAICS1122F1Z7","pan":"AAICS1122F","paymentTerms":"Net 30"}' > /dev/null
echo "  Prince Pipes & Fittings"

post /api/vendors '{"name":"Wavin India Pvt Ltd","contactPerson":"Kavitha Reddy","phone":"9876543215","email":"kavitha@wavin.in","address":"45, Tech Park","city":"Chennai","state":"Tamil Nadu","pincode":"600096","gstin":"33AABCW3344G1Z2","pan":"AABCW3344G","paymentTerms":"Net 60"}' > /dev/null
echo "  Wavin India Pvt Ltd"

# ─────────────────────────────────────────────
# 3. CUSTOMERS
# ─────────────────────────────────────────────
echo ""
echo "→ Creating customers..."

post /api/customers '{"name":"Sharma Plumbing Works","phone":"9000100001","email":"sharma.plumbing@gmail.com","address":"12 Main Street","city":"Mumbai","state":"Maharashtra","pincode":"400001","gstin":"27ABCPS1234A1Z5","segment":"REGULAR","discountPercent":5,"creditLimit":50000}' > /dev/null
echo "  Sharma Plumbing Works"

post /api/customers '{"name":"Patel Construction Co","phone":"9000100002","email":"patel.construction@gmail.com","address":"45 Builder Street","city":"Ahmedabad","state":"Gujarat","pincode":"380001","gstin":"24AABCP5678B1Z3","segment":"WHOLESALE","discountPercent":10,"creditLimit":200000}' > /dev/null
echo "  Patel Construction Co"

post /api/customers '{"name":"Ravi Sanitary Store","phone":"9000100003","email":"ravisanitary@yahoo.com","address":"8 Market Road","city":"Pune","state":"Maharashtra","pincode":"411001","segment":"RETAIL","discountPercent":3,"creditLimit":25000}' > /dev/null
echo "  Ravi Sanitary Store"

post /api/customers '{"name":"City Infrastructure Pvt Ltd","phone":"9000100004","email":"procurement@cityinfra.co.in","address":"99 Corporate Park","city":"Bangalore","state":"Karnataka","pincode":"560001","gstin":"29AABCC9012C1Z1","segment":"VIP","discountPercent":15,"creditLimit":500000}' > /dev/null
echo "  City Infrastructure Pvt Ltd"

post /api/customers '{"name":"Rajesh Hardware","phone":"9000100005","email":"rajesh.hardware@gmail.com","address":"22 Gandhi Nagar","city":"Jaipur","state":"Rajasthan","pincode":"302001","segment":"REGULAR","discountPercent":5,"creditLimit":30000}' > /dev/null
echo "  Rajesh Hardware"

post /api/customers '{"name":"Green Build Developers","phone":"9000100006","email":"info@greenbuild.in","address":"Block B, Tech City","city":"Hyderabad","state":"Telangana","pincode":"500081","gstin":"36AABCG3456D1Z8","segment":"WHOLESALE","discountPercent":12,"creditLimit":300000}' > /dev/null
echo "  Green Build Developers"

post /api/customers '{"name":"Mohammed Plumbers","phone":"9000100007","email":"mo.plumbers@gmail.com","address":"14 Old Town","city":"Chennai","state":"Tamil Nadu","pincode":"600001","segment":"REGULAR","discountPercent":5,"creditLimit":20000}' > /dev/null
echo "  Mohammed Plumbers"

post /api/customers '{"name":"Suresh Enterprises","phone":"9000100008","email":"suresh.ent@outlook.com","address":"5 Ring Road","city":"Delhi","state":"Delhi","pincode":"110001","gstin":"07AABCS7890E1Z4","segment":"WHOLESALE","discountPercent":8,"creditLimit":150000}' > /dev/null
echo "  Suresh Enterprises"

post /api/customers '{"name":"Kumar Builders","phone":"9000100009","email":"kumarbuild@gmail.com","address":"77 Builder Colony","city":"Nagpur","state":"Maharashtra","pincode":"440001","segment":"REGULAR","discountPercent":5,"creditLimit":40000}' > /dev/null
echo "  Kumar Builders"

post /api/customers '{"name":"Walk-in Customer","phone":"9000100010","email":"walkin@store.com","address":"","city":"Mumbai","state":"Maharashtra","pincode":"400001","segment":"REGULAR","discountPercent":0,"creditLimit":0}' > /dev/null
echo "  Walk-in Customer"

# ─────────────────────────────────────────────
# 4. PRODUCTS
# ─────────────────────────────────────────────
echo ""
echo "→ Creating products..."

# CPVC Pipes
post /api/products "{\"name\":\"CPVC Pipe 15mm (3m)\",\"sku\":\"CPVC-15-3M\",\"barcode\":\"8901234560001\",\"categoryId\":$CAT_CPVC,\"taxGroupId\":3,\"costPrice\":85,\"sellingPrice\":110,\"mrp\":130,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":20,\"active\":true,\"featured\":true,\"description\":\"CPVC hot & cold water pipe 15mm diameter, 3 meter length\"}" > /dev/null
echo "  CPVC Pipe 15mm (3m)"

post /api/products "{\"name\":\"CPVC Pipe 20mm (3m)\",\"sku\":\"CPVC-20-3M\",\"barcode\":\"8901234560002\",\"categoryId\":$CAT_CPVC,\"taxGroupId\":3,\"costPrice\":110,\"sellingPrice\":145,\"mrp\":165,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":20,\"active\":true,\"description\":\"CPVC hot & cold water pipe 20mm diameter, 3 meter length\"}" > /dev/null
echo "  CPVC Pipe 20mm (3m)"

post /api/products "{\"name\":\"CPVC Pipe 25mm (3m)\",\"sku\":\"CPVC-25-3M\",\"barcode\":\"8901234560003\",\"categoryId\":$CAT_CPVC,\"taxGroupId\":3,\"costPrice\":140,\"sellingPrice\":185,\"mrp\":210,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":15,\"active\":true,\"description\":\"CPVC hot & cold water pipe 25mm diameter, 3 meter length\"}" > /dev/null
echo "  CPVC Pipe 25mm (3m)"

post /api/products "{\"name\":\"CPVC Pipe 32mm (3m)\",\"sku\":\"CPVC-32-3M\",\"barcode\":\"8901234560004\",\"categoryId\":$CAT_CPVC,\"taxGroupId\":3,\"costPrice\":185,\"sellingPrice\":245,\"mrp\":280,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":10,\"active\":true}" > /dev/null
echo "  CPVC Pipe 32mm (3m)"

# UPVC Pipes
post /api/products "{\"name\":\"UPVC Pipe 25mm (6m)\",\"sku\":\"UPVC-25-6M\",\"barcode\":\"8901234560010\",\"categoryId\":$CAT_UPVC,\"taxGroupId\":3,\"costPrice\":95,\"sellingPrice\":125,\"mrp\":145,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":20,\"active\":true,\"featured\":true,\"description\":\"UPVC pressure pipe 25mm, 6 meter length, suitable for water supply\"}" > /dev/null
echo "  UPVC Pipe 25mm (6m)"

post /api/products "{\"name\":\"UPVC Pipe 40mm (6m)\",\"sku\":\"UPVC-40-6M\",\"barcode\":\"8901234560011\",\"categoryId\":$CAT_UPVC,\"taxGroupId\":3,\"costPrice\":145,\"sellingPrice\":195,\"mrp\":220,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":15,\"active\":true}" > /dev/null
echo "  UPVC Pipe 40mm (6m)"

post /api/products "{\"name\":\"UPVC Pipe 63mm (6m)\",\"sku\":\"UPVC-63-6M\",\"barcode\":\"8901234560012\",\"categoryId\":$CAT_UPVC,\"taxGroupId\":3,\"costPrice\":225,\"sellingPrice\":295,\"mrp\":340,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":10,\"active\":true}" > /dev/null
echo "  UPVC Pipe 63mm (6m)"

# GI Pipes
post /api/products "{\"name\":\"GI Pipe 15mm (6m) Medium\",\"sku\":\"GI-15-6M-M\",\"barcode\":\"8901234560020\",\"categoryId\":$CAT_GI,\"taxGroupId\":4,\"costPrice\":480,\"sellingPrice\":620,\"mrp\":720,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":10,\"active\":true,\"featured\":true,\"description\":\"Galvanized Iron pipe 15mm, 6m, Medium class\"}" > /dev/null
echo "  GI Pipe 15mm Medium (6m)"

post /api/products "{\"name\":\"GI Pipe 20mm (6m) Medium\",\"sku\":\"GI-20-6M-M\",\"barcode\":\"8901234560021\",\"categoryId\":$CAT_GI,\"taxGroupId\":4,\"costPrice\":650,\"sellingPrice\":845,\"mrp\":980,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":8,\"active\":true}" > /dev/null
echo "  GI Pipe 20mm Medium (6m)"

post /api/products "{\"name\":\"GI Pipe 25mm (6m) Heavy\",\"sku\":\"GI-25-6M-H\",\"barcode\":\"8901234560022\",\"categoryId\":$CAT_GI,\"taxGroupId\":4,\"costPrice\":920,\"sellingPrice\":1195,\"mrp\":1380,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":5,\"active\":true}" > /dev/null
echo "  GI Pipe 25mm Heavy (6m)"

# Fittings
post /api/products "{\"name\":\"CPVC Elbow 15mm (90°)\",\"sku\":\"CPVC-ELB-15-90\",\"barcode\":\"8901234560030\",\"categoryId\":$CAT_FITTINGS,\"taxGroupId\":3,\"costPrice\":12,\"sellingPrice\":18,\"mrp\":22,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":100,\"active\":true,\"featured\":true,\"description\":\"CPVC 90 degree elbow fitting 15mm\"}" > /dev/null
echo "  CPVC Elbow 15mm 90°"

post /api/products "{\"name\":\"CPVC Elbow 20mm (90°)\",\"sku\":\"CPVC-ELB-20-90\",\"barcode\":\"8901234560031\",\"categoryId\":$CAT_FITTINGS,\"taxGroupId\":3,\"costPrice\":18,\"sellingPrice\":26,\"mrp\":32,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":100,\"active\":true}" > /dev/null
echo "  CPVC Elbow 20mm 90°"

post /api/products "{\"name\":\"CPVC Tee 15mm\",\"sku\":\"CPVC-TEE-15\",\"barcode\":\"8901234560032\",\"categoryId\":$CAT_FITTINGS,\"taxGroupId\":3,\"costPrice\":15,\"sellingPrice\":22,\"mrp\":28,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":100,\"active\":true}" > /dev/null
echo "  CPVC Tee 15mm"

post /api/products "{\"name\":\"CPVC Reducer 25x20mm\",\"sku\":\"CPVC-RED-25-20\",\"barcode\":\"8901234560033\",\"categoryId\":$CAT_FITTINGS,\"taxGroupId\":3,\"costPrice\":20,\"sellingPrice\":30,\"mrp\":36,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":50,\"active\":true}" > /dev/null
echo "  CPVC Reducer 25x20mm"

post /api/products "{\"name\":\"UPVC End Cap 25mm\",\"sku\":\"UPVC-CAP-25\",\"barcode\":\"8901234560034\",\"categoryId\":$CAT_FITTINGS,\"taxGroupId\":3,\"costPrice\":8,\"sellingPrice\":12,\"mrp\":15,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":50,\"active\":true}" > /dev/null
echo "  UPVC End Cap 25mm"

post /api/products "{\"name\":\"GI Socket 15mm\",\"sku\":\"GI-SOC-15\",\"barcode\":\"8901234560035\",\"categoryId\":$CAT_FITTINGS,\"taxGroupId\":4,\"costPrice\":35,\"sellingPrice\":48,\"mrp\":58,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":100,\"active\":true}" > /dev/null
echo "  GI Socket 15mm"

post /api/products "{\"name\":\"GI Elbow 20mm (90°)\",\"sku\":\"GI-ELB-20-90\",\"barcode\":\"8901234560036\",\"categoryId\":$CAT_FITTINGS,\"taxGroupId\":4,\"costPrice\":55,\"sellingPrice\":72,\"mrp\":86,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":50,\"active\":true}" > /dev/null
echo "  GI Elbow 20mm 90°"

# Valves
post /api/products "{\"name\":\"Ball Valve 15mm (Brass)\",\"sku\":\"BV-15-BR\",\"barcode\":\"8901234560040\",\"categoryId\":$CAT_VALVES,\"taxGroupId\":4,\"costPrice\":85,\"sellingPrice\":120,\"mrp\":145,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":30,\"active\":true,\"featured\":true,\"description\":\"Heavy duty brass ball valve 15mm full bore\"}" > /dev/null
echo "  Ball Valve 15mm Brass"

post /api/products "{\"name\":\"Ball Valve 20mm (Brass)\",\"sku\":\"BV-20-BR\",\"barcode\":\"8901234560041\",\"categoryId\":$CAT_VALVES,\"taxGroupId\":4,\"costPrice\":115,\"sellingPrice\":160,\"mrp\":190,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":20,\"active\":true}" > /dev/null
echo "  Ball Valve 20mm Brass"

post /api/products "{\"name\":\"Gate Valve 25mm (CI)\",\"sku\":\"GTV-25-CI\",\"barcode\":\"8901234560042\",\"categoryId\":$CAT_VALVES,\"taxGroupId\":4,\"costPrice\":180,\"sellingPrice\":245,\"mrp\":290,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":15,\"active\":true}" > /dev/null
echo "  Gate Valve 25mm CI"

post /api/products "{\"name\":\"Check Valve 25mm\",\"sku\":\"CV-25\",\"barcode\":\"8901234560043\",\"categoryId\":$CAT_VALVES,\"taxGroupId\":4,\"costPrice\":210,\"sellingPrice\":285,\"mrp\":340,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":10,\"active\":true}" > /dev/null
echo "  Check Valve 25mm"

post /api/products "{\"name\":\"Pressure Reducing Valve 25mm\",\"sku\":\"PRV-25\",\"barcode\":\"8901234560044\",\"categoryId\":$CAT_VALVES,\"taxGroupId\":4,\"costPrice\":550,\"sellingPrice\":720,\"mrp\":850,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":5,\"active\":true}" > /dev/null
echo "  Pressure Reducing Valve 25mm"

# Tools
post /api/products "{\"name\":\"Pipe Cutter (3-30mm)\",\"sku\":\"TOOL-PC-30\",\"barcode\":\"8901234560050\",\"categoryId\":$CAT_TOOLS,\"taxGroupId\":4,\"costPrice\":280,\"sellingPrice\":380,\"mrp\":450,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":5,\"active\":true,\"featured\":true,\"description\":\"Heavy duty pipe cutter for pipes 3-30mm diameter\"}" > /dev/null
echo "  Pipe Cutter (3-30mm)"

post /api/products "{\"name\":\"Pipe Bender Manual\",\"sku\":\"TOOL-PB-M\",\"barcode\":\"8901234560051\",\"categoryId\":$CAT_TOOLS,\"taxGroupId\":4,\"costPrice\":450,\"sellingPrice\":620,\"mrp\":720,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":3,\"active\":true}" > /dev/null
echo "  Pipe Bender Manual"

post /api/products "{\"name\":\"Thread Tape PTFE (12mm x 12m)\",\"sku\":\"TOOL-PTFE-12\",\"barcode\":\"8901234560052\",\"categoryId\":$CAT_TOOLS,\"taxGroupId\":2,\"costPrice\":12,\"sellingPrice\":20,\"mrp\":25,\"unitOfMeasure\":\"roll\",\"trackInventory\":true,\"reorderLevel\":50,\"active\":true}" > /dev/null
echo "  Thread Tape PTFE"

# Adhesives
post /api/products "{\"name\":\"CPVC Solvent Cement 50ml\",\"sku\":\"ADH-CPVC-50\",\"barcode\":\"8901234560060\",\"categoryId\":$CAT_ADHESIVES,\"taxGroupId\":4,\"costPrice\":55,\"sellingPrice\":80,\"mrp\":95,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":20,\"active\":true,\"featured\":true,\"description\":\"CPVC solvent cement for hot & cold water pipes, 50ml\"}" > /dev/null
echo "  CPVC Solvent Cement 50ml"

post /api/products "{\"name\":\"CPVC Solvent Cement 118ml\",\"sku\":\"ADH-CPVC-118\",\"barcode\":\"8901234560061\",\"categoryId\":$CAT_ADHESIVES,\"taxGroupId\":4,\"costPrice\":95,\"sellingPrice\":140,\"mrp\":165,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":15,\"active\":true}" > /dev/null
echo "  CPVC Solvent Cement 118ml"

post /api/products "{\"name\":\"UPVC Solvent Cement 50ml\",\"sku\":\"ADH-UPVC-50\",\"barcode\":\"8901234560062\",\"categoryId\":$CAT_ADHESIVES,\"taxGroupId\":4,\"costPrice\":40,\"sellingPrice\":60,\"mrp\":72,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":20,\"active\":true}" > /dev/null
echo "  UPVC Solvent Cement 50ml"

post /api/products "{\"name\":\"Pipe Thread Sealant 50g\",\"sku\":\"ADH-PTS-50\",\"barcode\":\"8901234560063\",\"categoryId\":$CAT_ADHESIVES,\"taxGroupId\":4,\"costPrice\":65,\"sellingPrice\":95,\"mrp\":115,\"unitOfMeasure\":\"pcs\",\"trackInventory\":true,\"reorderLevel\":10,\"active\":true}" > /dev/null
echo "  Pipe Thread Sealant 50g"

echo ""
echo "========================================="
echo " ✓ Seeding complete!"
echo "========================================="
echo ""
echo "Summary:"
echo "  - 8 categories (5 root + 3 sub)"
echo "  - 6 vendors"
echo "  - 10 customers"
echo "  - 27 products"
