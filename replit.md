# Rathinam Crackers Business Management System

## Architecture Overview

A full-stack, contract-first business management platform for a firecracker company based in Sivakasi, Tamil Nadu.

### Stack
- **Backend**: Express 5 + TypeScript ESM, PostgreSQL via Drizzle ORM, JWT auth (15m access / 7d refresh)
- **Frontend**: React + Vite + shadcn/ui + wouter + @tanstack/react-query + recharts
- **API Contract**: OpenAPI 3.1 → codegen → `@workspace/api-zod` (Zod schemas) + `@workspace/api-client-react` (React Query hooks)
- **Monorepo**: pnpm workspace

### Applications

| App | Path | Description |
|-----|------|-------------|
| ERP Admin Panel | `/` | Full business operations console (25+ pages) |
| POS Interface | `/pos/` | Touch-screen cashier terminal (dark theme) |
| Warehouse Dashboard | `/warehouse/` | Stock operations for WH managers |
| E-commerce Website | `/website/` | Public customer-facing shop (festive Indian theme) |
| API Server | `/api/` | Express REST API |

### Default Login Credentials
- **ERP Admin**: username `admin` / password `admin123` / PIN `1234`
- **ERP Manager**: username `manager` / password `admin123` / PIN `2345`
- **POS Cashier**: username `cashier` / password `admin123` / PIN `3456`
- **Warehouse**: username `warehouse` / password `admin123` / PIN `4567`

## Key Features

### Pricing Engine (5-tier)
Implemented in `artifacts/api-server/src/lib/pricing.ts`. Each variant has 5 prices:
- **purchase** – cost price for procurement
- **wholesaleBulk** – auto-applied when qty ≥ threshold (default 10) per line item
- **retailOnline** – e-commerce price (used by `/website/`)
- **retailEst** – estimate/invoice price (manual sales)
- **agent** – agent/distributor price

The `GET /products/:id/price?qty=&channel=&variantId=` endpoint returns:
`{ unitPrice, tier, resolutionReason, bulkRateApplied }` so the UI can explain *why* a price was chosen.

### Stock System
- Immutable stock ledger (`stockLedger` table) — every movement creates a permanent ledger entry; rows are NEVER deleted or updated
- Movement types: `IN`, `OUT`, `MOVE`, `ADJUST`, `DAMAGE`, `RESERVE`, `UNRESERVE`
- Stock levels = sum of ledger rows per (product, variant, location)
- Operations: receive, adjust (requires reason), transfer between locations (RESERVE→IN+UNRESERVE)
- `POST /stock/adjust` validates required fields server-side and returns 400 (not 500) for missing data

### Other Features
- GST invoicing (CGST 9% + SGST 9% intra-state OR IGST 18% inter-state)
- Coupon engine (% or flat discount, min order, expiry, max uses) with server-side validation
- Loyalty points (earn/redeem)
- Agent commission tiers + promo codes
- Customer credit ledger + statements + record payment
- Excel brochure upload → estimate creation
- Barcode support (HSN-based)
- Reports: sales-by-channel, outstanding, GST (HSN-wise), commission, daybook
- POS: hold bills, shift close, PIN login, idempotent sale creation

## Verifier Module

The system ships with a **43-check verifier** that exercises the full API surface end-to-end against the running stack.

| Surface | Location | How to run |
|---|---|---|
| **CLI**   | `scripts/src/verifier.ts` | `pnpm --filter @workspace/scripts run verify` |
| **In-app** | `artifacts/erp/src/pages/verifier.tsx` | Login as admin → Sidebar → **Resources → System Verifier** → "Run All Checks" |

Both surfaces run the same 9 sections, **43 checks total** (counts produced at runtime):
1. **Infrastructure & Health** — `/api/healthz` + 4 frontend reachability probes (6 checks)
2. **Authentication & RBAC** — 401 without token, wrong password rejected, admin login, `/auth/me` (4 checks)
3. **Pricing Engine** — 5-tier resolution + qty>=10 wholesale trigger + `resolutionReason` + `bulkRateApplied` (4 checks)
4. **Stock System (immutable ledger)** — levels, ledger, adjust validation, **plus PUT/PATCH/DELETE on `/stock/ledger/:id` must all be rejected** (6 checks). This actively asserts the audit trail cannot be tampered with.
5. **Customers / Suppliers / Agents** (3 checks)
6. **Estimates / Invoices / Coupons** — list endpoints + bad-coupon validate (4 checks)
7. **POS / Warehouse / Reports** — pos products, transfers, POs, sales report (4 checks)
8. **Locations, Users & Settings (admin)** — `/locations` reachable + seeded, `/users` (admin), `/settings/company`, brand contains "Rathinam", `/settings/pricing`, **plus full e2e transfer flow create→dispatch→receive** (9 checks)
9. **Public / Website APIs** — public products, **no purchase rate leakage**, public coupons (3 checks)

CLI exits non-zero on any failure so it can gate CI/CD. Latest local run: **43/43 GREEN**.

The in-app version shows a live progress bar, per-section pass/fail rollups, and individual detail messages so non-technical staff can run a daily smoke test.

