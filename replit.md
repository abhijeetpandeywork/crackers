# Ratinam Crackers Business Management System

## Architecture Overview

A full-stack, contract-first business management platform for a firecracker company based in Sivakasi, Tamil Nadu.

### Stack
- **Backend**: Express 5 + TypeScript ESM, PostgreSQL via Drizzle ORM, JWT auth (15m access / 7d refresh)
- **Frontend**: React + Vite + shadcn/ui + wouter + @tanstack/react-query + recharts
- **API Contract**: OpenAPI 3.1 → codegen → `@workspace/api-zod` (Zod schemas) + `@workspace/api-client-react` (React Query hooks)
- **Monorepo**: pnpm workspace

### Applications

| App | Path | Port | Description |
|-----|------|------|-------------|
| ERP Admin Panel | `/` | 18996 | Full business operations console |
| POS Interface | `/pos/` | 24730 | Touch-screen cashier terminal |
| Warehouse Dashboard | `/warehouse/` | 24594 | Stock operations for WH managers |
| E-commerce Website | `/website/` | 19161 | Public customer-facing shop |
| API Server | `/api/` | 8080 | Express REST API |

### Default Login Credentials
- **ERP Admin**: username `admin` / password `admin123` / PIN `1234`
- **ERP Manager**: username `manager` / password `admin123` / PIN `2345`
- **POS Cashier**: username `cashier` / password `admin123` / PIN `3456`
- **Warehouse**: username `warehouse` / password `admin123` / PIN `4567`

## Key Features

### Pricing Engine (5-tier)
- **purchase** – cost price for procurement
- **wholesaleBulk** – triggered when qty ≥ threshold (default 10) per line item
- **retailOnline** – e-commerce price
- **retailEst** – estimate/invoice price
- **agent** – agent/distributor price
- Implemented in `artifacts/api-server/src/lib/pricing.ts`

### Stock System
- Immutable stock ledger (`stockLedger` table) — every movement creates a ledger entry
- Stock levels computed from ledger entries per product/variant/location
- Supports: receive, adjust, transfer between locations

### Other Features
- GST invoicing (CGST 9% + SGST 9% or IGST 18%)
- Coupon engine (% or flat discount)
- Loyalty points (earn/redeem)
- Agent commission tiers
- Customer credit ledger
- Excel brochure upload → estimate creation
- Barcode support (HSN-based)
- Reports: sales, outstanding, GST, commission, daybook
- POS: hold bills, shift close, PIN login

## File Structure

```
artifacts/
  api-server/       # Express backend
    src/
      routes/v1/    # 20+ route files
      lib/          # pricing, auth, logger
      middleware/   # authenticate.ts
      scripts/      # seed.ts
  erp/              # ERP Admin React app
    src/
      pages/        # 25+ pages
      components/   # layout, ui
      lib/          # auth.tsx
  pos/              # POS React app (dark touch theme)
    src/
      pages/        # pin-login, sale, receipt
      context/      # cart.tsx
  warehouse/        # Warehouse React app
    src/
      pages/        # login, dashboard, stock, receive, adjust, transfers, ledger
      components/   # layout/
  website/          # Public e-commerce React app
    src/
      pages/        # home, catalogue, product, cart, checkout
      context/      # cart.tsx
      components/   # navbar, footer
lib/
  db/               # Drizzle ORM schema (19 tables)
  api-spec/         # OpenAPI 3.1 spec (4570 lines)
  api-zod/          # Generated Zod schemas
  api-client-react/ # Generated React Query hooks
```

## Database Schema (19 tables)
users, locations, products, priceLists, customers, suppliers, agents, stockLedger, estimates, invoices, purchaseOrders, transfers, coupons, creditLedger, returns, settings, pos, packingJobs, notifications

## Development Commands
```bash
# Run all services (via Replit workflows)
pnpm --filter @workspace/api-server run seed    # Seed demo data
pnpm --filter @workspace/api-spec run codegen   # Regenerate API client from OpenAPI spec
pnpm run typecheck                              # Full type check
```
