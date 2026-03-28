# ec2.tf
# The always-on backend server that runs the Express API in a Docker container.

# ── Find the latest Amazon Linux 2023 AMI ────────────────────────────────────
# Instead of hardcoding an AMI ID (which changes per region),
# we look up the latest official Amazon Linux 2023 image automatically.
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
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = "t2.micro"
  subnet_id              = aws_subnet.public.id                        # lives in public subnet
  vpc_security_group_ids = [aws_security_group.ec2_backend.id]        # firewall rules
  iam_instance_profile   = aws_iam_instance_profile.ec2.name          # LabRole via instance profile
  associate_public_ip_address = true                                   # needs a public IP for CloudFront → EC2

  # user_data runs once when the instance first boots.
  # It installs Docker, pulls your backend code, and starts the Express server.
  user_data = <<-EOF
    #!/bin/bash
    set -e

    # Install Docker
    yum update -y
    yum install -y docker git
    systemctl start docker
    systemctl enable docker

    # Install Node.js 20
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    yum install -y nodejs

    # Pull backend code from GitHub
    git clone https://github.com/Shurui-Liu/CodeSafe.git /app
    cd /app/backend

    # Install dependencies and start server
    npm install
    
    # Set environment variables
    export PORT=3000
    export WEBHOOK_URL="https://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"

    # Run with nohup so it keeps running after SSH session ends
    nohup node server.js > /var/log/backend.log 2>&1 &
  EOF

  tags = {
    Name = "${var.project_name}-backend"
  }
}