#!/usr/bin/env python3
"""
Seed 128 PCCP pipe configurations from the formula CSV.

Usage:
  python3 seed_pccp_pipe_configs.py [--base-url URL] [--token TOKEN] [--csv PATH]

Prerequisites:
  1. Run seed_raw_materials.sh first (creates 20 raw material products).
  2. Backend must be running.

CSV layout (per diameter section):
  Row 0:  CELL PLATE            → SPINNING
  Row 1:  BACK-SHEET            → SPINNING
  Row 2:  SPIGOT [6/8/10] MM    → SPINNING
  Row 3:  SOCKET [6/8/10] MM    → SPINNING
  Row 4:  20MM METAL            → SPINNING
  Row 5:  10MM METAL            → SPINNING
  Row 6:  CRUSHED SAND          → SPINNING
  Row 7:  DUST                  → SPINNING  (maps to "DUST (CORE)")
  Row 8:  Silo CEMENT           → SPINNING  (maps to "Silo CEMENT (CORE)")
  Row 9:  EXTRA CEMENT          → SPINNING
  Row 10: CHEMICAL              → SPINNING
  Row 11: 4MM WINDING WIRE      → WINDING
  Row 12: Silo CEMENT           → COATING   (maps to "Silo CEMENT (COATING)")
  Row 13: LOOSE CEMENT          → COATING
  Row 14: PLASTER SAND          → COATING
  Row 15: DUST                  → COATING   (maps to "DUST (CORE)")
  Row 16: C.SAND                → COATING
"""

import argparse
import csv
import json
import sys
import urllib.request
import urllib.parse
import urllib.error

# ── Constants ─────────────────────────────────────────────────────────────────

PRESSURE_CLASSES = ["4kg", "5.5kg", "7kg", "8.5kg", "10kg", "11.5kg", "13kg", "14.5kg"]

# Map position within a diameter section → (product name, stage)
# Index 0 = first material row after the diameter label
ROW_STAGE_MAP = [
    ("CELL PLATE",            "SPINNING"),
    ("BACK-SHEET",            "SPINNING"),
    ("SPIGOT",                "SPINNING"),   # name resolved dynamically (6/8/10 MM)
    ("SOCKET",                "SPINNING"),   # name resolved dynamically
    ("20MM METAL",            "SPINNING"),
    ("10MM METAL",            "SPINNING"),
    ("CRUSHED SAND",          "SPINNING"),
    ("DUST (CORE)",           "SPINNING"),   # CSV says "DUST"
    ("Silo CEMENT (CORE)",    "SPINNING"),   # CSV says "Silo CEMENT" (first occurrence)
    ("EXTRA CEMENT",          "SPINNING"),
    ("CHEMICAL",              "SPINNING"),
    ("4MM WINDING WIRE",      "WINDING"),
    ("Silo CEMENT (COATING)", "COATING"),    # CSV says "Silo CEMENT" (second occurrence)
    ("LOOSE CEMENT",          "COATING"),
    ("PLASTER SAND",          "COATING"),
    ("DUST (CORE)",           "COATING"),   # CSV says "DUST" (second occurrence, same product)
    ("C.SAND",                "COATING"),
]

UOM_MAP = {
    "CELL PLATE":            "pcs",
    "BACK-SHEET":            "pcs",
    "SPIGOT 6MM":            "pcs",
    "SPIGOT 8MM":            "pcs",
    "SPIGOT 10MM":           "pcs",
    "SOCKET 6MM":            "pcs",
    "SOCKET 8MM":            "pcs",
    "SOCKET 10MM":           "pcs",
    "20MM METAL":            "kg",
    "10MM METAL":            "kg",
    "CRUSHED SAND":          "kg",
    "DUST (CORE)":           "kg",
    "Silo CEMENT (CORE)":    "kg",
    "EXTRA CEMENT":          "kg",
    "CHEMICAL":              "litre",
    "4MM WINDING WIRE":      "kg",
    "Silo CEMENT (COATING)": "kg",
    "LOOSE CEMENT":          "kg",
    "PLASTER SAND":          "kg",
    "C.SAND":                "kg",
}


# ── HTTP helpers ───────────────────────────────────────────────────────────────

def api_get(base_url: str, path: str, token: str) -> dict:
    url = base_url.rstrip("/") + path
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())


def api_post(base_url: str, path: str, token: str, body: dict) -> dict:
    url = base_url.rstrip("/") + path
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()
        raise RuntimeError(f"POST {path} → {e.code}: {body_text}") from e


def api_put(base_url: str, path: str, token: str, body: dict) -> dict:
    url = base_url.rstrip("/") + path
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="PUT",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()
        raise RuntimeError(f"PUT {path} → {e.code}: {body_text}") from e


# ── Auth ───────────────────────────────────────────────────────────────────────

def get_token(base_url: str) -> str:
    print("→ Obtaining auth token...")
    resp = api_post(base_url, "/api/auth/login", "",
                    {"email": "admin@pos.com", "password": "Admin@123"})
    token = resp["data"]["accessToken"]
    print("  Token obtained.")
    return token


# ── Product lookup (raw material name → product id) ────────────────────────────

def build_product_map(base_url: str, token: str) -> dict:
    """Return {product_name_lower: product_id}"""
    print("→ Loading raw material products from API...")
    product_map = {}
    page = 0
    while True:
        resp = api_get(base_url,
                       f"/api/products?page={page}&size=100",
                       token)
        data = resp.get("data", {})
        items = data.get("content", data.get("items", []))
        if not items:
            break
        for p in items:
            product_map[p["name"].strip().lower()] = p["id"]
        if len(items) < 100:
            break
        page += 1

    print(f"  Loaded {len(product_map)} products.")
    return product_map


