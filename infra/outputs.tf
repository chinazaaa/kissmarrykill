output "alb_dns_name" {
  description = "Public DNS name of the load balancer. Point your domain's CNAME/ALIAS here."
  value       = aws_lb.main.dns_name
}

output "app_url" {
  description = "URL the app is reachable at."
  value       = var.app_base_url != "" ? var.app_base_url : "http://${aws_lb.main.dns_name}"
}

output "ecr_repository_url" {
  description = "Push the app image here (tag must match var.app_image_tag)."
  value       = aws_ecr_repository.app.repository_url
}

output "vpc_id" {
  description = "ID of the created VPC."
  value       = aws_vpc.main.id
}

output "tick_lambda_name" {
  description = "Name of the freeze-recovery tick Lambda."
  value       = aws_lambda_function.tick.function_name
}
