# outputs.tf
# Share these values with teammates so they can reference
# your infrastructure in their own Terraform files.

# ── Networking ────────────────────────────────────────────────────────────────
output "vpc_id" {
  description = "VPC ID — needed by all teammates for their resources"
  value       = aws_vpc.main.id
}

output "public_subnet_id" {
  description = "Public subnet — where EC2 backend lives"
  value       = aws_subnet.public.id
}

output "private_subnet_id" {
  description = "Private subnet — for Lambda VPC config"
  value       = aws_subnet.private.id
}

output "ec2_backend_sg_id" {
  description = "Security group ID for the EC2 backend"
  value       = aws_security_group.ec2_backend.id
}

output "lambda_sg_id" {
  description = "Security group ID for Lambda functions — share with teammates"
  value       = aws_security_group.lambda.id
}

# ── IAM ───────────────────────────────────────────────────────────────────────
output "lab_role_arn" {
  description = "LabRole ARN — used by Lambda, EC2, SQS, EventBridge across the whole project"
  value       = data.aws_iam_role.lab_role.arn
}

output "ec2_instance_profile_name" {
  description = "Instance profile name — passed to EC2 resource in ec2.tf"
  value       = aws_iam_instance_profile.ec2.name
}

# ── EC2 ───────────────────────────────────────────────────────────────────────
output "ec2_public_ip" {
  description = "Public IP of the backend EC2 — use as VITE_API_URL in frontend .env.production"
  value       = aws_instance.backend.public_ip
}

output "ec2_public_dns" {
  description = "Public DNS of the backend EC2"
  value       = aws_instance.backend.public_dns
}