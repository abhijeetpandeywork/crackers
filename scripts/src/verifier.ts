#!/usr/bin/env tsx
/**
 * Rathinam Crackers — System Verifier
 *
 * Automated end-to-end health checks for the entire stack.
 * Verifies API health, auth, RBAC, pricing engine, stock immutability,
 * coupon validation, and frontend availability.
 *
 * Usage:  pnpm --filter @workspace/scripts run verify
 */

const BASE = process.env["VERIFIER_BASE_URL"] ?? "http://localhost:80";

type CheckResult = {
  name: string;
  passed: boolean;
  detail?: string;
};

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

async function http(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown; headers: Headers }> {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, init);
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = await res.text().catch(() => null);
  }
  return { status: res.status, body, headers: res.headers };
}

async function login(username: string, password: string): Promise<string | null> {
  const res = await http("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (res.status !== 200) return null;
  const body = res.body as { data?: { accessToken?: string } };
  return body?.data?.accessToken ?? null;
}

const sections: Array<{ name: string; checks: () => Promise<CheckResult[]> }> = [
  {
    name: "1. Infrastructure & Health",
    checks: async () => {
      const out: CheckResult[] = [];
      const health = await http("/api/healthz");
      out.push({
        name: "API health endpoint responds 200",
        passed: health.status === 200,
        detail: `status=${health.status}`,
      });
      out.push({
        name: "Health body has status:ok",
        passed: (health.body as { status?: string })?.status === "ok",
        detail: JSON.stringify(health.body),
      });
      const erp = await fetch(`${BASE}/`);
      out.push({
        name: "ERP frontend served at /",
        passed: erp.status < 500,
        detail: `status=${erp.status}`,
      });
      const pos = await fetch(`${BASE}/pos/`);
      out.push({
        name: "POS frontend served at /pos/",
        passed: pos.status < 500,
        detail: `status=${pos.status}`,
      });
      const wh = await fetch(`${BASE}/warehouse/`);
      out.push({
        name: "Warehouse frontend served at /warehouse/",
        passed: wh.status < 500,
        detail: `status=${wh.status}`,
      });
      const web = await fetch(`${BASE}/website/`);
      out.push({
        name: "Website frontend served at /website/",
        passed: web.status < 500,
        detail: `status=${web.status}`,
      });
      return out;
    },
  },
  {
    name: "2. Authentication & RBAC",
    checks: async () => {
      const out: CheckResult[] = [];
      const protectedNoAuth = await http("/api/v1/products");
      out.push({
        name: "Protected route returns 401 without token",
        passed: protectedNoAuth.status === 401,
        detail: `status=${protectedNoAuth.status}`,
      });
      const badLogin = await http("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "wrong" }),
      });
      out.push({
        name: "Wrong password returns 401",
        passed: badLogin.status === 401,
        detail: `status=${badLogin.status}`,
      });
      const adminTok = await login("admin", "admin123");
      out.push({
        name: "Admin login succeeds with seeded credentials",
        passed: !!adminTok,
        detail: adminTok ? "token issued" : "no token returned",
      });
      if (adminTok) {
        const me = await http("/api/v1/auth/me", {
          headers: { Authorization: `Bearer ${adminTok}` },
        });
        out.push({
          name: "GET /auth/me returns 200 with token",
          passed: me.status === 200,
          detail: `status=${me.status}`,
        });
      }
      return out;
    },
  },
  {
    name: "3. Pricing Engine (5-tier + qty trigger)",
    checks: async () => {
      const out: CheckResult[] = [];
      const tok = await login("admin", "admin123");
      if (!tok) {
        out.push({
          name: "Pricing checks (skipped — no admin token)",
          passed: false,
        });
        return out;
      }
      const headers = { Authorization: `Bearer ${tok}` };
      const products = await http("/api/v1/products?limit=1", { headers });
      const pBody = products.body as { data?: unknown };
      const raw = pBody?.data;
      const items = (Array.isArray(raw)
        ? raw
        : (raw as { items?: unknown[] })?.items ?? []) as Array<{ id: string; variants?: Array<{ id?: string; variantId?: string }> }>;
      if (!items || items.length === 0) {
        out.push({ name: "Has at least one product to price", passed: false, detail: "GET /products returned 0 items" });
        return out;
      }
      const prod = items[0]!;
      const variantId = prod.variants?.[0]?.variantId ?? prod.variants?.[0]?.id;
      const lowQty = await http(
        `/api/v1/products/${prod.id}/price?qty=1&channel=POS&variantId=${variantId}`,
        { headers },
      );
      const highQty = await http(
        `/api/v1/products/${prod.id}/price?qty=20&channel=POS&variantId=${variantId}`,
        { headers },
      );
      out.push({
        name: "Price endpoint returns 200 for low qty",
        passed: lowQty.status === 200,
        detail: `status=${lowQty.status}`,
      });
      out.push({
        name: "Price endpoint returns 200 for qty above threshold",
        passed: highQty.status === 200,
        detail: `status=${highQty.status}`,
      });
      const lowBody = lowQty.body as { data?: { resolutionReason?: string; bulkRateApplied?: boolean } };
      const highBody = highQty.body as { data?: { resolutionReason?: string; bulkRateApplied?: boolean } };
      out.push({
        name: "Price response includes resolutionReason",
        passed: !!lowBody?.data?.resolutionReason,
        detail: `reason=${lowBody?.data?.resolutionReason}`,
      });
      out.push({
        name: "qty>=10 triggers wholesale (bulkRateApplied=true)",
        passed: highBody?.data?.bulkRateApplied === true,
        detail: `bulkRateApplied=${highBody?.data?.bulkRateApplied}`,
      });
      return out;
    },
  },
  {
    name: "4. Stock System (immutable ledger)",
    checks: async () => {
      const out: CheckResult[] = [];
      const tok = await login("admin", "admin123");
      if (!tok) {
        out.push({ name: "Stock checks (skipped — no token)", passed: false });
        return out;
      }
      const headers = { Authorization: `Bearer ${tok}` };
      const levels = await http("/api/v1/stock/levels", { headers });
      out.push({
        name: "GET /stock/levels returns 200",
        passed: levels.status === 200,
        detail: `status=${levels.status}`,
      });
      const ledger = await http("/api/v1/stock/ledger?limit=5", { headers });
      out.push({
        name: "GET /stock/ledger returns 200",
        passed: ledger.status === 200,
        detail: `status=${ledger.status}`,
      });
      const adjustNoReason = await http("/api/v1/stock/adjust", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ qty: 1 }),
      });
      out.push({
        name: "POST /stock/adjust without reason returns 4xx",
        passed: adjustNoReason.status >= 400 && adjustNoReason.status < 500,
        detail: `status=${adjustNoReason.status}`,
      });
      // Immutable ledger guard: any mutation verb on /stock/ledger must NOT succeed (no 2xx)
      const ledgerRows = ledger.body as { data?: unknown[] };
      const sampleRow = Array.isArray(ledgerRows?.data) ? (ledgerRows.data[0] as { id?: string } | undefined) : undefined;
      const sampleId = sampleRow?.id ?? "ledger-row-id-test";
      const putAttempt = await http(`/api/v1/stock/ledger/${sampleId}`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ qty: 9999 }),
      });
      out.push({
        name: "PUT /stock/ledger/:id is rejected (immutable)",
        passed: putAttempt.status >= 400,
        detail: `status=${putAttempt.status}`,
      });
      const deleteAttempt = await http(`/api/v1/stock/ledger/${sampleId}`, {
        method: "DELETE",
        headers,
      });
      out.push({
        name: "DELETE /stock/ledger/:id is rejected (immutable)",
        passed: deleteAttempt.status >= 400,
        detail: `status=${deleteAttempt.status}`,
      });
      const patchAttempt = await http(`/api/v1/stock/ledger/${sampleId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ qty: 9999 }),
      });
      out.push({
        name: "PATCH /stock/ledger/:id is rejected (immutable)",
        passed: patchAttempt.status >= 400,
        detail: `status=${patchAttempt.status}`,
      });
      return out;
    },
  },
  {
    name: "5. Customers, Suppliers, Agents",
    checks: async () => {
      const out: CheckResult[] = [];
      const tok = await login("admin", "admin123");
      if (!tok) {
        out.push({ name: "CRM checks (skipped — no token)", passed: false });
        return out;
      }
      const headers = { Authorization: `Bearer ${tok}` };
      const c = await http("/api/v1/customers?limit=1", { headers });
      out.push({ name: "GET /customers returns 200", passed: c.status === 200 });
      const s = await http("/api/v1/suppliers?limit=1", { headers });
      out.push({ name: "GET /suppliers returns 200", passed: s.status === 200 });
      const a = await http("/api/v1/agents?limit=1", { headers });
      out.push({ name: "GET /agents returns 200", passed: a.status === 200 });
      return out;
    },
  },
  {
    name: "6. Estimates / Invoices / Coupons",
    checks: async () => {
      const out: CheckResult[] = [];
      const tok = await login("admin", "admin123");
      if (!tok) {
        out.push({ name: "Sales checks (skipped — no token)", passed: false });
        return out;
      }
      const headers = { Authorization: `Bearer ${tok}` };
      const est = await http("/api/v1/estimates?limit=1", { headers });
      out.push({ name: "GET /estimates returns 200", passed: est.status === 200 });
      const inv = await http("/api/v1/invoices?limit=1", { headers });
      out.push({ name: "GET /invoices returns 200", passed: inv.status === 200 });
      const cp = await http("/api/v1/coupons?limit=1", { headers });
      out.push({ name: "GET /coupons returns 200", passed: cp.status === 200 });
      const validate = await http("/api/v1/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "DEFINITELY_NOT_A_REAL_COUPON_X9", cartTotal: 1000, channel: "POS" }),
      });
      out.push({
        name: "Coupon validate with bad code returns invalid (200 or 404)",
        passed: validate.status === 200 || validate.status === 404,
        detail: `status=${validate.status}`,
      });
      return out;
    },
  },
  {
    name: "7. POS / Warehouse / Reports",
    checks: async () => {
      const out: CheckResult[] = [];
      const tok = await login("admin", "admin123");
      if (!tok) {
        out.push({ name: "Module checks (skipped — no token)", passed: false });
        return out;
      }
      const headers = { Authorization: `Bearer ${tok}` };
      const pos = await http("/api/v1/pos/products?limit=1", { headers });
      out.push({ name: "GET /pos/products returns 200", passed: pos.status === 200 });
      const tr = await http("/api/v1/transfers?limit=1", { headers });
      out.push({ name: "GET /transfers returns 200", passed: tr.status === 200 });
      const po = await http("/api/v1/purchase-orders?limit=1", { headers });
      out.push({ name: "GET /purchase-orders returns 200", passed: po.status === 200 });
      const today = new Date().toISOString().slice(0, 10);
      const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const sales = await http(`/api/v1/reports/sales?dateFrom=${monthAgo}&dateTo=${today}`, { headers });
      out.push({ name: "GET /reports/sales returns 200", passed: sales.status === 200 });
      return out;
    },
  },
  {
    name: "8. Locations, Users & Settings (admin)",
    checks: async () => {
      const out: CheckResult[] = [];
      const tok = await login("admin", "admin123");
      if (!tok) {
        out.push({ name: "Skipped — no admin token", passed: false });
        return out;
      }
      const headers = { Authorization: `Bearer ${tok}` };

      const locs = await http("/api/v1/locations", { headers });
      out.push({
        name: "GET /locations returns 200",
        passed: locs.status === 200,
        detail: `status=${locs.status}`,
      });
      const locArr = (locs.body as { data?: unknown[] })?.data;
      out.push({
        name: "Locations seed has at least one entry",
        passed: Array.isArray(locArr) && locArr.length > 0,
        detail: `count=${Array.isArray(locArr) ? locArr.length : 0}`,
      });

      const users = await http("/api/v1/users", { headers });
      out.push({
        name: "GET /users returns 200 (admin)",
        passed: users.status === 200,
        detail: `status=${users.status}`,
      });

      const company = await http("/api/v1/settings/company", { headers });
      out.push({
        name: "GET /settings/company returns 200",
        passed: company.status === 200,
        detail: `status=${company.status}`,
      });
      const cBody = JSON.stringify(company.body ?? "");
      out.push({
        name: "Company settings reference brand 'Rathinam'",
        passed: /Rathinam/i.test(cBody),
        detail: cBody.slice(0, 80),
      });

      const pricing = await http("/api/v1/settings/pricing", { headers });
      out.push({
        name: "GET /settings/pricing returns 200",
        passed: pricing.status === 200,
        detail: `status=${pricing.status}`,
      });

      // End-to-end transfer flow: create → dispatch → receive
      if (Array.isArray(locArr) && locArr.length >= 2) {
        const products = await http("/api/v1/products?limit=1", { headers });
        const raw = (products.body as { data?: unknown })?.data;
        const items = (Array.isArray(raw) ? raw : (raw as { items?: any[] })?.items ?? []) as any[];
        const prod = items[0];
        const variantId = prod?.variants?.[0]?.id ?? prod?.variants?.[0]?.variantId;
        const fromId = (locArr[0] as { id: string }).id;
        const toId = (locArr[1] as { id: string }).id;
        if (prod && variantId) {
          const created = await http("/api/v1/transfers", {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({
              fromLocationId: fromId,
              toLocationId: toId,
              items: [{ productId: prod.id, variantId, qty: 1 }],
              notes: "verifier round-trip",
            }),
          });
          const tBody = created.body as { data?: { id?: string } };
          const tid = tBody?.data?.id;
          out.push({
            name: "POST /transfers creates a draft transfer",
            passed: created.status === 201 && !!tid,
            detail: `status=${created.status}`,
          });
          if (tid) {
            const disp = await http(`/api/v1/transfers/${tid}/dispatch`, {
              method: "PUT",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });
            out.push({
              name: "PUT /transfers/:id/dispatch returns 200",
              passed: disp.status === 200,
              detail: `status=${disp.status}`,
            });
            const recv = await http(`/api/v1/transfers/${tid}/receive`, {
              method: "PUT",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify({
                items: [{ productId: prod.id, variantId, receivedQty: 1 }],
              }),
            });
            out.push({
              name: "PUT /transfers/:id/receive returns 200",
              passed: recv.status === 200,
              detail: `status=${recv.status}`,
            });
          }
        }
      }
      return out;
    },
  },
  {
    name: "9. Public / Website APIs",
    checks: async () => {
      const out: CheckResult[] = [];
      const pub = await http("/api/v1/products/public?limit=3");
      out.push({
        name: "GET /products/public returns 200 (no auth needed)",
        passed: pub.status === 200,
        detail: `status=${pub.status}`,
      });
      const pubItems = (pub.body as { data?: { items?: Array<Record<string, unknown>> } })?.data?.items ?? [];
      const noPurchase = pubItems.every((p) => !("purchase" in p) && !("purchaseRate" in p));
      out.push({
        name: "Public products do NOT expose purchase rate",
        passed: noPurchase,
        detail: noPurchase ? "ok" : "purchase price leaked in public API",
      });
      const cp = await http("/api/v1/coupons/public");
      out.push({
        name: "GET /coupons/public returns 200 (no auth needed)",
        passed: cp.status === 200 || cp.status === 404,
        detail: `status=${cp.status}`,
      });
      return out;
    },
  },
];

async function main() {
  console.log(`\n${BOLD}${CYAN}╔════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${CYAN}║  Rathinam Crackers — System Verifier              ║${RESET}`);
  console.log(`${BOLD}${CYAN}╚════════════════════════════════════════════════════╝${RESET}`);
  console.log(`${YELLOW}Target: ${BASE}${RESET}\n`);

  let totalPass = 0;
  let totalFail = 0;
  const failures: Array<{ section: string; check: CheckResult }> = [];

  for (const section of sections) {
    console.log(`${BOLD}${CYAN}▼ ${section.name}${RESET}`);
    let results: CheckResult[];
    try {
      results = await section.checks();
    } catch (err) {
      results = [
        {
          name: "section threw error",
          passed: false,
          detail: err instanceof Error ? err.message : String(err),
        },
      ];
    }
    for (const r of results) {
      const icon = r.passed ? `${GREEN}✔${RESET}` : `${RED}✘${RESET}`;
      const detail = r.detail ? ` ${YELLOW}(${r.detail})${RESET}` : "";
      console.log(`  ${icon} ${r.name}${detail}`);
      if (r.passed) totalPass++;
      else {
        totalFail++;
        failures.push({ section: section.name, check: r });
      }
    }
    console.log();
  }

  const total = totalPass + totalFail;
  const pct = total > 0 ? Math.round((totalPass / total) * 100) : 0;
  console.log(`${BOLD}${CYAN}═════════════════════════════════════════════════════${RESET}`);
  console.log(
    `${BOLD}Result: ${totalPass}/${total} passed (${pct}%)  —  ${totalFail > 0 ? `${RED}${totalFail} FAILURES${RESET}` : `${GREEN}ALL GREEN${RESET}`}${RESET}`,
  );
  console.log(`${BOLD}${CYAN}═════════════════════════════════════════════════════${RESET}\n`);

  if (failures.length > 0) {
    console.log(`${RED}${BOLD}Failures:${RESET}`);
    for (const f of failures) {
      console.log(`  ${RED}✘${RESET} [${f.section}] ${f.check.name}${f.check.detail ? ` — ${f.check.detail}` : ""}`);
    }
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(`${RED}Verifier crashed:${RESET}`, err);
  process.exit(2);
});
