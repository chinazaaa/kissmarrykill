locals {
  # Prefer the real public URL (needed when HTTPS/redirects are on); otherwise
  # hit the ALB directly over HTTP.
  tick_url = var.app_base_url != "" ? "${var.app_base_url}/api/describe-it/tick" : "http://${aws_lb.main.dns_name}/api/describe-it/tick"
}

data "archive_file" "tick_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/tick"
  output_path = "${path.module}/.build/tick-lambda.zip"
}

# --- Lambda execution role (CloudWatch Logs only) ---
data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "tick_lambda" {
  name               = "${var.name_prefix}-tick-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "tick_lambda_logs" {
  role       = aws_iam_role.tick_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "tick" {
  function_name    = "${var.name_prefix}-tick"
  role             = aws_iam_role.tick_lambda.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  filename         = data.archive_file.tick_lambda.output_path
  source_code_hash = data.archive_file.tick_lambda.output_base64sha256
  timeout          = 30

  environment {
    variables = {
      TICK_URL    = local.tick_url
      CRON_SECRET = var.cron_secret
    }
  }
}

# --- EventBridge Scheduler -> Lambda ---
data "aws_iam_policy_document" "scheduler_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "${var.name_prefix}-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume.json
}

data "aws_iam_policy_document" "scheduler_invoke" {
  statement {
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.tick.arn]
  }
}

resource "aws_iam_role_policy" "scheduler_invoke" {
  name   = "${var.name_prefix}-scheduler-invoke"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler_invoke.json
}

resource "aws_scheduler_schedule" "tick" {
  name = "${var.name_prefix}-tick"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = var.tick_schedule

  target {
    arn      = aws_lambda_function.tick.arn
    role_arn = aws_iam_role.scheduler.arn
  }
}