## In-app Help & Guide System

Every panel ships with its own contextual Help section so users never need an external manual.

| Panel | Route | Notes |
|---|---|---|
| ERP    | `/help`, `/help/:topic` | 10 deep topic articles (login, products, pricing, stock, estimates→invoice, customers, POs, transfers, coupons, reports) + FAQ + credentials reference. Linked from sidebar **Resources → Help & Guide**. |
| POS    | `/help` | Dark-themed 7-step cashier walk-through (PIN, search, cart, coupon, payment, hold-bill, shift close). Linked from a Help icon in the sale screen header. |
| Warehouse | `/help` | 4 sections (Receive, Transfers, Adjust, Ledger) + low-stock alerting rules. Linked from sidebar nav. |
| Website   | `/help` | Festive-themed customer FAQ (How to order, Delivery, GST invoice, Safety & compliance, Returns, Contact). Linked from navbar. |

**Documentation rule:** any time the core spec changes (new pricing tier, new stock movement type, new role, new API surface) the corresponding Help topic and the verifier MUST be updated in the same PR.

## File Structure

```
artifacts/
  api-server/       # Express backend
    src/
      routes/v1/    # 20+ route files (auth, products, stock, estimates, invoices, ...)
      lib/          # pricing, auth, logger
      middleware/   # authenticate.ts
      scripts/      # seed.ts
  erp/              # ERP Admin React app (25+ pages)
    src/
      pages/
        help/       # index.tsx (hub) + topic.tsx (article view)
        verifier.tsx
        ...         # estimates, invoices, customers, suppliers, agents,
                    # purchase-orders, transfers, coupons, reports, users,
                    # locations, settings
      components/   # layout (sidebar with Resources section), ui
      lib/          # auth.tsx
  pos/              # POS React app (dark touch theme)
    src/
      pages/        # pin-login, sale (with Help icon), receipt, help
      context/      # cart.tsx
  warehouse/        # Warehouse React app
    src/
      pages/        # login, dashboard, stock, receive, adjust, transfers, ledger, help
      components/   # layout/ (sidebar with Help & Guide)
  website/          # Public e-commerce React app
    src/
      pages/        # home, catalogue, product, cart, checkout, help
      context/      # cart.tsx
      components/   # navbar (Help link), footer
lib/
  db/               # Drizzle ORM schema (19 tables)
  api-spec/         # OpenAPI 3.1 spec
  api-zod/          # Generated Zod schemas
  api-client-react/ # Generated React Query hooks
scripts/
  src/verifier.ts   # 43-check end-to-end verifier (CLI)
```

## Database Schema (19 tables)
users, locations, products, priceLists, customers, suppliers, agents, stockLedger, estimates, invoices, purchaseOrders, transfers, coupons, creditLedger, returns, settings, pos, packingJobs, notifications

## Development Commands
```bash
# Run all services (via Replit workflows — never `pnpm dev` at root)
pnpm --filter @workspace/api-server run seed     # Seed demo data
pnpm --filter @workspace/api-spec run codegen    # Regenerate API client from OpenAPI spec
pnpm --filter @workspace/scripts run verify      # Run 43-check end-to-end verifier
pnpm run typecheck                               # Full type check
```

## Recent Changes (May 2026)

- **Final polish & verifier sweep (43/43 GREEN)**:
  - Verifier expanded from 34 → 43 checks; new section 8 covers `/locations`, `/users`, `/settings/company`, brand-name assertion (must contain "Rathinam"), `/settings/pricing`, and a full **end-to-end transfer flow** that creates a draft transfer, dispatches it, then receives it.
  - POS: replaced hardcoded `loc1` with real `/locations` fetch (first shop selected); customer search now uses a Popover-based picker against `useListCustomers` (min 2 chars); held bills round-trip productName/variantLabel/unitPrice and the **Resume** button reloads them into the cart.
  - Warehouse: stock page no longer mocks locations — it fetches from `/locations` using `wh_token`.
  - ERP transfers: status badges use the real lowercase enum (draft / pending_approval / in_transit / received / cancelled); added **`/transfers/:id` detail page** with from/to cards, vehicle + dispatch + receive timestamps, line-items table, and inline dispatch / receive action buttons.
  - Settings: company-row brand is now "Rathinam Crackers" / `info@rathinamcrackers.com` (cleaned up legacy "Ratinam" spelling everywhere).
- Added **System Verifier** (CLI + in-app, 9 sections / 43 checks) covering auth, pricing, stock immutability, sales, admin, e2e transfers, public APIs. Latest run 43/43 GREEN.
- Added **immutable-ledger guard verification**: PUT/PATCH/DELETE on `/stock/ledger/:id` are all asserted to be rejected, so the audit trail is provably tamper-resistant.
- Added **in-app Help & Guide** to every panel (ERP, POS, Warehouse, Website) with contextual topics and FAQ.
- Hardened `POST /api/v1/stock/adjust` to validate required fields server-side and return 400 (not 500).
- Fixed nested `<a>` hydration warnings in warehouse sidebar and website help (wouter `Link` no longer wraps an extra `<a>`).
