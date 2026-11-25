#!/bin/sh
set -e

DEPLOY_DIR="${DEPLOY_DIR:-/opt/features}"
IMAGE="${IMAGE:-ghcr.io/slobodafr/home-features}"

cd "$DEPLOY_DIR/deploy"

export IMAGE
export IMAGE_TAG

# Convention harnais image-retention : avant le pull, fait de la place (garde 1 image par dépôt, au moins ; jamais d'image utilisée).
sh "$DEPLOY_DIR/deploy/scripts/prune-service-images.sh" --phase pre \
  --service features --image ghcr.io/slobodafr/home-features --tag "$IMAGE_TAG" --project home-features
docker compose pull
# Convention harnais deploy-wait-healthy : `docker compose up -d --wait` (repli : boucle docker inspect) ; un conteneur
# qui n'est pas sain après 180 s fait échouer le déploiement (logs, sauvegarde et restauration affichées), sans retour arrière automatique.
sh "$DEPLOY_DIR/deploy/scripts/compose-up-healthy.sh" --service features \
  --restore-args "--project home-features --volume features-data --mount /app/backend/data --db-path ${DATABASE_PATH:-/app/backend/data/features.sqlite}" \
  -- --remove-orphans
# Convention harnais image-retention : après un déploiement sain uniquement (set -e), garde la courante + la précédente (retour arrière).
sh "$DEPLOY_DIR/deploy/scripts/prune-service-images.sh" --phase post \
  --service features --image ghcr.io/slobodafr/home-features --tag "$IMAGE_TAG" --project home-features

if ! command -v caddy >/dev/null 2>&1; then
  sudo apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update -qq
  sudo apt-get install -y -qq caddy
fi

sudo mkdir -p /etc/caddy/sites
sudo cp "$DEPLOY_DIR/deploy/Caddyfile" /etc/caddy/sites/features.Caddyfile

if ! grep -q '^import sites/\*$' /etc/caddy/Caddyfile 2>/dev/null; then
  echo 'import sites/*' | sudo tee -a /etc/caddy/Caddyfile >/dev/null
fi

sudo caddy validate --config /etc/caddy/Caddyfile

sudo systemctl reload caddy
