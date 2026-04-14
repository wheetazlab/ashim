#!/bin/sh
set -e

# Fix ownership of mounted volumes so the non-root ashim user can write.
# This runs as root, fixes permissions, then drops to ashim via gosu.
if [ "$(id -u)" = "0" ]; then
  chown -R ashim:ashim /data /tmp/workspace 2>&1 || \
    echo "WARNING: Could not fix volume permissions. If processing fails, check your volume mount permissions." >&2
  exec gosu ashim "$@"
fi

# Already running as ashim (e.g. Kubernetes runAsUser)
exec "$@"