def resolve_product_id(name: str, product_map: dict):
    return product_map.get(name.strip().lower())


# ── CSV parser ─────────────────────────────────────────────────────────────────

def parse_csv(csv_path: str) -> list[dict]:
    """
    Parse the formula CSV and return a list of:
      {diameter_mm: int, pressure_class: str, materials: [{name, stage, qty, uom}]}
    """
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))

    configs = []

    i = 0
    while i < len(rows):
        row = rows[i]
        # Detect a diameter header: col 1 matches "<number> mm"
        if len(row) > 1 and row[1].strip().endswith("mm"):
            diam_label = row[1].strip()  # e.g. "350 mm"
            try:
                diameter_mm = int(diam_label.replace("mm", "").strip())
            except ValueError:
                i += 1
                continue

            # Read the next 17 material rows
            material_rows = []
            j = i + 1
            while len(material_rows) < 17 and j < len(rows):
                r = rows[j]
                if len(r) > 1 and r[1].strip():
                    material_rows.append(r)
                j += 1
            i = j  # advance past the section

            if len(material_rows) < 17:
                print(f"  WARNING: {diam_label} has only {len(material_rows)} material rows (expected 17), skipping.")
                continue

            # Columns 2-9 correspond to the 8 pressure classes
            for pc_idx, pressure_class in enumerate(PRESSURE_CLASSES):
                col = pc_idx + 2  # column offset in CSV
                materials = []
                for mat_idx, mat_row in enumerate(material_rows):
                    template_name, stage = ROW_STAGE_MAP[mat_idx]

                    # Resolve dynamic spigot/socket names from the actual CSV cell
                    if template_name in ("SPIGOT", "SOCKET"):
                        raw_name = mat_row[1].strip()  # e.g. "SPIGOT 6 MM"
                        # Normalise: "SPIGOT 6 MM" → "SPIGOT 6MM"
                        resolved_name = raw_name.replace(" MM", "MM").replace("  ", " ")
                    else:
                        resolved_name = template_name

                    try:
                        qty_str = mat_row[col].strip()
                        qty = float(qty_str) if qty_str else 0.0
                    except (IndexError, ValueError):
                        qty = 0.0

                    if qty <= 0:
                        continue  # skip zero-quantity materials

                    uom = UOM_MAP.get(resolved_name, "kg")
                    materials.append({
                        "name": resolved_name,
                        "stage": stage,
                        "qty": round(qty, 4),
                        "uom": uom,
                    })

                configs.append({
                    "diameter_mm": diameter_mm,
                    "pressure_class": pressure_class,
                    "materials": materials,
                })
        else:
            i += 1

    return configs


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Seed PCCP pipe configurations from CSV")
    parser.add_argument("--base-url", default="http://localhost:8080")
    parser.add_argument("--token", default="")
    parser.add_argument("--csv", default="/Users/nilesh/Downloads/P&P/pccp_formulas.FINAL_30_september_25.csv")
    args = parser.parse_args()

    base_url = args.base_url
    token = args.token or get_token(base_url)

    # Load product name → id map
    product_map = build_product_map(base_url, token)

    # Parse CSV
    print(f"\n→ Parsing CSV: {args.csv}")
    configs = parse_csv(args.csv)
    print(f"  Parsed {len(configs)} pipe configurations (expected 128).")

    created = 0
    skipped = 0
    errors = 0

    print("\n→ Creating pipe configurations...\n")

    for cfg in configs:
        diam = cfg["diameter_mm"]
        pc = cfg["pressure_class"]
        name = f"PCCP {diam}mm {pc}"

        # 1. Create PipeConfig
        try:
            resp = api_post(base_url, "/api/production/pipe-configs", token, {
                "name": name,
                "diameterMm": diam,
                "pressureClass": pc,
                "active": True,
            })
            config_id = resp["data"]["id"]
            print(f"  [{created + skipped + 1}/128] {name} → id={config_id}")
        except RuntimeError as e:
            err_str = str(e)
            if "already exists" in err_str.lower() or "duplicate" in err_str.lower() or "1062" in err_str:
                # Fetch existing
                try:
                    lookup = api_get(base_url,
                                     f"/api/production/pipe-configs/lookup?diameterMm={diam}&pressureClass={urllib.parse.quote(pc)}",
                                     token)
                    config_id = lookup["data"]["id"]
                    print(f"  [{created + skipped + 1}/128] {name} already exists → id={config_id} (skipping materials)")
                    skipped += 1
                    continue
                except Exception:
                    pass
            print(f"  ERROR creating {name}: {e}")
            errors += 1
            continue

        # 2. Build materials payload
        materials_payload = []
        for mat in cfg["materials"]:
            prod_id = resolve_product_id(mat["name"], product_map)
            if prod_id is None:
                print(f"    WARNING: Product not found: '{mat['name']}' — skipping this material")
                continue
            materials_payload.append({
                "stageType": mat["stage"],
                "materialProductId": prod_id,
                "quantityPerPipe": mat["qty"],
                "uom": mat["uom"],
                "scrapPercent": 0,
            })

        # 3. Upsert materials
        if materials_payload:
            try:
                api_put(base_url, f"/api/production/pipe-configs/{config_id}/materials",
                        token, {"materials": materials_payload})
            except RuntimeError as e:
                print(f"    ERROR setting materials for {name}: {e}")
                errors += 1

        created += 1

    print(f"\n{'='*58}")
    print(f" Done! Created: {created}  Skipped (existing): {skipped}  Errors: {errors}")
    print(f"{'='*58}")
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
