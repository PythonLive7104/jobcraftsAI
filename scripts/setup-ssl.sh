#!/bin/bash
# Run this on the server to enable HTTPS for jobcraftsai.net
# Requires: apt install certbot (or certbot from your package manager)

set -e
cd "$(dirname "$0")/.."

echo "=== Step 1: Create certbot webroot directory ==="
mkdir -p certbot/www

echo "=== Step 2: Temporarily use HTTP-only nginx (for certbot) ==="
# Ensure we're using HTTP-only config
cp nginx/default.conf nginx/default.conf.bak 2>/dev/null || true
# default.conf should already be HTTP-only

echo "=== Step 3: Restart nginx to free port 80 for certbot (standalone) ==="
docker compose stop nginx

echo "=== Step 4: Get SSL certificate with certbot ==="
certbot certonly --standalone -d jobcraftsai.net -d www.jobcraftsai.net \
  --non-interactive --agree-tos \
  -m "${CERTBOT_EMAIL:-admin@jobcraftsai.net}"

echo "=== Step 5: Switch to SSL nginx config ==="
cp nginx/default-ssl.conf nginx/default.conf

echo "=== Step 6: Start nginx with SSL ==="
docker compose up -d nginx

echo "=== Done! https://jobcraftsai.net should now work ==="
echo "Set CERTBOT_EMAIL=your@email.com before running to use your email for cert expiry notices"
