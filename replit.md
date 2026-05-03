# Rathinam Crackers Business Management System

## Overview

This project is a comprehensive, full-stack business management platform for Rathinam Crackers, a firecracker company based in Sivakasi, Tamil Nadu. It aims to streamline various business operations, including sales, inventory, accounting, and customer management, across multiple user interfaces tailored for different roles. The system provides a robust and scalable solution to manage the complexities of a firecracker business, from pricing and stock control to e-commerce and regulatory compliance (GST).

Key capabilities include a 5-tier pricing engine, an immutable stock ledger system, GST invoicing, a coupon engine, loyalty points, agent commissions, customer credit management, barcode support, and various financial reports. The platform integrates multiple applications such as an ERP Admin Panel, a POS Interface, a Warehouse Dashboard, and an E-commerce Website, all built on a unified API contract.

The business vision is to provide a highly efficient and auditable system that supports both internal operations and external customer engagement, enhancing overall productivity and customer satisfaction in a specialized market.

## User Preferences

I prefer iterative development with clear communication on significant changes. Before making major architectural shifts or adding new features, please propose the plan and await approval. For any issues or proposed solutions, provide detailed explanations. I also prefer a functional programming approach where it makes sense, and clear, concise code. Do not make changes to the `scripts/seed.ts` file without explicit instructions, as it references missing dependencies.

## System Architecture

The system is a monorepo built using pnpm workspaces, integrating a full-stack architecture.

**Technical Stack:**
- **Backend**: Express 5 with TypeScript ESM, PostgreSQL via Drizzle ORM, JWT authentication (15m access / 7d refresh).
- **Frontend**: React, Vite, shadcn/ui, wouter for routing, @tanstack/react-query for data fetching, and recharts for data visualization.
- **API Contract**: Defined using OpenAPI 3.1, with codegen generating Zod schemas (`@workspace/api-zod`) and React Query hooks (`@workspace/api-client-react`) for type-safe API interactions.

**Applications:**
- **ERP Admin Panel**: Comprehensive business operations console with over 25 pages, serving as the central hub for administration.
- **POS Interface**: A touch-screen optimized cashier terminal featuring a dark theme for retail operations.
- **Warehouse Dashboard**: Dedicated interface for warehouse managers to handle stock operations.
- **E-commerce Website**: A public-facing customer online shop with a festive Indian theme.
- **API Server**: The core Express REST API serving all frontend applications.

**UI/UX Decisions:**
- **ERP Admin Panel**: Standard administrative console design with a sidebar navigation and resource sections. Features in-app contextual help.
- **POS Interface**: Optimized for touch interaction with a dark theme for high contrast and usability in a retail environment. Includes a 7-step cashier walk-through.
- **Warehouse Dashboard**: Focuses on clear stock management workflows, including receive, adjust, and transfer operations, with dedicated help sections.
- **E-commerce Website**: Features a festive Indian theme, with customer-facing FAQs and product review capabilities.
- **PDF Export**: Consistent branding (RATHINAM CRACKERS / GSTIN), accent red, and paginated footers for all generated PDFs (invoices, estimates, POs, transfers, reports).

**Feature Specifications & Implementations:**
- **Pricing Engine**: A 5-tier system (`purchase`, `wholesaleBulk`, `retailOnline`, `retailEst`, `agent`) implemented in `artifacts/api-server/src/lib/pricing.ts`. The API endpoint `GET /products/:id/price` provides detailed pricing resolution reasons.
- **Stock System**: An immutable ledger (`stockLedger` table) tracks all movements (`IN`, `OUT`, `MOVE`, `ADJUST`, `DAMAGE`, `RESERVE`, `UNRESERVE`). Stock levels are derived from the sum of ledger entries. All modifications to the stock ledger are rejected to ensure audit trail integrity. `POST /stock/adjust` includes server-side validation.
- **GST Invoicing**: Supports CGST 9% + SGST 9% for intra-state and IGST 18% for inter-state transactions.
- **Coupon Engine**: Supports percentage or flat discounts, minimum order values, expiry dates, and maximum usage limits with server-side validation.
- **Loyalty & Commission**: Functionality for earning/redeeming loyalty points and tiered agent commissions with promo codes.
- **Customer Management**: Includes a customer credit ledger, statements, and payment recording.
- **Reports**: Generation of sales-by-channel, outstanding balances, GST (HSN-wise), commission, and daybook reports.
- **System Verifier**: A 53-check end-to-end verifier (CLI and in-app) validates API surfaces, authentication, pricing, stock immutability, sales, and administrative functions. It ensures the integrity and functionality of the entire system.
- **In-app Help & Guide System**: Contextual help sections are integrated into every application panel (ERP, POS, Warehouse, Website) to provide users with immediate assistance without external manuals.
- **POS Operator UX**: The POS sale screen has a dedicated barcode / quick-add input that auto-focuses on mount and after every cart change (scanners type the product `code` and press Enter to add), a separate product search that actually filters the grid by name or code within the active category, low-stock and out-of-stock badges on each variant button, quick-cash denomination buttons (₹100 / 200 / 500 / 1000 / 2000 / Exact), a global keyboard-shortcut hook (F2 search, F3 scan, F4 customer, F9 hold, F12 checkout, ? help, Esc reset), an always-visible shortcut hint bar, and a "?" overlay listing every shortcut. PIN login also accepts physical keyboard input (digits, Backspace, Enter, Esc). The receipt page renders a 80mm thermal slip via a print-only CSS block (`@page { size: 80mm auto }`) so a single `window.print()` produces a clean cashier slip — header / GSTIN, item lines with rate × qty, GST breakup, total, cash + change for CASH sales, and a footer with the invoice number. The cart is cleared on the receipt screen so the next "New Sale" starts fresh.
- **CMS & Reviews**: The e-commerce website content is data-driven via a CMS blob stored in `settings`. Product reviews with moderation capabilities (pending, approved, rejected) are implemented.
- **Customer Storefront Accounts (WooCommerce-style)**: Public website now has a full ecommerce account system fully linked to the ERP. Customers can sign up / log in with phone + password (JWT, kind:"customer", 30d), manage their profile, change password, maintain a saved-address book (with default address), keep a wishlist, and place orders that flow into the ERP `invoices` table as channel=ONLINE credit invoices with `logisticsDetails` (shipping address + status pending_confirmation), best-effort stock deduction, and loyalty-point accrual. Authenticated routes live under `/api/v1/shop/*` and use the `shopAuthenticate` middleware. New tables: `customer_addresses`, `customer_wishlist`. New customer columns: `password_hash`, `email_verified`. Website pages: `/login`, `/signup`, `/account`, `/account/orders`, `/account/orders/:id`, `/account/addresses`, `/account/wishlist`, `/account/profile`. Checkout requires login (guests are redirected with `?next=`), supports saved-address selection or new-address entry, and payment modes COD / UPI / BANK.
- **Type System**: The entire monorepo maintains a `typecheck:0` status, ensuring type safety across all components and aligning client code with generated API types.

## External Dependencies

- **PostgreSQL**: Primary database for all persistent data.
- **Drizzle ORM**: Used for database interactions with PostgreSQL.
- **JWT (JSON Web Tokens)**: For authentication and authorization.
- **shadcn/ui**: UI component library for building consistent user interfaces.
- **wouter**: A tiny routing library for React applications.
- **@tanstack/react-query**: For efficient data fetching, caching, and state management in React applications.
- **recharts**: A composable charting library built with React for data visualization.
- **jspdf / jspdf-autotable**: Libraries used for generating PDF documents for invoices, estimates, reports, etc.
- **lucide-react**: Icon library used across the application.