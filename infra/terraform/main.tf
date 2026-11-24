provider "hcloud" {
  token = var.hcloud_token
}

locals {
  public_key = trimspace(file(pathexpand(var.ssh_public_key_path)))
}

resource "hcloud_ssh_key" "deploy" {
  name       = "${var.name}-deploy"
  public_key = local.public_key
}

resource "hcloud_firewall" "server" {
  name = "${var.name}-firewall"

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = var.ssh_allowed_cidrs
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
}

resource "hcloud_server" "app" {
  name         = var.name
  server_type  = var.server_type
  location     = var.location
  image        = var.image
  ssh_keys     = [hcloud_ssh_key.deploy.id]
  firewall_ids = [hcloud_firewall.server.id]

  user_data = templatefile("${path.module}/cloud-init.yaml.tftpl", {
    deploy_user    = var.deploy_user
    ssh_public_key = local.public_key
  })

  labels = {
    app = var.name
  }
}
