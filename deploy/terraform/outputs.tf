output "app_url" {
  value = "https://${var.domain_name}"
}

output "name_servers" {
  description = "Paste these four into the domain's nameserver settings at GoDaddy."
  value       = aws_route53_zone.app.name_servers
}

output "alb_dns_name" {
  value = aws_lb.app.dns_name
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}

output "media_bucket" {
  value = aws_s3_bucket.media.bucket
}

output "db_password_secret_name" {
  value = aws_secretsmanager_secret.db_password.name
}

output "django_secret_key_secret_name" {
  value = aws_secretsmanager_secret.django_secret_key.name
}

output "ecs_cluster" {
  value = aws_ecs_cluster.app.name
}

output "ecs_service" {
  value = aws_ecs_service.app.name
}
