#!/usr/bin/env bash
# Duck Store — verify & install dependencies for all services.
# Requires bash. On Windows, use Git Bash or WSL.
# Reads required versions from .tool-versions and tries to match them exactly.

set -uo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$repo_root"

# ---------- output helpers ----------
if [ -t 1 ]; then
    RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[0;33m'; BLUE=$'\033[0;34m'; BOLD=$'\033[1m'; NC=$'\033[0m'
else
    RED=; GREEN=; YELLOW=; BLUE=; BOLD=; NC=
fi
info() { printf "%s▶%s %s\n" "$BLUE" "$NC" "$*"; }
ok()   { printf "%s✓%s %s\n" "$GREEN" "$NC" "$*"; }
warn() { printf "%s!%s %s\n" "$YELLOW" "$NC" "$*"; }
err()  { printf "%s✗%s %s\n" "$RED" "$NC" "$*"; }

# ---------- platform ----------
platform=unknown
case "$(uname -s)" in
    Linux*)               platform=linux;;
    Darwin*)              platform=mac;;
    MINGW*|CYGWIN*|MSYS*) platform=windows;;
esac

# ---------- load .tool-versions ----------
declare -A required
if [ ! -f .tool-versions ]; then
    err ".tool-versions not found at repo root."
    exit 1
fi
while IFS=' ' read -r tool version || [ -n "${tool:-}" ]; do
    [[ "$tool" =~ ^#.*$ ]] && continue
    [ -z "${tool:-}" ] && continue
    # Strip trailing CR so CRLF-line-ending checkouts (Windows git with
    # core.autocrlf=true) don't smuggle \r into parsed values, which would
    # (a) make "20" != "20\r" falsely flag a version mismatch, and
    # (b) corrupt the error output by carriage-returning over itself.
    tool="${tool%$'\r'}"
    version="${version%$'\r'}"
    required[$tool]=$version
done < .tool-versions

require_node="${required[node]:-20}"
require_node_major="${require_node%%.*}"
require_go="${required[go]:-1.22}"     # treat as major.minor
require_docker="${required[docker]:-2}"

# ---------- check buckets ----------
declare -a missing_required=()
declare -a missing_optional=()
declare -a wrong_version=()
declare -A tool_note=()

# ---------- version checks ----------
check_node() {
    if ! command -v node >/dev/null 2>&1; then
        missing_required+=("node")
        tool_note[node]="not installed (need v${require_node_major}.x)"
        return
    fi
    local v major
    v=$(node --version | sed 's/^v//')
    major="${v%%.*}"
    if [ "$major" = "$require_node_major" ]; then
        ok "node: v$v (matches required ${require_node_major}.x)"
    else
        wrong_version+=("node")
        tool_note[node]="installed v$v, required v${require_node_major}.x"
    fi
}

check_npm() {
    if ! command -v npm >/dev/null 2>&1; then
        if ! [[ " ${missing_required[*]-} " =~ " node " ]]; then
            missing_required+=("npm")
            tool_note[npm]="not installed"
        fi
        return
    fi
    ok "npm: $(npm --version)"
}

check_go() {
    if ! command -v go >/dev/null 2>&1; then
        missing_optional+=("go")
        tool_note[go]="not installed (need go${require_go}.x)"
        return
    fi
    local v mm
    v=$(go version | awk '{print $3}' | sed 's/^go//')
    mm=$(echo "$v" | awk -F. '{print $1"."$2}')
    if [ "$mm" = "$require_go" ]; then
        ok "go:  go$v (matches required go${require_go}.x)"
    else
        wrong_version+=("go")
        tool_note[go]="installed go$v, required go${require_go}.x"
    fi
}

check_docker() {
    if ! docker compose version >/dev/null 2>&1; then
        missing_optional+=("docker")
        tool_note[docker]="docker compose not available"
        return
    fi
    local v major
    v=$(docker compose version --short 2>/dev/null)
    major="${v%%.*}"
    if [ "$major" = "$require_docker" ]; then
        ok "docker compose: $v (matches required ${require_docker}+)"
    else
        wrong_version+=("docker")
        tool_note[docker]="installed $v, required ${require_docker}+"
    fi
}

info "Checking prerequisites (from .tool-versions)..."
check_node
check_npm
check_go
check_docker

# ---------- vendor URLs (version pickers) ----------
vendor_url() {
    case "$1" in
        node)   echo "https://nodejs.org/dist/latest-v${require_node_major}.x/";;
        go)     echo "https://go.dev/dl/";;
        docker) echo "https://www.docker.com/products/docker-desktop/";;
    esac
}

