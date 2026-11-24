output "ipv4" {
  description = "Public IPv4 address of the server."
  value       = hcloud_server.app.ipv4_address
}

output "ssh" {
  description = "SSH command for the deploy user."
  value       = "ssh ${var.deploy_user}@${hcloud_server.app.ipv4_address}"
}

output "ansible_inventory" {
  description = "Inventory entry for infra/ansible/inventory.yml."
  value       = <<-EOT
    all:
      hosts:
        ${var.name}:
          ansible_host: ${hcloud_server.app.ipv4_address}
          ansible_user: ${var.deploy_user}
  EOT
}
