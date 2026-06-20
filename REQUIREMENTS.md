# PP Pipes Products — New Requirements

---

## Tech Stack — Site Project (Water Supply Pipeline)

The Site project is integrated directly into the PP Pipes Products web app (`/web`). It shares the same stack — no separate project or install needed.

| Layer | Technology | Notes |
|---|---|---|
| **Framework** | React 18 + TypeScript | Same as POS web app |
| **Build Tool** | Vite 5 | Port 3000, proxy → Go backend :8082 |
| **Styling** | Tailwind CSS 3 | Custom colors: primary, success, warning, danger |
| **Routing** | React Router DOM v6 | Pages live under `src/pages/site/` |
| **Server State** | TanStack React Query v5 | `staleTime: 0`, retry: 1 |
| **HTTP Client** | Axios | Via shared `src/services/api.ts` |
| **Forms** | React Hook Form + Zod | Validation schemas co-located with forms |
| **State Management** | Zustand | Auth store: `src/store/authStore.ts` |
| **UI Components** | Radix UI | Dialog, Dropdown, Select, Tabs, Tooltip, Popover |
| **Icons** | Lucide React | |
| **Charts** | Recharts | For dashboards / reports |
| **PDF Export** | jsPDF + jsPDF-AutoTable | Work bills, reports |
| **Excel Export** | xlsx | |
| **Notifications** | react-hot-toast | Top-right position |
| **Printing** | react-to-print | |
| **Date Utils** | date-fns | |
| **Class Utils** | clsx + tailwind-merge + class-variance-authority | |

### Integration Points
- **Sidebar entry:** `AppLayout.tsx` line 146 — `/site` with `Building2` icon, `highlight: true`
- **Routes:** `App.tsx` — `/site`, `/site/contractors`, `/site/work-orders`, `/site/work-bills`
- **Pages:** `src/pages/site/` — `SitePage`, `ContractorsPage`, `WorkOrdersPage`, `WorkBillsPage`
- **Backend:** Go backend at `:8082`, same as all other modules

---

## REQ-001 · Sales Order: Meters Field & Pipe Qty Auto-Calculation
**Page:** `/sales-orders/new`
**Status:** Implemented

- Under Order Items, when a pipe config is selected, show a **Meters** input field alongside Qty.
- `1 pipe = 5.25 meters`
- Entering meters auto-calculates qty: `qty = Math.ceil(meters / 5.25)`
- Qty can still be manually overridden via `−`/`+` controls.
- Meters field only applies to pipe items; product rows show `—`.
- **Discount column removed** from the Order Items table.

---

## REQ-002 · Transport Report
**Page:** `/reports/transport`
**Status:** Implemented

- Renamed tabs: "By Vendor" → **Transporter**, "By Customer" → **Customer**.
- Card header gradient lightened; hero page header kept dark (`from-violet-700 via-violet-600 to-blue-600`).
- **Transporter tab restructured** with a 3-level hierarchy per transporter card:
  - Truck-wise summary strip (truck no., total trips, total pipes).
  - Site-by-site breakdown below — each site shown as its own section.
  - Per-site trip table: Truck No, Pipe Name, Qty, Destination, Date.
- Site sub-header badge shows **"Total trips = N"** (not "N trips").
- Table headings in **black**, truck number badge in black (`bg-gray-100 text-gray-900`).
- Increased table heading font size.

---

## REQ-003 · TDS (Tax Deducted at Source)
**Pages:** `/reports/tds`, `/settings` → TDS Sections tab
**Status:** Implemented

- **TDS Sections master** — configurable via Settings → TDS Sections tab:
  - Fields: Section Code (194C, 194J, etc.), Description, Rate (%), Threshold Limit (₹).
  - "Add Defaults" button seeds common sections (194C / 194J / 194I / 194H) in one click.
  - Full CRUD: add, edit, delete sections.

- **TDS deduction on vendor payments:**
  - Vendor payment form accepts `tdsSectionId` and `tdsAmount`.
  - TDS amount and section stored on `vendor_payments` table.
  - A `tds_deductions` record is created per payment that has TDS, storing: supplier, section, base amount, rate, TDS amount, financial year, deposit status.

- **TDS Payable in Ledger** (`/reports/ledger`):
  - A "TDS Payable" GL account auto-appears in the ledger when any TDS has been deducted in the selected period.

- **TDS Report** (`/reports/tds`):
  - Date range filter with presets.
  - Summary cards: Total Base Amount, Total TDS Deducted, Sections count, Parties count.
  - **By Section view**: section code, description, rate, transaction count, base amount, TDS deducted, deposited, pending.
  - **By Party view**: vendor name, PAN, section, transaction count, base amount, TDS deducted, deposited, pending.
  - Pending amounts highlighted in red.

---

## REQ-004: Production Order — On Hold Status
**Page:** `/production/orders`, `/production/orders/{id}`
**Status:** Implemented

- **ON_HOLD status** added to production order lifecycle between IN_PROGRESS and COMPLETED.
- **Status flow:** DRAFT → PLANNED → IN_PROGRESS → ON_HOLD → IN_PROGRESS (resume) or CANCELLED.
  - PLANNED → IN_PROGRESS is automatic when the first production entry is added.
  - DRAFT → PLANNED requires manual Approve action.

- **Hold captures:**
  - `holdReason` — mandatory text describing why the order is paused (e.g. client delay, material shortage).
  - `holdAt` — timestamp when the order was put on hold.
  - `holdQtyProduced` — snapshot of pipes that had passed final testing at the time of hold.

- **Production Orders list** (`/production/orders`):
  - ON_HOLD filter button in the status strip.
  - "On Hold" count in the summary stats bar (orange, highlighted when > 0).
  - ON_HOLD rows highlighted in orange with hold reason and "X / Y pipes completed" shown inline.
  - **Hold** button on IN_PROGRESS rows → opens modal to capture reason + shows live progress snapshot.
  - **Resume** button on ON_HOLD rows → returns order to IN_PROGRESS, clears hold data.

- **Production Order detail** (`/production/orders/{id}`):
  - Orange hold info banner showing reason, qty snapshot, and hold date.
  - **Hold** / **Resume** buttons in the page header.
  - Same hold modal with reason textarea and progress snapshot.

- **Backend:** `hold_reason`, `hold_at`, `hold_qty_produced` columns on `production_orders` table (auto-migrated). Resuming from hold clears all three fields.

---
