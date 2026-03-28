# ec2.tf
# The always-on backend server that runs the Express API.

# ── Find the latest Amazon Linux 2023 AMI ────────────────────────────────────
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }
}

# ── EC2 Instance ──────────────────────────────────────────────────────────────
resource "aws_instance" "backend" {
  ami                         = data.aws_ami.amazon_linux.id
  instance_type               = "t2.micro"
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.ec2_backend.id]
  iam_instance_profile        = aws_iam_instance_profile.ec2.name
  associate_public_ip_address = true

  user_data = <<-EOF
    #!/bin/bash
    set -e

    # Install Node.js 20 + git
    yum update -y
    yum install -y git
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    yum install -y nodejs

    # Pull backend code from GitHub
    git clone https://github.com/Shurui-Liu/CodeSafe.git /app
    cd /app/backend
    npm install

    # Environment variables — table names from Terraform
    export PORT=3000
    export AWS_REGION="${var.aws_region}"
    export TABLE_SCANS="${aws_dynamodb_table.scans.name}"
    export TABLE_PENTEST="${aws_dynamodb_table.pentest_results.name}"
    export TABLE_REPOS="${aws_dynamodb_table.repos.name}"
    export TABLE_SCHEDULES="${aws_dynamodb_table.schedules.name}"
    export WEBHOOK_URL="https://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000"

    # Write env vars to a file so they persist across reboots
    cat > /etc/profile.d/codesafe.sh <<ENV
    export PORT=3000
    export AWS_REGION="${var.aws_region}"
    export TABLE_SCANS="${aws_dynamodb_table.scans.name}"
    export TABLE_PENTEST="${aws_dynamodb_table.pentest_results.name}"
    export TABLE_REPOS="${aws_dynamodb_table.repos.name}"
    export TABLE_SCHEDULES="${aws_dynamodb_table.schedules.name}"
    ENV

    # Start server — nohup keeps it running after SSH session ends
    nohup node /app/backend/server.js > /var/log/backend.log 2>&1 &
  EOF

  tags = {
    Name = "${var.project_name}-backend"
  }
}