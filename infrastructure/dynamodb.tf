# dynamodb.tf
# Schema designed around the architecture diagram's data flows:
#   Writers: SAST Lambda, PenTest Lambda, EC2 Backend
#   Reader:  EC2 Backend (serves frontend dashboard)

# ── Table 1: scans ────────────────────────────────────────────────────────────
# Writer: SAST Lambda (after scanning a repo)
# Reader: EC2 Backend → GET /api/scans, GET /api/scans/:id
#
# Item shape:
# {
#   scanId:     "scan-abc123",         ← PK (unique per scan)
#   repoId:     "org/backend-api",     ← GSI PK (query all scans for a repo)
#   branch:     "main",
#   timestamp:  "2026-03-27T10:00Z",   ← GSI SK (sort by time)
#   status:     "FAIL",
#   high:       2,
#   medium:     3,
#   low:        1,
#   reportUrl:  "s3://codesafe-reports/scans/scan-abc123/report.json"
# }
resource "aws_dynamodb_table" "scans" {
  name         = "${var.project_name}-scans"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "scanId"

  attribute {
    name = "scanId"
    type = "S"
  }

  attribute {
    name = "repoId"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  # Enables: "get all scans for repo X, newest first"
  global_secondary_index {
    name            = "repoId-timestamp-index"
    hash_key        = "repoId"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  tags = { Name = "${var.project_name}-scans" }
}

# ── Table 2: pentest-results ──────────────────────────────────────────────────
# Writer: PenTest Lambda (after testing a target API)
# Reader: EC2 Backend → GET /api/pentests, GET /api/pentests/:id
#
# Item shape:
# {
#   jobId:      "job-def456",          ← PK (one job = one scheduled run)
#   testName:   "sqli",                ← SK (one item per test type per run)
#   targetId:   "https://api.../users",← GSI PK (query all results for a target)
#   timestamp:  "2026-03-27T02:00Z",   ← GSI SK (sort by time)
#   result:     "FAIL",
#   detail:     "Vulnerable to: ' OR 1=1",
#   reportUrl:  "s3://codesafe-reports/pentests/job-def456/sqli.json"
# }
resource "aws_dynamodb_table" "pentest_results" {
  name         = "${var.project_name}-pentest-results"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "jobId"
  range_key    = "testName"    # one item per test type (sqli, xss, auth, cors, idor, rate-limit)

  attribute {
    name = "jobId"
    type = "S"
  }

  attribute {
    name = "testName"
    type = "S"
  }

  attribute {
    name = "targetId"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  # Enables: "get all test results for target X, newest first"
  global_secondary_index {
    name            = "targetId-timestamp-index"
    hash_key        = "targetId"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  tags = { Name = "${var.project_name}-pentest-results" }
}

# ── Table 3: repos ────────────────────────────────────────────────────────────
# Writer: EC2 Backend (user registers a repo via the GitHub Config page)
# Reader: EC2 Backend → GET /api/repos
#         EC2 Backend → validates incoming webhooks (is this repo registered?)
#
# Item shape:
# {
#   repoId:    "org/backend-api",      ← PK (repo full name is naturally unique)
#   connected: true,
#   events:    ["push", "pull_request"],
#   addedAt:   "2026-03-27T09:00Z"
# }
resource "aws_dynamodb_table" "repos" {
  name         = "${var.project_name}-repos"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "repoId"

  attribute {
    name = "repoId"
    type = "S"
  }

  tags = { Name = "${var.project_name}-repos" }
}

# ── Table 4: schedules ────────────────────────────────────────────────────────
# Writer: EC2 Backend (user configures a pen test schedule)
# Reader: EC2 Backend → GET /api/schedules (show in dashboard)
#         EC2 Backend → reads on startup to re-register EventBridge rules
#                       (important after Student Lab session resets)
#
# Item shape:
# {
#   scheduleId:      "sched-xyz789",   ← PK
#   targetUrl:       "https://api.myapp.com/users",
#   cronExpression:  "cron(0 2 ? * MON *)",
#   tests:           ["sqli","xss","auth","cors","idor","rate-limit"],
#   eventBridgeRule: "pentest-schedule-xyz789",  ← name of the AWS rule
#   createdAt:       "2026-03-27T09:00Z",
#   status:          "ACTIVE"
# }
resource "aws_dynamodb_table" "schedules" {
  name         = "${var.project_name}-schedules"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "scheduleId"

  attribute {
    name = "scheduleId"
    type = "S"
  }

  tags = { Name = "${var.project_name}-schedules" }
}
