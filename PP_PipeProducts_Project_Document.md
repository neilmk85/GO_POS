# PP Pipe Products — Web Application
## Project Document & Feature Guide

**Version:** 1.0  
**Date:** May 2026  
**Platform:** Web Application (React + TypeScript)  
**Backend API:** Node.js REST API (Port 8080)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [User Roles & Access Control](#3-user-roles--access-control)
4. [Module 1 — Dashboard](#4-module-1--dashboard)
5. [Module 2 — Point of Sale (POS)](#5-module-2--point-of-sale-pos)
6. [Module 3 — Sales](#6-module-3--sales)
7. [Module 4 — Purchases](#7-module-4--purchases)
8. [Module 5 — Inventory](#8-module-5--inventory)
9. [Module 6 — Production](#9-module-6--production)
10. [Module 7 — Business Operations Hub](#10-module-7--business-operations-hub)
11. [Module 8 — Customers](#11-module-8--customers)
12. [Module 9 — HR & Staff](#12-module-9--hr--staff)
13. [Module 10 — Expenses](#13-module-10--expenses)
14. [Module 11 — Reports](#14-module-11--reports)
15. [Module 12 — Settings](#15-module-12--settings)
16. [Module 13 — Activity Logs](#16-module-13--activity-logs)
17. [Technical Architecture](#17-technical-architecture)
18. [Key Benefits Summary](#18-key-benefits-summary)

---

## 1. Executive Summary

PP Pipe Products is a comprehensive, cloud-based **Enterprise Resource Planning (ERP)** web application purpose-built for a pipe manufacturing company. It digitises and automates every aspect of the business — from manufacturing pipes on the factory floor all the way to invoicing customers and filing GST returns.

**In plain language:** Think of this as the company's complete digital brain. Every sale, every pipe produced, every bag of cement used, every payment received or made — it all gets recorded here in real time, giving management a single place to see everything that's happening in the business.

### What the system covers:
- **Sales:** Retail counter sales (POS), B2B sales orders, invoices, quotations, payments
- **Purchases:** Vendor management, purchase orders, bills, payments to suppliers
- **Manufacturing:** End-to-end production tracking across 10 stages of pipe making
- **Inventory:** Real-time stock levels, adjustments, inter-outlet transfers
- **Daily Operations:** Cement consumption, vehicle usage, silo levels, loading records, testing lab, PDI
- **Finance:** GST reports, debtors, creditors, expense tracking
- **HR:** Staff management, role-based permissions, incentive calculations
- **Reporting:** 8 categories of reports with date filters, charts, and CSV exports

---

## 2. System Overview

### Technology Stack

| Layer | Technology | What it means |
|-------|-----------|---------------|
| Frontend UI | React 18 + TypeScript | The screens users see and interact with |
| Styling | Tailwind CSS | Makes the app look clean and responsive |
| Charts | Recharts | Bar charts, pie charts, trend graphs |
| State Management | React Context + Hooks | Keeps data consistent across the app |
| API Communication | Axios | Sends/receives data to the backend server |
| Backend | Node.js REST API | The engine that processes all business logic |
| Database | PostgreSQL (via API) | Where all data is permanently stored |

### Application URL
- **Web App:** `http://localhost:3000` (development) / Company domain (production)
- **API Server:** `http://localhost:8080`

### Multi-Outlet Support
The system supports **multiple factory outlets/branches**. Each user is assigned to an outlet, and data is filtered accordingly. An admin can view data across all outlets.

---

## 3. User Roles & Access Control

The system uses **Role-Based Access Control (RBAC)** — meaning each user only sees and can do what their role permits.

### Roles Available

| Role | Who it's for | Access Level |
|------|-------------|-------------|
| **Super Admin** | System owner / IT admin | Full access to everything, including settings |
| **Admin** | Factory manager / business owner | Full operational access |
| **Manager** | Department heads | Access to their module + reports |
| **Accountant** | Finance team | Sales, purchases, GST, reports |
| **Staff** | Counter operators, floor workers | Limited to their daily tasks |

### Permission Areas (Granular Control)

Admins can configure exactly what each role can do across 11 areas:

1. **Point of Sale** — Apply discounts, give refunds, void orders, manage shifts, accept payments
2. **Products & Catalogue** — Create, edit, delete products; manage categories
3. **Inventory** — View/adjust stock, approve transfers, receive stock
4. **Customers** — Create, edit, view customer records
5. **Orders** — Create, cancel, refund, view orders
6. **Invoices** — Create, edit, send, delete invoices
7. **Purchases** — Create POs, receive goods, pay vendors
8. **Reports** — View financial reports
9. **Expenses** — Create, approve expenses
10. **Staff Management** — Add staff, reset passwords, deactivate accounts
11. **Settings** — Modify system configuration

---

## 4. Module 1 — Dashboard

**URL:** `/dashboard`  
**Who uses it:** Managers, Admins

### What it does
The Dashboard is the **home screen** after login. It shows a bird's-eye view of the business right now — no need to dig through multiple pages.

### Key Features

#### Summary Cards (KPIs)
- **Today's Sales** — Total revenue collected today
- **Orders Count** — Number of orders processed
- **Production Summary** — Pipes manufactured across all stages
- **Intermediate Stock** — Work-in-progress inventory at each production stage

#### Date Filter
- 8 preset ranges: Today, Yesterday, This Week, Last Week, This Month, Last Month, This Quarter, This Year
- Custom date range picker for any specific period

#### Production Overview
- Shows pipe diameter breakdown (e.g., how many 600mm pipes, 800mm pipes)
- Stage-by-stage completion status with visual indicators
- Helps production managers know what's in progress at a glance

#### Charts & Visualisations
- Daily sales trend line
- Stage completion bar charts
- Intermediate stock table with quantities per stage

**In plain language:** The Dashboard is like a morning briefing — open it and you instantly know how yesterday went, what's happening today, and where production stands.

---

## 5. Module 2 — Point of Sale (POS)

**URL:** `/pos`  
**Who uses it:** Counter staff, cashiers

### What it does
The POS is the **retail counter billing system** — used when a customer walks in and buys pipes or materials directly. It works like a modern billing machine on a computer.

### Key Features

#### Product & Customer Search
- Search products by name, SKU, or barcode
- Instantly find customers by name or phone number
- Add new customers on the spot if they're first-time buyers

#### Cart Management
- Add multiple products to the cart
- Change quantities with + / − buttons
- Remove individual items
- Hold an order (put it aside and come back to it later with a note)

#### Pricing & Discounts
- **Price Override:** Change the selling price for a specific item (with permission)
- **Item Discount:** Apply percentage or flat discount on individual items
- **Coupon Codes:** Apply promotional coupon codes for cart-level discounts
- **Credit Notes:** Apply previously issued credit notes to reduce the bill amount
- Automatic price list resolution (VIP customers get VIP pricing automatically)

#### Payment Processing
- Accept multiple payment modes: Cash, UPI, Card, Bank Transfer, Cheque, Split Payment
- Automatic change calculation for cash payments
- Payment confirmation screen with receipt option

#### Shift Management
- Cashiers open a **shift** at the start of the day (entering opening cash balance)
- Shifts track all transactions during that period
- At end of day, close the shift with a sales summary

#### Receipt Printing
- Printable receipt with company logo, GST details, items, total, and payment method
- Shareable digital receipt link

**In plain language:** The POS module is like a smart cash register — scan products, apply discounts, take payment, print bill. But it also keeps a complete record of every transaction automatically.

---

## 6. Module 3 — Sales

**URL:** `/sales/*`  
**Who uses it:** Sales team, accountants, managers

### What it does
The Sales module handles all **B2B (business-to-business) sales** — when pipes are sold to contractors, government projects, or other companies with formal documentation (sales orders, invoices, quotations).

### Sub-modules

#### 6.1 Orders
**URL:** `/orders`

Tracks all transactions — both POS retail and B2B orders.
- View order history with status badges: COMPLETED, PENDING, CANCELLED, HELD, REFUNDED
- Search by order number or customer name
- Summary stats: total orders, revenue, pending count
- Drill into any order for full line-item detail

#### 6.2 Sales Orders (B2B)
**URL:** `/sales-orders`

A **Sales Order (SO)** is a formal document confirming what a customer has agreed to buy.
- Create new sales orders with multiple line items
- Link sales orders to production orders (so manufacturing starts automatically)
- Track status: DRAFT → CONFIRMED → DELIVERED → CANCELLED
- Generate invoice directly from the sales order
- Edit or cancel orders before fulfilment

#### 6.3 Invoices
**URL:** `/sales/invoices`

Invoices are the **official billing documents** sent to customers requesting payment.
- Create invoices manually or auto-generate from sales orders or POS orders
- Status tracking: DRAFT, SENT, PAID, PARTIAL, OVERDUE, CANCELLED
- Record partial and full payments against an invoice
- Apply discounts and coupons on the invoice level
- GST-compliant tax calculation (CGST + SGST or IGST)
- **Send invoice by email** directly from the system
- Print invoice with company branding
- Shareable public invoice link (customer can view without logging in)

#### 6.4 Quotations
**URL:** `/sales/quotations`

A Quotation is a **price estimate** sent to a customer before they confirm a purchase.
- Create formal quotations with product list and pricing
- Track status: DRAFT, SENT, ACCEPTED, EXPIRED, REJECTED
- Convert an accepted quotation into a sales order in one click
- Send quotation by email

#### 6.5 Payments Received
**URL:** `/sales/payments-received`

Tracks all **money collected from customers**.
- View payment history by date, customer, and payment mode
- Status: PENDING, PARTIAL, COMPLETE
- Link payments to specific invoices

#### 6.6 Sales Returns
**URL:** `/sales/returns`

When a customer returns goods — pipe is damaged, wrong size, etc.
- Record the return with reason
- Link to original invoice
- Automatic inventory adjustment on return acceptance

#### 6.7 Credit Notes
**URL:** `/sales/credit-notes`

A Credit Note is issued when money is **owed back to the customer** (e.g., after a return or billing correction).
- Create credit notes linked to original invoices
- Apply credit notes against future invoices
- Cancel a credit note with reason

#### 6.8 Delivery Challans
**URL:** `/sales/delivery-challans`

A Delivery Challan is a **transport document** that accompanies goods when delivered.
- Create and manage delivery challans
- Link to sales orders or invoices

**In plain language:** The Sales module is the complete paperwork trail from "customer wants to buy" to "money received" — quotation → order → invoice → payment → delivery.

---

## 7. Module 4 — Purchases

**URL:** `/purchases`  
**Who uses it:** Purchase team, store managers, accountants

### What it does
The Purchases module manages everything related to **buying materials, goods, and services** from vendors/suppliers.

### Sub-modules

#### 7.1 Vendors
Vendor is the database of all **suppliers** the company buys from.
- Add, edit, and deactivate vendor records
- Store contact details, GST number, payment terms
- Bulk import vendors from Excel/CSV
- Export vendor list

#### 7.2 Purchase Orders
A Purchase Order (PO) is a **formal document sent to a vendor** to buy specific items at an agreed price.
- Create POs with multiple line items
- Track status: DRAFT → SENT → RECEIVED → BILLED → CANCELLED
- Receive stock against a PO (partial or full receipt)

#### 7.3 Purchase Receives
Records the **physical receipt of goods** against a PO.
- Mark items as received with actual quantities
- Automatic inventory update on receipt
- Discrepancy flagging if received qty differs from ordered qty

#### 7.4 Bills
A Bill is the **vendor's invoice to us** — what we owe the supplier.
- Create bills manually or convert from a PO
- Status: DRAFT, DUE, PARTIAL, PAID, OVERDUE
- Record payments against bills
- Track outstanding payables

#### 7.5 Payments Made
Tracks all **money paid to vendors**.
- Payment history by vendor, date, and mode
- Link payments to specific bills

#### 7.6 Vendor Credits
When a vendor owes us money (e.g., after returning defective goods).
- Create vendor credit notes
- Apply credits against future bills

#### 7.7 Purchase Returns
When goods are **sent back to the vendor** due to defects or wrong supply.
- Record return with reason and quantity
- Linked to original purchase receive

#### 7.8 Direct Purchase
For **quick, informal purchases** without going through the full PO workflow.
- Enter vendor, items, amounts directly
- Useful for urgent or one-time purchases

#### 7.9 Bulk Purchase
For recording **large raw material intake** (e.g., cement, wire, aggregate in bulk).
- Record bulk quantities with conversion tracking
- Track conversion status: NOT_CONVERTED, PARTIALLY_CONVERTED, CONVERTED

**In plain language:** The Purchases module is the complete trail from "we need to buy something" to "we paid the supplier" — purchase order → goods receipt → vendor bill → payment.

---

## 8. Module 5 — Inventory

**URL:** `/inventory`  
**Who uses it:** Store managers, production team, admins

### What it does
Inventory keeps track of **what's in stock at all times** — raw materials, finished pipes, consumables.

### Key Features

#### 8.1 Stock View
- View current stock levels for every product
- Filter by: All Items, Raw Materials, PCCP Pipes
- Search by product name
- **Low stock alerts** — highlighted when stock falls below the reorder level
- Date range filtering to see stock movements over a period
- Export to CSV

#### 8.2 Products Catalogue
**URL:** `/products`

The master list of all **products the company deals in**.
- Add, edit, delete products
- Each product has: Name, SKU, Barcode, Category, Unit of Measure, Purchase UoM, Reorder Level, Tax Group
- **Barcode generation and printing** — print shelf labels
- Bulk import from Excel template (with dry-run preview before import)
- Export product list to CSV/Excel
- Toggle product active / inactive

#### 8.3 Categories
Organise products into **hierarchical categories** (parent → child).
- Create and manage product categories
- Toggle categories active/inactive

#### 8.4 UoM Conversions
**Unit of Measure (UoM)** conversions — e.g., cement is purchased in tonnes but consumed in bags.
- Configure conversion factors per product
- Automatic conversion during transactions

#### 8.5 Stock Adjustments
When physical stock count differs from system stock (e.g., after a manual audit).
- Record positive adjustments (stock found) or negative adjustments (stock missing)
- Every adjustment has an audit trail (who, when, reason)

#### 8.6 Inter-Outlet Transfers
Move stock **from one outlet/branch to another**.
- Create a transfer request with items and quantities
- Receiving outlet approves and confirms receipt
- Automatic stock deduction/addition at each outlet

**In plain language:** Inventory is the company's digital stockroom. It always knows exactly what's available, flags when something is running low, and tracks every movement in and out.

---

## 9. Module 6 — Production

**URL:** `/production/*`  
**Who uses it:** Production managers, floor supervisors, factory staff

### What it does
The Production module tracks the **complete pipe manufacturing process** from raw materials to finished pipes across 10 manufacturing stages.

### The 10 Production Stages

| # | Stage | What happens |
|---|-------|-------------|
| 1 | **Fabrication** | Steel cage/reinforcement is fabricated |
| 2 | **Testing (Pre)** | Cage tested for dimensions and quality |
| 3 | **Moulding** | Concrete is poured into the mould |
| 4 | **Spinning** | Pipe is spun to compact the concrete |
| 5 | **Demoulding** | Pipe is removed from the mould |
| 6 | **Curing 1** | First curing cycle (steam or water) |
| 7 | **Curing 2** | Second/extended curing |
| 8 | **Winding** | Pre-stress wire is wound (for PCCP pipes) |
| 9 | **Coating** | External protective coating applied |
| 10 | **Final Testing** | Finished pipe tested before dispatch |

### Sub-modules

#### 9.1 Production Orders
**URL:** `/production/orders`

A Production Order (PO) is the **work order to manufacture a batch of pipes**.
- Create production orders specifying: pipe type, diameter, pressure class, quantity
- Link to customer sales orders (so you know who it's for)
- Status: DRAFT → PLANNED → IN_PROGRESS → COMPLETED → CANCELLED
- View production cost sheet per order
- Sortable by PO number, pipe name, planned quantity, status, dates

#### 9.2 Production Entries
**URL:** `/production/entry`

A Production Entry records **actual work done** at a specific stage.
- Select the production order and stage
- Enter: quantity processed, machine used, shift name, bed type
- Record material consumption (cement, water, aggregate, wire) with actual quantities
- System verifies that the previous stage is complete before allowing the next entry
- Each entry creates an inventory deduction for materials consumed

#### 9.3 Pipe Configurations
**URL:** `/production/pipe-configs`

The master configuration for each **type of pipe** the company manufactures.
- Define diameter (e.g., 300mm, 600mm, 1200mm) and pressure class (NP2, NP3, etc.)
- Set **material formula** — how much cement, aggregate, wire etc. goes into one pipe of each size
- Toggle configurations active/inactive

#### 9.4 Machines
**URL:** `/production/machines`

Register all **production machinery** in the system.
- Add machines with type, name, and specifications
- Assign machines when recording production entries
- Toggle active/inactive

#### 9.5 Shift Templates
**URL:** `/production/shift-templates`

Configure **named work shifts** (e.g., Morning 6AM–2PM, Afternoon 2PM–10PM, Night 10PM–6AM).
- Used when recording production entries
- Helps track which shift produced how many pipes

#### 9.6 Overhead Configs
**URL:** `/production/overhead-configs`

Configure **indirect costs** to include in the production cost sheet.
- Electricity, water, machinery depreciation, labour overhead, etc.
- Each overhead is factored into the cost per pipe calculation

#### 9.7 Production Reports
**URL:** `/production/reports`

- Stage-wise summary of how many pipes completed each stage
- Material consumption analysis (how much cement/wire used per period)
- Machine utilization metrics
- Cost summary per production order
- Filter by date range

**In plain language:** The Production module is like a factory logbook that never gets lost. Every pipe's journey from steel cage to finished product is tracked stage by stage, along with every bag of cement and every hour of machine time used.

---

## 10. Module 7 — Business Operations Hub

**URL:** `/business`  
**Who uses it:** Factory supervisors, store keepers, lab staff, dispatch team

### What it does
The Business Hub is a collection of **daily operational data entry modules** — everything that happens on the factory floor each day that doesn't fit neatly into sales or production but still needs to be tracked.

### Sub-modules

#### 10.1 Cement Bags
**URL:** `/business/cement-bags`

Track daily **cement consumption** on the factory floor.
- Enter date, quantity of bags used, notes
- View history with date filters
- Date picker limited to today or earlier (cannot log future dates)

#### 10.2 Vehicles
**URL:** `/business/vehicles`

Track **company vehicle usage** — fuel filled, kilometres driven, purpose.
- Daily vehicle log entries
- Fleet overview

#### 10.3 Diesel Maintenance
**URL:** `/business/diesel-maintenance`

Track **diesel purchases and maintenance costs** for vehicles and machinery.
- Record diesel quantity, amount, vehicle, date
- Separate tracking from general vehicle usage

#### 10.4 Silo
**URL:** `/business/silo`

Track **aggregate silo levels** (sand, gravel stored in silos).
- Record current level per silo
- Date-wise history

#### 10.5 Silo Extraction
**URL:** `/business/silo-extraction`

Record **material drawn from silos** for production.
- Quantity extracted, silo number, production order linked

#### 10.6 Loading Records
**URL:** `/business/loading`

Record when pipes are **loaded onto trucks** for dispatch.
- Enter: date, vehicle number, customer site, pipe count, sizes
- Loading register for dispatch team

#### 10.7 Loaded Pipes
**URL:** `/business/loaded-pipes`

View history of all **loaded pipe dispatches**.
- Filter by date range with preset pills
- Shows vehicle, customer, pipe counts

#### 10.8 Transport Report
**URL:** `/business/transport-report`

Analyse **transport and logistics data** across three views:
- **By Vendor** — grouped by transport vendor with expandable details
- **By Customer** — grouped by delivery site/customer
- **All Trips** — flat list of every trip
- Search, filter, export CSV

#### 10.9 Testing Lab
**URL:** `/business/testing-lab`

Record **quality test results** from the testing lab.
- Test date, pipe size, test type, result (Pass/Fail), remarks
- Linked to production batch

#### 10.10 PDI (Pre-Delivery Inspection)
**URL:** `/business/pdi`

Pre-Delivery Inspection records before pipes leave the factory.
- Date, pipe reference, inspector, status (PASS/FAIL)
- 6 date range presets + custom date range picker
- Export records

#### 10.11 Maintenance
**URL:** `/business/maintenance`

Log **equipment maintenance activities**.
- Machine, maintenance type, date, cost, notes

#### 10.12 Store Room Material
**URL:** `/business/store-material`

Track **store room consumables** (nuts, bolts, tools, small materials).
- Issue and receipt entries
- Running balance per item

#### 10.13 Labour
**URL:** `/business/labour`

Record **daily labour attendance and work**.
- Head count, work area, contractor name, date

#### 10.14 Discard
**URL:** `/business/discard`

Log **rejected or damaged pipes** that cannot be sold.
- Quantity, reason, date, pipe configuration
- Linked to production order

#### 10.15 Extra Fabrication
**URL:** `/business/extra-fab`

Record **additional fabrication work** outside of standard production orders.

#### 10.16 Cutting
**URL:** `/business/cutting`

Track **pipe cutting operations** — when standard pipes are cut to custom lengths.

#### 10.17 Conversion
**URL:** `/business/conversion`

Record **material conversion** — when bulk materials are broken into smaller units.

**In plain language:** The Business Hub is the factory's daily diary. Every bag of cement, every truck trip, every failed quality test — it all gets recorded here so management can track costs and spot problems.

---

## 11. Module 8 — Customers

**URL:** `/customers`  
**Who uses it:** Sales staff, counter operators, admins

### What it does
Maintains the **master database of all customers** — both retail and B2B.

### Key Features

#### Customer List
- Search by name or phone number
- Customer **segment badges** with colour coding:
  - REGULAR (grey), SILVER (silver), GOLD (gold), VIP (purple), WHOLESALE (blue)
- Pagination for large lists
- Toggle customer active/inactive

#### Customer Record
Each customer stores:
- Name, phone, email, billing address, shipping address
- GSTIN (for B2B customers)
- Assigned price list / segment
- Purchase history

#### Bulk Operations
- **Bulk Import:** Upload an Excel/CSV file to add hundreds of customers at once
  - Dry-run preview: see what will be imported before committing
  - Download import template
- **CSV Export:** Export the full customer list

**In plain language:** The Customers module is the company's digital customer address book — but smarter, because it also remembers their segment, their purchases, and their outstanding dues.

---

## 12. Module 9 — HR & Staff

**URL:** `/staff`, `/incentives`  
**Who uses it:** Admin, HR manager

### 12.1 Staff Management
**URL:** `/staff`

Manage all **system users** (employees who log into the system).
- Add new staff members with email, phone, role, outlet assignment
- Reset passwords
- Toggle active/inactive (deactivate without deleting)
- Assign **granular permissions** per staff member beyond their base role

#### Permissions Matrix
Each staff member can be fine-tuned across 58 individual permissions spanning 11 categories. Example:
- Can this cashier apply discounts? ✓ or ✗
- Can this manager delete invoices? ✓ or ✗
- Can this accountant view reports? ✓ or ✗

### 12.2 Incentives
**URL:** `/incentives`

Configure and calculate **staff performance incentives**.
- Set incentive rules (e.g., 1% of sales above ₹1,00,000)
- System automatically calculates monthly payouts per staff member
- Leaderboard showing top performers
- Monthly and yearly incentive tracking
- Recalculate button to refresh calculations

**In plain language:** The HR module controls who can log in, what they can see and do, and how much bonus they earn based on their performance.

---

## 13. Module 10 — Expenses

**URL:** `/expenses`  
**Who uses it:** Accountants, managers, admins

### What it does
Track and manage **all company expenditures** that aren't purchases of inventory — office expenses, utilities, travel, marketing, etc.

### Key Features

#### Expense Records
- Record expenses with: amount, date, category, payment mode, description, reference number
- **Payment modes:** Cash, UPI, Bank Transfer, Card, Cheque, Other
- **Status workflow:** PENDING → APPROVED → PAID (or REJECTED)
- **ITC Eligibility** flag — mark if the expense qualifies for GST Input Tax Credit

#### Expense Categories
**URL:** `/expenses/categories`

- Create custom expense categories (e.g., Office Supplies, Travel, Utilities, Marketing)
- Set a **monthly budget** per category
- Customise colour and icon
- System alerts when spending approaches or exceeds the budget

#### Analytics
- Bar chart: expenses by category over time
- Pie chart: category-wise spend breakdown
- Monthly budget vs. actual comparison

#### Recurring Expenses
- Mark an expense as recurring (weekly, monthly)
- System auto-generates the next occurrence

#### Export
- Export expense records to CSV for accounting software

**In plain language:** The Expenses module is the company's expense register — digital, organised by category, with budget tracking and approval workflow built in.

---

## 14. Module 11 — Reports

**URL:** `/reports/*`  
**Who uses it:** Managers, admins, accountants

### What it does
The Reports module provides **data analytics and financial summaries** across 8 categories, all with date range filtering and export capabilities.

### 14.1 Reports Dashboard
**URL:** `/reports`

The starting point showing:
- Sales summary KPI cards (revenue, orders, customers)
- Daily sales trend chart
- Top 10 products by revenue
- Payment method breakdown
- Sales by category

### 14.2 Sales Report
**URL:** `/reports/sales`

- Revenue by day/week/month
- Product-wise sales breakdown
- Customer-wise sales summary
- 6 date presets + custom range
- Export to CSV

### 14.3 Purchase Report
**URL:** `/reports/purchases`

- Total purchases by vendor
- Outstanding purchase orders
- Goods received vs. billed analysis
- Payment due tracking

### 14.4 Inventory Report
**URL:** `/reports/inventory`

- Current stock levels across all outlets
- Stock movement (in/out) over a period
- Low stock alerts summary

### 14.5 GST Report
**URL:** `/reports/gst`

Compliance reporting for Goods & Services Tax filing.

| Report | What it shows |
|--------|---------------|
| **GSTR-1** | All outward (sales) supplies — what you sold and to whom |
| **GSTR-3B** | Summary of sales + ITC (Input Tax Credit) you can claim |
| **HSN Summary** | Sales and purchases grouped by HSN code (product classification) |

- **Tally Export** — export in a format compatible with Tally accounting software
- **CSV Export** — for manual filing or other software

### 14.6 Payment Report
**URL:** `/reports/payments`

- All payments received by date, customer, payment mode
- UPI vs. cash vs. card breakdown
- Outstanding payment tracking

### 14.7 Debtors Report
**URL:** `/reports/debtors`

A Debtor is a **customer who owes money** to the company.
- List of all customers with outstanding invoices
- Amount overdue by each customer
- Aging analysis (how long the money has been outstanding)
- Date range filter + custom picker
- Export to CSV (amber Export button)

### 14.8 Creditors Report
**URL:** `/reports/creditors`

A Creditor is a **vendor the company owes money** to.
- List of all vendors with unpaid bills
- Amount due to each vendor
- Date range filter + custom picker
- Export to CSV

**In plain language:** Reports is the company's financial control centre — one place to see how sales are going, what the GST liability is, who owes you money, and who you owe money to.

---

## 15. Module 12 — Settings

**URL:** `/settings`  
**Who uses it:** Admin, Super Admin only

### What it does
System-wide configuration — only administrators can access this.

### Settings Tabs

#### 15.1 Factory (Outlet Configuration)
- Company name, code, phone, email, address
- **GST details:** GSTIN, state code, tax type (Regular/Composite)
- Multi-outlet: configure each branch separately

#### 15.2 Roles
- Create and manage **user roles** (e.g., create a "Supervisor" role)
- Each role gets a custom name, description, and colour badge
- Assign permissions to roles

#### 15.3 Permissions
The **master permission matrix** — visually assign which permissions each role has.
- Toggle individual permissions on/off per role
- Changes take effect immediately for all users with that role

#### 15.4 Tax Groups
- Configure GST tax rates (5%, 12%, 18%, 28%)
- Create tax groups (e.g., "GST 18%" = CGST 9% + SGST 9%)
- Assign tax groups to products

#### 15.5 Receipt Template
Customise the **printed receipt** from the POS:
- Company logo upload
- Header and footer message
- Show/hide fields (GST number, phone, address)
- Receipt width configuration

#### 15.6 Document Templates
Customise **invoice and quotation layouts**:
- Upload company logo
- Set default template style
- Configure what fields appear on each document

#### 15.7 Integrations
Connect the system to external services:
- **Email (SMTP):** Configure email server to send invoices and quotations directly
- Test email channel connectivity
- Future: SMS notifications, payment gateways

**In plain language:** Settings is the control panel for the whole system — only trusted admins use it to set up how the company's data appears on bills, who can do what, and how the system connects to email.

---

## 16. Module 13 — Activity Logs

**URL:** `/activity-logs`  
**Who uses it:** Admin, Super Admin

### What it does
The Activity Log is a **complete audit trail** of every action taken in the system. It answers the question: "Who did what, and when?"

### Key Features

#### What gets logged
Every create, update, delete action across all 20+ modules:
- Invoice created, edited, deleted
- Customer added or modified
- Stock adjusted
- Payment recorded
- Staff password changed
- Settings modified
- Login and logout events

#### Filtering & Search
- Filter by **module** (e.g., show only Invoice-related actions)
- Filter by **action type** (Created / Updated / Deleted / Login / Logout)
- Filter by **user** (who performed the action)
- Filter by **date range**
- Search by keyword
- Paginated results

#### Visual Display
- Colour-coded action badges (green = Created, blue = Updated, red = Deleted)
- Exact timestamp of each action
- User name and role shown
- Changes recorded (what value changed from → to)

**In plain language:** Activity Logs is the security camera of the system — it records every action so if something goes wrong (a price was changed, a record was deleted), you can find out exactly who did it and when.

---

## 17. Technical Architecture

### Frontend Architecture

```
src/
├── components/          # Reusable UI components (buttons, modals, pickers)
├── layouts/             # App shell with sidebar navigation (AppLayout.tsx)
├── pages/               # All page components (~96 pages across 16 directories)
│   ├── auth/            # Login
│   ├── business/        # 18 business operation pages
│   ├── customers/       # Customer management
│   ├── dashboard/       # Dashboard
│   ├── expenses/        # Expense tracking
│   ├── inventory/       # Stock management
│   ├── pos/             # Point of Sale
│   ├── production/      # Manufacturing
│   ├── purchases/       # Procurement
│   ├── reports/         # Analytics and reports
│   ├── sales/           # Sales and invoicing
│   ├── settings/        # System configuration
│   └── staff/           # HR and user management
├── providers/           # React Context: Auth, Cart state management
└── services/            # api.ts — all API calls centralised here
```

### API Layer (`api.ts`)
All backend communication is centralised in a single service file with 40+ module groups:
- Axios instance with automatic auth token injection
- Token refresh handling on expiry
- Consistent error handling

### State Management
- **AuthProvider** — user session, outlet selection, permissions
- **CartProvider** — POS cart state (items, quantities, discounts, customer)
- Local component state via `useState` / `useReducer` for forms and filters

### Key UI Patterns Used Consistently
| Pattern | Where used |
|---------|-----------|
| Hero header with gradient | Every module page |
| Two-strip layout (tabs left, date filters right) | Reports, Inventory |
| 6 date presets + CustomRangePicker | All date-filtered pages |
| Amber Export CSV button | All exportable reports |
| Collapsible expandable cards | Transport, Vendor summaries |
| Modal forms | Add/Edit entries across all modules |
| Toast notifications | All save/error actions |

---

## 18. Key Benefits Summary

### For the Business Owner
- **Real-time visibility** into sales, production, and financials from anywhere
- **GST compliance** — GSTR-1 and GSTR-3B ready to file every month
- **Debtor tracking** — instantly know which customers owe money and for how long
- **Cost control** — see exactly how much each pipe costs to produce

### For the Factory Manager
- **Production tracking** — know exactly where every pipe is in the manufacturing process
- **Material consumption** — cement, wire, aggregate usage auto-tracked against production
- **Machine and shift records** — accountability for every production entry

### For the Accounts Team
- **One system for everything** — no need to maintain separate Excel sheets
- **Automated reports** — one click to export GST reports, debtor lists, payment summaries
- **Audit trail** — every financial entry has a timestamp and username

### For Counter Staff
- **Simple POS** — fast billing with barcode support
- **Shift management** — opening and closing cash tracked automatically
- **Customer lookup** — instantly find any customer by phone

### For IT / Admin
- **Role-based security** — each employee only sees what they need
- **Activity logs** — full audit trail of all system changes
- **Bulk import** — onboard customers, vendors, products via Excel
- **Email integration** — send invoices and quotations directly from the system

---

## Appendix — Page Count by Module

| Module | Pages / Screens |
|--------|----------------|
| Dashboard | 1 |
| POS | 1 (+ 4 modals) |
| Sales | 10 |
| Purchases | 9 |
| Inventory | 7 |
| Production | 12 |
| Business Hub | 18 |
| Customers | 4 |
| HR & Staff | 2 |
| Expenses | 2 |
| Reports | 9 |
| Settings | 2 |
| Activity Logs | 1 |
| Auth / Profile | 2 |
| **Total** | **~96 pages** |

---

*Document prepared for PP Pipe Products internal use.*  
*For technical queries, contact the development team.*
