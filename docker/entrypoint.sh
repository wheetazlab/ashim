#!/bin/sh
set -e

# Apply auth defaults at runtime so they are never baked into image layers.
# Users can override any of these via -e flags at docker run time.
export AUTH_ENABLED="${AUTH_ENABLED:-true}"
export DEFAULT_USERNAME="${DEFAULT_USERNAME:-admin}"
export DEFAULT_PASSWORD="${DEFAULT_PASSWORD:-admin}"

# Clean up any interrupted bootstrap from a previous start
AI_VENV="/data/ai/venv"
AI_VENV_TMP="/data/ai/venv.bootstrapping"

if [ -d "$AI_VENV_TMP" ]; then
  echo "Cleaning up interrupted venv bootstrap..."
  rm -rf "$AI_VENV_TMP"
fi

# Bootstrap AI venv from base image on first run
if [ ! -d "$AI_VENV" ] && [ -d "/opt/venv" ]; then
  echo "Bootstrapping AI venv from base image..."
  mkdir -p /data/ai/models /data/ai/pip-cache
  cp -r /opt/venv "$AI_VENV_TMP"
  mv "$AI_VENV_TMP" "$AI_VENV"
  echo "AI venv ready at $AI_VENV"
fi

# Fix ownership of mounted volumes so the non-root ashim user can write.
# This runs as root, fixes permissions, then drops to ashim via gosu.
if [ "$(id -u)" = "0" ]; then
  chown -R ashim:ashim /data /tmp/workspace 2>&1 || \
    echo "WARNING: Could not fix volume permissions. Use named volumes (not Windows bind mounts) to avoid this. See docs for details." >&2
  exec gosu ashim "$@"
fi

# Already running as ashim (e.g. Kubernetes runAsUser)
exec "$@"
