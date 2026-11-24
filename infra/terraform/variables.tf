variable "hcloud_token" {
  description = "Hetzner Cloud API token with read and write access."
  type        = string
  sensitive   = true
}

variable "name" {
  description = "Name for the server, SSH key and firewall."
  type        = string
  default     = "monorepo-template"
}

variable "server_type" {
  description = "Hetzner Cloud server type."
  type        = string
  default     = "cax11"
}

variable "location" {
  description = "Hetzner Cloud location."
  type        = string
  default     = "fsn1"
}

variable "image" {
  description = "Operating system image."
  type        = string
  default     = "ubuntu-24.04"
}

variable "ssh_public_key_path" {
  description = "Public key added to the deploy user."
  type        = string
  default     = "~/.ssh/id_ed25519.pub"
}

variable "ssh_allowed_cidrs" {
  description = "CIDR blocks allowed to reach SSH. Restrict this to your own addresses."
  type        = list(string)
}

variable "deploy_user" {
  description = "Unprivileged user that receives the SSH key and owns the application."
  type        = string
  default     = "deploy"
}
