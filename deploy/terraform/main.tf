terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

locals {
  image = "${aws_ecr_repository.app.repository_url}:latest"
}

# --- DNS: hosted zone for the GoDaddy domain; its nameservers go into GoDaddy ---

resource "aws_route53_zone" "app" {
  name = var.domain_name
}

# --- Container registry ---

resource "aws_ecr_repository" "app" {
  name         = var.app_name
  force_delete = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

# --- Secrets (values are set by hand with the CLI, never in this file) ---

resource "aws_secretsmanager_secret" "db_password" {
  name                    = "${var.app_name}/db-password"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret" "django_secret_key" {
  name                    = "${var.app_name}/django-secret-key"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret" "gemini_api_key" {
  name                    = "${var.app_name}/gemini-api-key"
  recovery_window_in_days = 0
}

# --- Media bucket for profile photos ---

resource "aws_s3_bucket" "media" {
  bucket = "${var.app_name}-media-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# --- Networking ---

resource "aws_security_group" "alb" {
  name        = "${var.app_name}-alb"
  description = "Public web access to the load balancer"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "app" {
  name        = "${var.app_name}-app"
  description = "ECS tasks, reachable only from the load balancer"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Tasks need outbound to Tiger Cloud (port varies) and package/image pulls.
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# --- Load balancer, certificate, DNS records ---

resource "aws_lb" "app" {
  name               = var.app_name
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = data.aws_subnets.default.ids
}

resource "aws_lb_target_group" "app" {
  name        = var.app_name
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.default.id
  target_type = "ip"

  health_check {
    path    = "/healthz/"
    matcher = "200"
  }
}

resource "aws_acm_certificate" "app" {
  domain_name               = var.domain_name
  subject_alternative_names = ["www.${var.domain_name}"]
  validation_method         = "DNS"
}

resource "aws_route53_record" "cert_validation" {
  for_each = { for o in aws_acm_certificate.app.domain_validation_options : o.domain_name => o }

  name    = each.value.resource_record_name
  type    = each.value.resource_record_type
  zone_id = aws_route53_zone.app.zone_id
  records = [each.value.resource_record_value]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "app" {
  certificate_arn         = aws_acm_certificate.app.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.app.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = aws_acm_certificate_validation.app.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_route53_record" "app" {
  for_each = toset(["", "www"])

  zone_id = aws_route53_zone.app.zone_id
  name    = each.key == "" ? var.domain_name : "www.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.app.dns_name
    zone_id                = aws_lb.app.zone_id
    evaluate_target_health = false
  }
}

# --- ECS (Fargate) ---

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${var.app_name}"
  retention_in_days = 7
}

resource "aws_iam_role" "execution" {
  name = "${var.app_name}-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "execution_secrets" {
  name = "read-secrets"
  role = aws_iam_role.execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = [aws_secretsmanager_secret.db_password.arn, aws_secretsmanager_secret.django_secret_key.arn, aws_secretsmanager_secret.gemini_api_key.arn]
    }]
  })
}

resource "aws_iam_role" "task" {
  name = "${var.app_name}-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "task_media" {
  name = "media-bucket"
  role = aws_iam_role.task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
      Resource = "${aws_s3_bucket.media.arn}/*"
    }]
  })
}

resource "aws_ecs_cluster" "app" {
  name = var.app_name
}

resource "aws_ecs_task_definition" "app" {
  family                   = var.app_name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name      = "app"
    image     = local.image
    essential = true

    portMappings = [{ containerPort = 8000, protocol = "tcp" }]

    environment = [
      { name = "DJANGO_DEBUG", value = "0" },
      { name = "DJANGO_ALLOWED_HOSTS", value = "${var.domain_name},www.${var.domain_name},${aws_lb.app.dns_name}" },
      { name = "DJANGO_CSRF_TRUSTED_ORIGINS", value = "https://${var.domain_name},https://www.${var.domain_name}" },
      { name = "DJANGO_BEHIND_PROXY", value = "1" },
      { name = "DB_HOST", value = var.tiger_host },
      { name = "DB_NAME", value = var.tiger_db },
      { name = "DB_USER", value = var.tiger_user },
      { name = "DB_PORT", value = var.tiger_port },
      { name = "AWS_STORAGE_BUCKET_NAME", value = aws_s3_bucket.media.bucket },
      { name = "AWS_S3_REGION_NAME", value = var.aws_region },
      { name = "GEMINI_MODEL", value = var.gemini_model },
    ]

    secrets = [
      { name = "DB_PASSWORD", valueFrom = aws_secretsmanager_secret.db_password.arn },
      { name = "DJANGO_SECRET_KEY", valueFrom = aws_secretsmanager_secret.django_secret_key.arn },
      { name = "GEMINI_API_KEY", valueFrom = aws_secretsmanager_secret.gemini_api_key.arn },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.app.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "app"
      }
    }
  }])
}

resource "aws_ecs_service" "app" {
  name            = var.app_name
  cluster         = aws_ecs_cluster.app.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "app"
    container_port   = 8000
  }

  depends_on = [aws_lb_listener.https]
}
