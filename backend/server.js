// backend/server.js
// Mock Express server — returns fake data so the frontend works now.
// When real services are ready, I will replace the mock data with real DB/Lambda calls.

const express = require("express");
const cors    = require("cors");
const app     = express();

app.use(cors({ origin: "http://localhost:5173" })); // Vite dev server
app.use(express.json());

// ── SAST ──────────────────────────────────────────────────────────────────────

// GET /api/scans — list of all scans (summary only, no vulnerability details)
app.get("/api/scans", (req, res) => {
  res.json([
    { id: "s1", repo: "org/backend-api",  branch: "main",           time: "2h ago",  status: "FAIL", high: 2, medium: 3, low: 1 },
    { id: "s2", repo: "org/auth-service", branch: "main",           time: "5h ago",  status: "PASS", high: 0, medium: 1, low: 2 },
    { id: "s3", repo: "org/frontend-app", branch: "feature/login",  time: "1d ago",  status: "WARN", high: 0, medium: 2, low: 4 },
  ]);
});

// GET /api/scans/:id — full vulnerability breakdown + presigned S3 report URL
app.get("/api/scans/:id", (req, res) => {
  // TODO: query DynamoDB for metadata, generate presigned S3 URL for report
  res.json({
    id: req.params.id,
    vulnerabilities: [
      { name: "SQL Injection",        severity: "HIGH",   result: "FAIL" },
      { name: "Hardcoded Secret",     severity: "HIGH",   result: "FAIL" },
      { name: "XSS",                  severity: "MEDIUM", result: "WARN" },
      { name: "Insecure Dependency",  severity: "MEDIUM", result: "WARN" },
      { name: "Missing Auth Header",  severity: "LOW",    result: "PASS" },
    ],
    reportUrl: `https://codesafe-reports.s3.amazonaws.com/scans/${req.params.id}/report.json`,
  });
});

// ── PenTest ───────────────────────────────────────────────────────────────────

// GET /api/pentests — list of all configured pen test targets
app.get("/api/pentests", (req, res) => {
  res.json([
    {
      id: "p1",
      target:   "https://api.myapp.com/users",
      schedule: "Mon 2:00am",
      lastRun:  "2d ago",
      tests: [
        { name: "SQL Injection", result: "FAIL" },
        { name: "Auth Bypass",   result: "PASS" },
        { name: "XSS",           result: "WARN" },
        { name: "Rate Limiting", result: "PASS" },
        { name: "IDOR",          result: "PASS" },
        { name: "CORS",          result: "FAIL" },
      ],
    },
    {
      id: "p2",
      target:   "https://api.myapp.com/auth",
      schedule: "Daily 3:00am",
      lastRun:  "1d ago",
      tests: [
        { name: "SQL Injection", result: "PASS" },
        { name: "Auth Bypass",   result: "PASS" },
        { name: "XSS",           result: "PASS" },
        { name: "Rate Limiting", result: "FAIL" },
        { name: "IDOR",          result: "PASS" },
        { name: "CORS",          result: "PASS" },
      ],
    },
  ]);
});

// GET /api/pentests/:id — full test details for one target
app.get("/api/pentests/:id", (req, res) => {
  // TODO: query DynamoDB for full test results by jobId
  res.json({
    id: req.params.id,
    tests: [
      { name: "SQL Injection", result: "FAIL", detail: "Vulnerable to payload: ' OR 1=1" },
      { name: "Auth Bypass",   result: "PASS", detail: "Authorization headers validated correctly" },
      { name: "XSS",           result: "WARN", detail: "Reflected input found, sanitization incomplete" },
      { name: "Rate Limiting", result: "PASS", detail: "429 returned after 100 req/min" },
      { name: "IDOR",          result: "PASS", detail: "Object references properly scoped to user" },
      { name: "CORS",          result: "FAIL", detail: "Wildcard origin (*) accepted on credentialed request" },
    ],
  });
});

// ── GitHub Config ─────────────────────────────────────────────────────────────

// GET /api/webhook-url — returns the API Gateway webhook URL for the user to paste into GitHub
app.get("/api/webhook-url", (req, res) => {
  // TODO: read from environment variable set during Terraform deploy
  res.json({ url: process.env.WEBHOOK_URL ?? "https://abc123.execute-api.us-west-2.amazonaws.com/webhook" });
});

// GET /api/repos — list of connected repos
app.get("/api/repos", (req, res) => {
  // TODO: query DynamoDB repos table
  res.json([
    { id: "r1", name: "org/backend-api",  connected: true,  events: ["push", "pull_request"] },
    { id: "r2", name: "org/auth-service", connected: true,  events: ["push"] },
    { id: "r3", name: "org/frontend-app", connected: false, events: [] },
  ]);
});

// POST /api/repos — register a new repo
app.post("/api/repos", (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  // TODO: save to DynamoDB, register webhook with GitHub API
  res.status(201).json({ id: `r${Date.now()}`, name, connected: false, events: [] });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`Mock API running on http://localhost:${PORT}`));