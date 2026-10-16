#!/usr/bin/env bash
# Optional fallback on an existing Oracle Ubuntu VM. Never creates an account,
# requests a card, uploads credentials, or modifies another managed service.
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then echo "Run as root on the target VM." >&2; exit 1; fi
if [[ $# -ne 2 ]]; then echo "Usage: provision-oracle.sh IMAGE_REFERENCE PRIVATE_ENV_FILE" >&2; exit 1; fi
image_ref=$1
source_env=$2
if [[ ! $image_ref =~ ^[a-zA-Z0-9][a-zA-Z0-9./:@_-]+$ ]]; then echo "Invalid image reference." >&2; exit 1; fi
if [[ ! -f $source_env ]]; then echo "The private environment file is missing." >&2; exit 1; fi
if ! grep -Eq '^WA_DISABLED=1$' "$source_env"; then echo "Initial stability deployment requires WA_DISABLED=1." >&2; exit 1; fi
if [[ -e /etc/systemd/system/totem-worker.service || -e /etc/totem-worker/env ]]; then
  echo "A Totem worker configuration already exists; refusing to overwrite it." >&2; exit 1
fi
command -v docker >/dev/null || { echo "Install Docker Engine on this VM before provisioning." >&2; exit 1; }
if docker container inspect totem-worker >/dev/null 2>&1; then echo "Container name already in use." >&2; exit 1; fi

docker pull "$image_ref"
install -d -m 700 /etc/totem-worker
install -m 600 "$source_env" /etc/totem-worker/env
cat > /etc/systemd/system/totem-worker.service <<EOF
[Unit]
Description=Totem WhatsApp worker (stability mode)
After=docker.service network-online.target
Requires=docker.service

[Service]
Restart=on-failure
RestartSec=10
ExecStart=/usr/bin/docker run --rm --name totem-worker --label app=totem-worker --env-file /etc/totem-worker/env --env PORT=8080 --publish 127.0.0.1:8080:8080 $image_ref
ExecStop=/usr/bin/docker stop --time 30 totem-worker
TimeoutStopSec=40

[Install]
WantedBy=multi-user.target
EOF
chmod 644 /etc/systemd/system/totem-worker.service
systemctl daemon-reload
systemctl enable --now totem-worker.service
echo "Worker started in stability mode. Health is bound to 127.0.0.1:8080. Configure TLS forwarding separately."
