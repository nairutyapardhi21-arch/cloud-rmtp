#!/usr/bin/env bash
set -euo pipefail
# Ubuntu 24.04 bootstrap for a small demonstration EC2 host.
apt-get update
apt-get install -y ca-certificates curl docker.io docker-compose-v2 awscli
systemctl enable --now docker
mkdir -p /opt/cloud-restreamer
echo 'Bootstrap complete. Copy the repository to /opt/cloud-restreamer, create .env, then run Docker Compose.'

