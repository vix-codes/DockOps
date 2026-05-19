#!/bin/bash
# Create initial admin user
# Usage: ./init-admin.sh <vps-ip> <username> <password> <email> <fullname>

VPS_IP="${1:-143.198.160.235}"
USERNAME="${2:-admin}"
PASSWORD="${3:-changeme123}"
EMAIL="${4:-admin@example.com}"
FULLNAME="${5:-DockOps Admin}"

curl -s -X POST "http://${VPS_IP}/api/auth/register/init" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"${USERNAME}\",
    \"password\": \"${PASSWORD}\",
    \"email\": \"${EMAIL}\",
    \"fullName\": \"${FULLNAME}\",
    \"role\": \"ROLE_ADMIN\"
  }" | python3 -m json.tool

echo ""
echo "Admin user '${USERNAME}' created. Login at your frontend URL."
