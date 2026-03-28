// frontend/src/api/client.js
// All API calls go through here — one place to change the base URL.
//
// Usage in any page:
//   import { getScanList, getScanById } from "../api/client";
//   const scans = await getScanList();

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${msg}`);
  }
  return res.json();
}

// ── SAST ──────────────────────────────────────────────────────────────────────
// GET /api/scans         → list of all scans (summary)
// GET /api/scans/:id     → full vulnerability breakdown + S3 report URL
export const getScanList  = ()   => apiFetch("/api/scans");
export const getScanById  = (id) => apiFetch(`/api/scans/${id}`);

// ── PenTest ───────────────────────────────────────────────────────────────────
// GET /api/pentests      → list of all pen test targets
// GET /api/pentests/:id  → full test results for one target
export const getPentestList = ()   => apiFetch("/api/pentests");
export const getPentestById = (id) => apiFetch(`/api/pentests/${id}`);

// ── GitHub Config ─────────────────────────────────────────────────────────────
// GET  /api/repos        → list of connected repos
// POST /api/repos        → register a new repo
// GET  /api/webhook-url  → the API Gateway URL to paste into GitHub
export const getRepos      = ()     => apiFetch("/api/repos");
export const getWebhookUrl = ()     => apiFetch("/api/webhook-url");
export const addRepo       = (name) => apiFetch("/api/repos", {
  method: "POST",
  body: JSON.stringify({ name }),
});
