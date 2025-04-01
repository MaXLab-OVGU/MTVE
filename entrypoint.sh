#!/bin/sh

# Replace environment variables in nginx.conf
envsubst '$CERT_DOMAIN' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Start Nginx
nginx -g "daemon off;"
