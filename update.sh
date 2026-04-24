#!/usr/bin/env bash
# Duck Store — check for tool & dependency updates.
#
# System tools (node, docker): installed vs .tool-versions vs available.
#   Offers to upgrade via winget (Windows) or brew (mac).
#   Offers to bump .tool-versions after an upgrade.
#
# Service deps (npm): reports outdated. Does NOT auto-upgrade —
#   run `cd <service> && npm update` manually after reviewing, so you can
#   catch breaking changes.

set -uo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$repo_root"

# ---------- output helpers ----------
if [ -t 1 ]; then
    RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[0;33m'; BLUE=$'\033[0;34m'; BOLD=$'\033[1m'; DIM=$'\033[2m'; NC=$'\033[0m'
else
    RED=; GREEN=; YELLOW=; BLUE=; BOLD=; DIM=; NC=
fi
info() { printf "%s▶%s %s\n" "$BLUE" "$NC" "$*"; }
ok()   { printf "%s✓%s %s\n" "$GREEN" "$NC" "$*"; }
warn() { printf "%s!%s %s\n" "$YELLOW" "$NC" "$*"; }
err()  { printf "%s✗%s %s\n" "$RED" "$NC" "$*"; }
dim()  { printf "%s%s%s\n" "$DIM" "$*" "$NC"; }

# ---------- platform ----------
platform=unknown
case "$(uname -s)" in
    Linux*)               platform=linux;;
    Darwin*)              platform=mac;;
    MINGW*|CYGWIN*|MSYS*) platform=windows;;
esac

# ---------- read .tool-versions ----------
declare -A required
if [ ! -f .tool-versions ]; then
    err ".tool-versions not found."
    exit 1
fi
while IFS=' ' read -r tool version || [ -n "$tool" ]; do
    [[ "$tool" =~ ^#.*$ ]] && continue
    [ -z "$tool" ] && continue
    required[$tool]=$version
done < .tool-versions

# ---------- detect installed versions ----------
node_installed=""
go_installed=""

if command -v node >/dev/null 2>&1; then
    node_installed=$(node --version | sed 's/^v//')
fi
if command -v go >/dev/null 2>&1; then
    go_installed=$(go version | awk '{print $3}' | sed 's/^go//')
fi

# ---------- system tools report ----------
info "System tools (vs .tool-versions)"
printf "  %-10s  %-12s  %-12s\n" "tool" "required" "installed"
printf "  %-10s  %-12s  %-12s\n" "----" "--------" "---------"
printf "  %-10s  %-12s  %-12s\n" "node"   "${required[node]:-?}"   "${node_installed:-missing}"
printf "  %-10s  %-12s  %-12s\n" "go"     "${required[go]:-?}"     "${go_installed:-missing}"
echo

# ---------- offer upgrade ----------
can_upgrade=false
case "$platform" in
    windows) command -v winget >/dev/null 2>&1 && can_upgrade=true;;
    mac)     command -v brew   >/dev/null 2>&1 && can_upgrade=true;;
esac

if $can_upgrade; then
    read -r -p "Upgrade system tools to latest available? [y/N]: " yn
    yn=${yn:-n}
    if [[ "$yn" =~ ^[yY]$ ]]; then
        case "$platform" in
            windows)
                info "Running: winget upgrade"
                winget upgrade --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements 2>/dev/null || true
                winget upgrade --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements 2>/dev/null || true
                ;;
            mac)
                info "Running: brew upgrade"
                brew upgrade "node@${required[node]%%.*}" 2>/dev/null || true
                brew upgrade --cask docker 2>/dev/null || true
                ;;
        esac
        echo
        warn "Current shell has stale PATH — open a new terminal to verify the new versions."

        echo
        read -r -p "After restarting, bump .tool-versions to the new majors? [y/N]: " bumpyn
        bumpyn=${bumpyn:-n}
        if [[ "$bumpyn" =~ ^[yY]$ ]]; then
            info "Edit .tool-versions by hand after your restart, or run:"
            echo "  node -v  # then set 'node <major>' in .tool-versions"
            echo "  go version  # then set 'go <major.minor>' in .tool-versions"
        fi
    else
        info "Skipped system-tool upgrade."
    fi
else
    dim "  (auto-upgrade unavailable on this platform — use your package manager directly)"
fi

# ---------- service deps ----------
echo
info "Per-service deps (outdated check — not auto-updating)"

check_npm_outdated() {
    local dir=$1
    [ -d "$dir" ] && [ -f "$dir/package.json" ] || return 0
    echo
    dim "  $dir (npm outdated):"
    (cd "$dir" && npm outdated || true) | sed 's/^/    /'
}

for service in backend frontend; do
    check_npm_outdated "$service"
done

echo
info "Service deps are reported only. To update, run manually in each service:"
echo "  cd <service> && npm update     (or 'npm install <pkg>@latest' for specific bumps)"
echo
ok "Update check complete."
