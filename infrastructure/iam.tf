
# iam.tf
# AWS Student Lab restriction: we cannot create IAM roles or policies.
# Instead we look up the pre-existing LabRole and reference it everywhere.

# ── Look up LabRole ───────────────────────────────────────────────────────────
# This is the single IAM role used by ALL services in the project:
# EC2, Lambda (SAST + PenTest), SQS, EventBridge
data "aws_iam_role" "lab_role" {
  name = "LabRole"
}

# ── EC2 Instance Profile ──────────────────────────────────────────────────────
# EC2 cannot use an IAM role directly — it needs an "instance profile" wrapper.
# This is what allows the EC2 backend to call DynamoDB, S3, etc. without
# hardcoding any credentials.
resource "aws_iam_instance_profile" "ec2" {
  name = "${var.project_name}-ec2-profile"
  role = data.aws_iam_role.lab_role.name
}