open_url() {
    local url=$1
    echo "  Open: $url"
    case "$platform" in
        windows) cmd.exe //c start "" "$url" >/dev/null 2>&1 || true;;
        mac)     open "$url" >/dev/null 2>&1 || true;;
        linux)   xdg-open "$url" >/dev/null 2>&1 || true;;
    esac
}

# ---------- winget version discovery (Windows only) ----------
winget_latest_matching() {
    # $1 = package id, $2 = version prefix (e.g. "20" or "1.22")
    local pkg=$1 prefix=$2
    winget show --id "$pkg" --versions 2>/dev/null \
        | grep -E "^${prefix//./\\.}\." \
        | head -n1 \
        | tr -d '[:space:]'
}

# ---------- install a single tool at its required version ----------
run_install_pinned() {
    local tool=$1
    case "$platform" in
        windows)
            case "$tool" in
                node)
                    local v
                    v=$(winget_latest_matching "OpenJS.NodeJS" "$require_node_major")
                    if [ -z "$v" ]; then
                        warn "winget has no Node ${require_node_major}.x listed — falling back to vendor page."
                        open_url "$(vendor_url node)"
                        return 1
                    fi
                    info "Installing Node v$v via winget..."
                    winget install --id OpenJS.NodeJS --version "$v" \
                        --accept-source-agreements --accept-package-agreements
                    ;;
                go)
                    local v
                    v=$(winget_latest_matching "GoLang.Go" "$require_go")
                    if [ -z "$v" ]; then
                        warn "winget has no Go ${require_go}.x listed — falling back to vendor page."
                        open_url "$(vendor_url go)"
                        return 1
                    fi
                    info "Installing Go $v via winget..."
                    winget install --id GoLang.Go --version "$v" \
                        --accept-source-agreements --accept-package-agreements
                    ;;
                docker)
                    winget install --id Docker.DockerDesktop \
                        --accept-source-agreements --accept-package-agreements
                    ;;
            esac;;
        mac)
            case "$tool" in
                node)
                    local formula="node@${require_node_major}"
                    if ! brew info "$formula" >/dev/null 2>&1; then
                        warn "brew has no ${formula} formula — falling back to vendor page."
                        open_url "$(vendor_url node)"
                        return 1
                    fi
                    info "Installing $formula via brew..."
                    brew install "$formula"
                    ;;
                go)
                    local formula="go@${require_go}"
                    if brew info "$formula" >/dev/null 2>&1; then
                        info "Installing $formula via brew..."
                        brew install "$formula"
                    elif brew info go >/dev/null 2>&1; then
                        warn "brew has no ${formula} — installing 'go' (latest) as best effort."
                        brew install go
                    else
                        warn "brew has no go formula — falling back to vendor page."
                        open_url "$(vendor_url go)"
                        return 1
                    fi
                    ;;
                docker)
                    if ! brew info --cask docker >/dev/null 2>&1; then
                        warn "brew has no docker cask — falling back to vendor page."
                        open_url "$(vendor_url docker)"
                        return 1
                    fi
                    info "Installing Docker Desktop via brew cask..."
                    brew install --cask docker
                    ;;
            esac;;
        *)
            warn "$tool: auto-install unsupported on $platform — opening vendor page."
            open_url "$(vendor_url "$tool")"
            return 1;;
    esac
}

install_hint() {
    local tool=$1
    case "$platform" in
        windows)
            case "$tool" in
                node)   echo "winget install --id OpenJS.NodeJS --version <${require_node_major}.x>   or   $(vendor_url node)";;
                go)     echo "winget install --id GoLang.Go --version <${require_go}.x>   or   $(vendor_url go)";;
                docker) echo "winget install --id Docker.DockerDesktop   or   $(vendor_url docker)";;
            esac;;
        mac)
            case "$tool" in
                node)   echo "brew install node@${require_node_major}   or   $(vendor_url node)";;
                go)     echo "brew install go@${require_go}   or   $(vendor_url go)";;
                docker) echo "brew install --cask docker   or   $(vendor_url docker)";;
            esac;;
        *)
            echo "$(vendor_url "$tool")";;
    esac
}

# ---------- decide whether auto-install is available ----------
can_auto=false
case "$platform" in
    windows) command -v winget >/dev/null 2>&1 && can_auto=true;;
    mac)     command -v brew   >/dev/null 2>&1 && can_auto=true;;
esac

