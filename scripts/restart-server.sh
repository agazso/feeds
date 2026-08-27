#!/usr/bin/env bash
# Restart the feeds service on a deployed server over SSH, and show its status.
#   ./scripts/restart-server.sh user@server
#
# -t allocates a tty so `sudo` can prompt for a password if the account isn't
# configured for passwordless sudo.
set -euo pipefail
REMOTE="${1:?usage: restart-server.sh user@host}"

ssh -t "$REMOTE" 'sudo systemctl restart feeds && sudo systemctl --no-pager --lines=0 status feeds'
