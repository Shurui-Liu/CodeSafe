# outputs.tf
# Share these values with teammates so they can reference
# your infrastructure in their own Terraform files.

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
