// backend/server.js
// Express API wired to DynamoDB using AWS SDK v3.
// Run: node server.js
// Requires env vars: AWS_REGION, TABLE_SCANS, TABLE_PENTEST, TABLE_REPOS, TABLE_SCHEDULES

const express    = require("express");
const cors       = require("cors");
const { DynamoDBClient }         = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient,
        GetCommand, PutCommand,
        QueryCommand, ScanCommand,
        DeleteCommand }           = require("@aws-sdk/lib-dynamodb");
const { randomUUID }             = require("crypto");

// ── Config ────────────────────────────────────────────────────────────────────
const app    = express();
const PORT   = process.env.PORT ?? 3000;
const REGION = process.env.AWS_REGION ?? "us-west-2";

// Table names come from terraform output — set as env vars on EC2
const TABLES = {
  scans:     process.env.TABLE_SCANS     ?? "codesafe-scans",
  pentest:   process.env.TABLE_PENTEST   ?? "codesafe-pentest-results",
  repos:     process.env.TABLE_REPOS     ?? "codesafe-repos",
  schedules: process.env.TABLE_SCHEDULES ?? "codesafe-schedules",
};

// The EC2 instance uses LabRole via instance profile — no keys needed
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

app.use(cors({ origin: "*" }));
app.use(express.json());

// ── Helper ────────────────────────────────────────────────────────────────────
// Wraps async route handlers — catches errors and returns 500
const wrap = fn => (req, res) =>
  fn(req, res).catch(e => {
    console.error(e);
    res.status(500).json({ error: e.message });
  });

// ── SAST ──────────────────────────────────────────────────────────────────────

// GET /api/scans
// Returns all scans. In production, filter by repoId using the GSI.
app.get("/api/scans", wrap(async (req, res) => {
  const { repoId } = req.query;

  if (repoId) {
    // Query GSI: all scans for a specific repo, newest first
    const result = await ddb.send(new QueryCommand({
      TableName:                TABLES.scans,
      IndexName:                "repoId-timestamp-index",
      KeyConditionExpression:   "repoId = :r",
      ExpressionAttributeValues: { ":r": repoId },
      ScanIndexForward:         false,   // newest first
    }));
    return res.json(result.Items);
  }

  // No filter — return all scans (fine for small class project)
  const result = await ddb.send(new ScanCommand({ TableName: TABLES.scans }));
  res.json(result.Items);
}));

// GET /api/scans/:id
// Returns full scan detail including S3 report URL
app.get("/api/scans/:id", wrap(async (req, res) => {
  const result = await ddb.send(new GetCommand({
    TableName: TABLES.scans,
    Key: { scanId: req.params.id },
  }));
  if (!result.Item) return res.status(404).json({ error: "Scan not found" });
  res.json(result.Item);
}));

// POST /api/scans
// Called by SAST Lambda after it finishes scanning a repo
app.post("/api/scans", wrap(async (req, res) => {
  const { repoId, branch, status, high, medium, low,
          vulnerabilities, reportUrl } = req.body;

  const item = {
    scanId:          randomUUID(),
    repoId,
    branch,
    timestamp:       new Date().toISOString(),
    status,          // "PASS" | "FAIL" | "WARN"
    high:            high    ?? 0,
    medium:          medium  ?? 0,
    low:             low     ?? 0,
    vulnerabilities: vulnerabilities ?? [],
    reportUrl,       // s3:// URL to full JSON report
  };

  await ddb.send(new PutCommand({ TableName: TABLES.scans, Item: item }));
  res.status(201).json(item);
}));

// ── PenTest ───────────────────────────────────────────────────────────────────

// GET /api/pentests
// Returns all pen test results grouped by targetId
app.get("/api/pentests", wrap(async (req, res) => {
  const { targetId } = req.query;

  if (targetId) {
    // Query GSI: all results for a specific target, newest first
    const result = await ddb.send(new QueryCommand({
      TableName:                 TABLES.pentest,
      IndexName:                 "targetId-timestamp-index",
      KeyConditionExpression:    "targetId = :t",
      ExpressionAttributeValues: { ":t": targetId },
      ScanIndexForward:          false,
    }));
    return res.json(result.Items);
  }

  const result = await ddb.send(new ScanCommand({ TableName: TABLES.pentest }));
  res.json(result.Items);
}));

// GET /api/pentests/:id
// Returns all test results for a given jobId (all 6 test types)
app.get("/api/pentests/:id", wrap(async (req, res) => {
  // Query by PK — returns all testName variants for this jobId
  const result = await ddb.send(new QueryCommand({
    TableName:                 TABLES.pentest,
    KeyConditionExpression:    "jobId = :j",
    ExpressionAttributeValues: { ":j": req.params.id },
  }));
  if (!result.Items?.length) return res.status(404).json({ error: "Job not found" });
  res.json({ jobId: req.params.id, tests: result.Items });
}));

