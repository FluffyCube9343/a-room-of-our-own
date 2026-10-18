variable "aws_region" {
  description = "Region for every resource."
  type        = string
  default     = "us-east-1"
}

variable "app_name" {
  description = "Prefix for every resource this stack owns."
  type        = string
  default     = "roomofourown"
}

variable "domain_name" {
  description = "Apex domain that should serve the app. The hosted zone is created here; its nameservers go into GoDaddy."
  type        = string
  default     = "roomofourown.us"
}

# Tiger Cloud connection (the password goes to Secrets Manager by hand, never here).
variable "tiger_host" {
  description = "Tiger Cloud service host, e.g. abc123.def456.tsdb.cloud.timescale.com"
  type        = string
}

variable "tiger_db" {
  type    = string
  default = "tsdb"
}

variable "tiger_user" {
  type    = string
  default = "tsdbadmin"
}

variable "tiger_port" {
  type    = string
  default = "5432"
}
