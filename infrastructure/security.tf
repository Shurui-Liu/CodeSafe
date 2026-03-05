# security.tf

# --- EC2 Backend Security Group ---
# Controls what traffic can reach our containerized backend API
resource "aws_security_group" "ec2_backend" {
  name        = "${var.project_name}-ec2-backend-sg"
  description = "Allow inbound HTTPS and app port; allow all outbound"
  vpc_id      = aws_vpc.main.id

  # Allow HTTPS from anywhere (CloudFront → EC2)
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow your app's port (e.g. 3000 or 8080 — change to match your backend)
  ingress {
    description = "App port"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow SSH only from your own IP for debugging
  # Replace 0.0.0.0/0 with your actual IP in production
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # TODO: restrict to your IP
  }

  # Allow all outbound traffic (EC2 needs to call DynamoDB, S3, etc.)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-ec2-backend-sg"
  }
}

# --- Lambda Security Group ---
# Used by both SAST and PenTest Lambda functions
resource "aws_security_group" "lambda" {
  name        = "${var.project_name}-lambda-sg"
  description = "Lambda functions - outbound only"
  vpc_id      = aws_vpc.main.id

  # Lambdas don't receive inbound connections — they're triggered by events
  # No ingress rules needed

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-lambda-sg"
  }
}