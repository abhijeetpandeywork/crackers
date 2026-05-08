// Centralised API base URL for every network call this app makes.
// See artifacts/erp/src/lib/api.ts for the full rationale.

import { setBaseUrl, setUnauthorizedHandler } from "@workspace/api-client-react";

export const API_BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

export const API_URL = (path: string): string => {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
};

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(API_URL(path), init);
}

if (API_BASE) {
  setBaseUrl(API_BASE);
}

export { setUnauthorizedHandler };
