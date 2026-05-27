# Rathinam Crackers — Knowledge Transfer (KT) Documentation

This document serves as the master Knowledge Transfer (KT) guide for the **Rathinam Crackers** codebase, custom integrations, database architecture, and live cloud environment.

---

## 1. System Architecture (Monorepo)

The project is structured as a **pnpm Monorepo** ensuring high code reuse across different channels (API, Web, POS, ERP, Warehouse):

```text
/opt/rathinam
├── artifacts/
│   ├── api-server/         # Express & Node API server (backend)
│   ├── website/            # Customer storefront website (public front)
│   ├── erp/                # ERP admin console (management front)
│   ├── pos/                # POS terminal for cashier checkouts
│   └── warehouse/          # Warehouse stock-transfer dashboard
├── lib/
│   └── db/                 # Drizzle schema migrations & database client
├── scripts/                # Automated E2E verification verifier suite
└── package.json            # Monorepo configuration
```

---

## 2. Advanced Feature Implementations

### A. GST Pricing Segment Toggle
* **Pricing Math**: Support for back-calculating GST details dynamically:
  - **GST Exclusive**: Price does not include tax. Subtotal is line items total; GST (18%) is added on top.
  - **GST Inclusive**: Price includes tax. Line values are back-calculated to extract clean base taxable values:
    $$\text{Taxable Base} = \frac{\text{Resolved Price} \times \text{Quantity}}{1 + \text{GST Rate} / 100}$$
    $$\text{GST Amount} = \text{Gross Line Total} - \text{Taxable Base}$$
* **UI Segment**: Dynamic top-level toggle (`GST Exclusive` / `GST Inclusive`) embedded at the top of the estimate creator inside the ERP, with real-time checkout calculations.

### B. Bulk Estimate Importer (Multer + xlsx)
* **Brochure Format (Format B - Sivakasi Brochure)**: Heuristic row parser scanning Col A for product alphanumeric codes and Col F for required quantities. Bypasses standard empty rows, header banners, or decorative metadata rows automatically using a custom scanner heuristic.
* **Custom Format (Format A - Manual Column Matching)**: Fully dynamic worksheet select option parsing custom excel columns according to header mappings.
* **Matched Grid & Mismatch Console**: Renders successfully resolved items in a clean grid showing dynamic discount resolution tiers. Shows any invalid codes or quantity exceptions in an amber-bordered alert warnings console.

### C. Catalog-Seeded Template Generators
* **Brochure Order Sheets**: Instead of static placeholders, clicking "Download Template" queries your active database catalog dynamically, producing a CSV with your genuine product codes (`ARL001`, `SPK001`, etc.), categories, and standard retail prices, ready to fill.

### D. Converted Invoice Stock Neutrality
* **Neutrality Guard**: Converting a draft estimate to a confirmed invoice inherits all tax columns, credit ledger status, and invoices without invoking warehouse or location stock level deductions. This preserves catalog stock levels completely.

---

## 3. Database & Role-Based Access Control (RBAC)

* **Migration Engine**: Powered by **Drizzle ORM** with target connection URI:
  `postgresql://rathinam_user:rathinam_pass@127.0.0.1:5432/rathinam`
* **RBAC Seeds**:
  - **18 Permissions**: Covering detailed rights on Users, Catalog, Inventory, Sales, Finance, and System.
  - **6 Roles**: Managed hierarchies (`SUPER_ADMIN`, `ERP_MANAGER`, `ACCOUNTANT`, `AGENT`, `WH_MANAGER`, and `CASHIER`) and their exact permission mapping.
  - **Identical User Seeds**:
    *   `admin` $\rightarrow$ `Admin@12345` (Super Admin)
    *   `manager` $\rightarrow$ `Manager@12345` (ERP Manager)
    *   `warehouse` $\rightarrow$ `Warehouse@12345` (Warehouse Manager)
    *   `cashier` $\rightarrow$ `admin123` (POS Cashier)

---

## 4. Production Resilience & Deployment Guide

### A. Server Infrastructure
* **EC2 Instance**: Medium instance with 4GB RAM running Amazon Linux 2023.
* **Elastic IP**: Permanent binding ensures static domains route reliably.

### B. Memory Buffers & OOM Prevention
* **4.0 GiB Swap File**: Active at `/swapfile` (backed by `/etc/fstab` persistence). This protects the server against memory spikes during high-concurrency builds or queries, ensuring Node, PostgreSQL, and Nginx never crash due to OOM conditions.

### C. Nginx Reverse-Proxy & Subdomains
The domain is split across secure subdomains routing to dedicated production build folders:
* `rathinamcracker.com` $\rightarrow$ `/opt/rathinam/artifacts/website/dist`
* `erp.rathinamcracker.com` $\rightarrow$ `/opt/rathinam/artifacts/erp/dist`
* `pos.rathinamcracker.com` $\rightarrow$ `/opt/rathinam/artifacts/pos/dist`
* `warehouse.rathinamcracker.com` $\rightarrow$ `/opt/rathinam/artifacts/warehouse/dist`
* `api.rathinamcracker.com` $\rightarrow$ Reverse proxy to Node API server listening on `http://127.0.0.1:8000`

### D. PM2 Systemd Service Control
* PM2 is registered under `systemd` to reload automatically on server boots.
* Bypassed the PIDFile permission security rule. The service is monitored via cgroups, which prevents startup protocol failures.
* **Quick CLI Commands**:
  ```bash
  # Check backend process status
  pm2 status
  
  # Restart backend API
  pm2 restart rathinam-api
  
  # Check real-time log outputs
  pm2 logs rathinam-api
  ```

---

## 5. E2E Verification
* **Verifier Suite**: Run automated verification inside the scripts module:
  `VERIFIER_BASE_URL="http://127.0.0.1:8000" pnpm --filter @workspace/scripts run verify`
* **Coverage**: Runs 90 integrated checks across authentication, RBAC, pricing, catalog filters, logistics, and audit logging to ensure your system is completely green.