# ---------- handle wrong versions first (hard stop, user must resolve) ----------
if [ ${#wrong_version[@]} -gt 0 ]; then
    echo
    err "${BOLD}Version mismatch${NC} — these need manual resolution:"
    for t in "${wrong_version[@]}"; do
        printf "    - %s: %s\n" "$t" "${tool_note[$t]}"
        printf "      fix: uninstall current, then %s\n" "$(install_hint "$t")"
    done
    echo
    warn "Uninstall the wrong-major tool(s), install the required version, restart your terminal, and re-run setup."
    exit 1
fi

# ---------- handle missing tools ----------
total_missing=$(( ${#missing_required[@]} + ${#missing_optional[@]} ))
if [ $total_missing -gt 0 ]; then
    echo
    if [ ${#missing_required[@]} -gt 0 ]; then
        err "Missing ${BOLD}required${NC} tools:"
        for t in "${missing_required[@]}"; do
            printf "    - %s: %s\n" "$t" "${tool_note[$t]}"
            printf "      install: %s\n" "$(install_hint "$t")"
        done
    fi
    if [ ${#missing_optional[@]} -gt 0 ]; then
        warn "Missing ${BOLD}optional${NC} tools:"
        for t in "${missing_optional[@]}"; do
            printf "    - %s: %s\n" "$t" "${tool_note[$t]}"
            printf "      install: %s\n" "$(install_hint "$t")"
        done
    fi
    echo

    if $can_auto; then
        echo "Install options:"
        echo "  [a] install all missing at the required versions (required + optional)"
        [ ${#missing_required[@]} -gt 0 ] && [ ${#missing_optional[@]} -gt 0 ] && \
            echo "  [r] install required only"
        echo "  [n] no — I'll install manually via the vendor pages listed above"
        echo
        read -r -p "Choice [a/r/n] (default: n): " choice
        choice=${choice:-n}

        to_install=()
        case "$choice" in
            a|A) to_install=("${missing_required[@]}" "${missing_optional[@]}");;
            r|R) to_install=("${missing_required[@]}");;
            *)
                echo
                info "Opening vendor pages so you can install manually..."
                for t in "${missing_required[@]}" "${missing_optional[@]}"; do
                    printf "    - %s:\n" "$t"
                    open_url "$(vendor_url "$t")"
                done
                echo
                warn "Install the listed versions, restart your terminal, and re-run setup."
                exit 1;;
        esac

        echo
        install_failed=()
        for t in "${to_install[@]}"; do
            if ! run_install_pinned "$t"; then
                install_failed+=("$t")
            else
                ok "$t install command finished"
            fi
        done

        echo
        if [ ${#install_failed[@]} -gt 0 ]; then
            warn "Some installs couldn't be pinned automatically — vendor pages were opened above."
        fi
        warn "Installs complete — but the current shell has the ${BOLD}old PATH${NC}."
        warn "Close this terminal, open a new one, and re-run setup to verify."
        exit 0
    else
        echo
        err "Cannot auto-install on this system (winget/brew unavailable)."
        info "Opening vendor pages for missing tools..."
        for t in "${missing_required[@]}" "${missing_optional[@]}"; do
            printf "    - %s:\n" "$t"
            open_url "$(vendor_url "$t")"
        done
        echo
        warn "Install the listed versions, then re-run setup."
        exit 1
    fi
fi

# ---------- all tools matched — install per-service deps ----------
install_service() {
    local dir=$1
    [ -d "$dir" ] || { info "Skipping $dir (not present yet)"; return 0; }

    if [ -f "$dir/package.json" ]; then
        info "Installing Node deps in $dir/"
        (cd "$dir" && npm install) && ok "$dir deps installed" || err "$dir install failed"
    fi

    if [ -f "$dir/go.mod" ]; then
        if command -v go >/dev/null 2>&1; then
            info "Downloading Go modules in $dir/"
            (cd "$dir" && go mod download) && ok "$dir Go modules downloaded" || err "$dir go mod download failed"
        else
            warn "Skipping $dir (go not installed)"
        fi
    fi

    if [ -f "$dir/.env.example" ] && [ ! -f "$dir/.env" ]; then
        cp "$dir/.env.example" "$dir/.env"
        ok "$dir/.env created from .env.example"
    fi
}

echo
info "Installing per-service dependencies..."

# Seed the root .env (compose-level config) if missing.
if [ -f ".env.example" ] && [ ! -f ".env" ]; then
    cp ".env.example" ".env"
    ok "root .env created from .env.example"
fi

for service in warehouse-service store-service frontend; do
    install_service "$service"
done

echo
ok "Setup complete. Next: bash run.sh"
