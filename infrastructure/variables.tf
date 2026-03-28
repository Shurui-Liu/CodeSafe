variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Used as a prefix for all named resources"
  type        = string
  default     = "codesafe"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR block for the public subnet (EC2 lives here)"
  type        = string
  default     = "10.0.1.0/24"
}

variable "private_subnet_cidr" {
  description = "CIDR block for the private subnet (DynamoDB endpoints, future use)"
  type        = string
  default     = "10.0.2.0/24"
}

variable "az" {
  description = "Availability zone to use"
  type        = string
  default     = "us-east-1a"
}