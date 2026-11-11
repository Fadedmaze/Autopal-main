#!/bin/sh
# Makes the key pair for push notifications. Run in Terminal on a Mac:
#   sh supabase/setup/make_vapid_keys.sh
# PUBLIC key  -> paste into js/config.js (VAPID_PUBLIC_KEY) and the VAPID_PUBLIC_KEY secret.
# PRIVATE key -> paste ONLY into the Supabase secret VAPID_PRIVATE_KEY. Never commit or share it.
set -e
pem=$(mktemp)
openssl ecparam -name prime256v1 -genkey -noout -out "$pem"
b64url() { base64 | tr -d '\n=' | tr '/+' '_-'; }
echo "PUBLIC key:"
openssl ec -in "$pem" -pubout -outform DER 2>/dev/null | tail -c 65 | b64url; echo
echo "PRIVATE key:"
openssl ec -in "$pem" -outform DER 2>/dev/null | tail -c +8 | head -c 32 | b64url; echo
rm -f "$pem"
