#!/bin/bash

# Cambodia Vision - Nginx Setup Script
# Run this on the production server to configure Nginx with SSL

set -e

DOMAIN="${1:-cambodia-vision.example.com}"
EMAIL="${2:-admin@example.com}"
NGINX_CONF="/etc/nginx/sites-available/cambodia-vision"
NGINX_ENABLED="/etc/nginx/sites-enabled/cambodia-vision"

echo "🔧 Setting up Nginx for Cambodia Vision..."
echo "   Domain: $DOMAIN"
echo "   Email: $EMAIL"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root (sudo)"
    exit 1
fi

# Install Nginx if not present
if ! command -v nginx &> /dev/null; then
    echo "📦 Installing Nginx..."
    apt-get update
    apt-get install -y nginx
fi

# Install Certbot if not present
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing Certbot..."
    apt-get install -y certbot python3-certbot-nginx
fi

# Create certbot webroot directory
mkdir -p /var/www/certbot

# Copy Nginx configuration
echo "📝 Installing Nginx configuration..."
cp "$(dirname "$0")/cambodia-vision.conf" "$NGINX_CONF"

# Replace example domain with actual domain
sed -i "s/cambodia-vision.example.com/$DOMAIN/g" "$NGINX_CONF"

# Enable the site
ln -sf "$NGINX_CONF" "$NGINX_ENABLED"

# Remove default site if it exists
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration (will fail on SSL certs if they don't exist yet)
# First, temporarily comment out SSL block for initial cert request
echo "🔒 Obtaining SSL certificate..."
certbot certonly --webroot -w /var/www/certbot \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --non-interactive || {
    echo "⚠️  Certbot webroot failed, trying standalone..."
    systemctl stop nginx
    certbot certonly --standalone \
        -d "$DOMAIN" \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --non-interactive
    systemctl start nginx
}

# Test and reload Nginx
echo "🔄 Testing and reloading Nginx..."
nginx -t
systemctl reload nginx
systemctl enable nginx

# Set up auto-renewal
echo "⏰ Setting up certificate auto-renewal..."
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | sort -u | crontab -

echo ""
echo "✅ Nginx setup complete!"
echo "🌐 Site available at: https://$DOMAIN"
echo "🔒 SSL certificate installed and auto-renewal configured"
echo ""
echo "📋 Next steps:"
echo "   1. Ensure DNS A record points $DOMAIN to this server"
echo "   2. Start the application: docker compose -f docker-compose.prod.yml up -d"
echo "   3. Verify: curl -I https://$DOMAIN"
