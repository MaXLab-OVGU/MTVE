#!/bin/sh

# Exit immediately if a command exits with a non-zero status
set -e

echo "Applying database migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Starting Django server..."
python -m gunicorn --bind 0.0.0.0:8000 --workers 3 MaxLabProject.wsgi:application