// POST /api/pentests
// Called by PenTest Lambda after running a single test against a target
app.post("/api/pentests", wrap(async (req, res) => {
  const { jobId, testName, targetId, result, detail, reportUrl } = req.body;

  const item = {
    jobId:     jobId ?? randomUUID(),
    testName,  // "sqli" | "xss" | "auth" | "cors" | "idor" | "rate-limit"
    targetId,  // the URL being tested
    timestamp: new Date().toISOString(),
    result,    // "PASS" | "FAIL" | "WARN"
    detail,    // human-readable explanation
    reportUrl, // s3:// URL to full test output
  };

  await ddb.send(new PutCommand({ TableName: TABLES.pentest, Item: item }));
  res.status(201).json(item);
}));

// ── GitHub Config ─────────────────────────────────────────────────────────────

// GET /api/webhook-url
// Returns the API Gateway webhook URL for the user to paste into GitHub
app.get("/api/webhook-url", (req, res) => {
  res.json({ url: process.env.WEBHOOK_URL ?? "https://<api-gateway-id>.execute-api.us-west-2.amazonaws.com/webhook" });
});

// GET /api/repos
// Returns all connected repos
app.get("/api/repos", wrap(async (req, res) => {
  const result = await ddb.send(new ScanCommand({ TableName: TABLES.repos }));
  res.json(result.Items);
}));

// POST /api/repos
// Registers a new repo
app.post("/api/repos", wrap(async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });

  const item = {
    repoId:    name,          // "org/repo-name" is naturally unique
    connected: false,         // becomes true once webhook is confirmed
    events:    [],
    addedAt:   new Date().toISOString(),
  };

  await ddb.send(new PutCommand({ TableName: TABLES.repos, Item: item }));
  res.status(201).json(item);
}));

// ── Schedules ─────────────────────────────────────────────────────────────────

// GET /api/schedules
// Returns all configured pen test schedules
app.get("/api/schedules", wrap(async (req, res) => {
  const result = await ddb.send(new ScanCommand({ TableName: TABLES.schedules }));
  res.json(result.Items);
}));

// POST /api/schedules
// Creates a new pen test schedule + writes the EventBridge rule
app.post("/api/schedules", wrap(async (req, res) => {
  const { targetUrl, cronExpression, tests } = req.body;
  if (!targetUrl || !cronExpression) {
    return res.status(400).json({ error: "targetUrl and cronExpression are required" });
  }

  const scheduleId      = randomUUID();
  const eventBridgeRule = `pentest-schedule-${scheduleId}`;

  const item = {
    scheduleId,
    targetUrl,
    cronExpression,       // e.g. "cron(0 2 ? * MON *)"
    tests:           tests ?? ["sqli","xss","auth","cors","idor","rate-limit"],
    eventBridgeRule,      // store rule name so we can delete it later
    createdAt:       new Date().toISOString(),
    status:          "ACTIVE",
  };

  // Save to DynamoDB first
  await ddb.send(new PutCommand({ TableName: TABLES.schedules, Item: item }));

  // TODO: write EventBridge rule here using @aws-sdk/client-eventbridge
  // const eb = new EventBridgeClient({ region: REGION });
  // await eb.send(new PutRuleCommand({ Name: eventBridgeRule, ScheduleExpression: cronExpression }));
  // await eb.send(new PutTargetsCommand({ Rule: eventBridgeRule, Targets: [...] }));

  res.status(201).json(item);
}));

// DELETE /api/schedules/:id
// Removes a schedule and its EventBridge rule
app.delete("/api/schedules/:id", wrap(async (req, res) => {
  // Fetch first so we can get the EventBridge rule name
  const existing = await ddb.send(new GetCommand({
    TableName: TABLES.schedules,
    Key: { scheduleId: req.params.id },
  }));
  if (!existing.Item) return res.status(404).json({ error: "Schedule not found" });

  // TODO: delete EventBridge rule using @aws-sdk/client-eventbridge
  // await eb.send(new RemoveTargetsCommand({ Rule: existing.Item.eventBridgeRule, Ids: ["sqs-target"] }));
  // await eb.send(new DeleteRuleCommand({ Name: existing.Item.eventBridgeRule }));

  await ddb.send(new DeleteCommand({
    TableName: TABLES.schedules,
    Key: { scheduleId: req.params.id },
  }));

  res.json({ deleted: req.params.id });
}));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`CodeSafe API running on http://localhost:${PORT}`);
  console.log(`Region: ${REGION}`);
  console.log(`Tables:`, TABLES);
});