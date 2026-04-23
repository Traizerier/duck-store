#!/usr/bin/env bash
# Duck Store — orchestrate the dev stack via docker compose.
#
# Lifecycle is owned by this script (not VS Code). Typical flow:
#   1. bash run.sh            # starts containers in the background, returns
#   2. View logs in Docker Desktop, or: bash run.sh logs [svc]
#   3. In VS Code, "Dev Containers: Attach to Running Container" → pick the
#      container you want to edit in.
#   4. Run tests / dev server from inside that container or via:
#        docker compose exec warehouse npm run dev
#        docker compose exec warehouse npm run test:run
#
# Requires bash. On Windows, use Git Bash or WSL.

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
err()  { printf "%s✗%s %s\n" "$RED" "$NC" "$*" >&2; }

# ---------- docker compose wrapper ----------
# Always combines base + dev overrides AND pins the project name so that every
# compose invocation (up / ps / exec / down) targets the same project. Without
# -p, residue env vars like COMPOSE_PROJECT_NAME from tools like VS Code Dev
# Containers can override the default and make `up` and `ps` disagree about
# which containers they're looking at.
COMPOSE_PROJECT=duckstore
dc() {
    docker compose -p "$COMPOSE_PROJECT" -f docker-compose.yml -f docker-compose.dev.yml "$@"
}

DEV_SERVICES=(mongo warehouse store frontend)

ensure_env() {
    if [ ! -f .env ] && [ -f .env.example ]; then
        cp .env.example .env
        ok "seeded root .env from .env.example"
    fi
}

cmd=${1:-up}

case "$cmd" in
    up)
        ensure_env
        info "docker compose up -d ${DEV_SERVICES[*]}"
        dc up -d "${DEV_SERVICES[@]}"
        echo
        dc ps
        echo
        info "Started. Logs are in Docker Desktop, or tail them here:"
        echo "  bash run.sh logs [svc]     # tail logs (all or one service)"
        echo "  bash run.sh shell [svc]    # bash inside a container"
        echo "  bash run.sh test  [svc]    # run tests inside a container"
        echo "  bash run.sh down           # stop everything"
        ;;

    foreground|up-f)
        ensure_env
        info "docker compose up ${DEV_SERVICES[*]} (foreground — Ctrl+C stops everything)"
        echo
        dc up "${DEV_SERVICES[@]}"
        ;;

    down)
        info "docker compose down"
        dc down
        ;;

    logs)
        shift || true
        dc logs -f --tail=200 "$@"
        ;;

    ps|status)
        dc ps
        ;;

    build|rebuild)
        info "docker compose build ${DEV_SERVICES[*]}"
        dc build "${DEV_SERVICES[@]}"
        ;;

    restart)
        svc=${2:-frontend}
        info "Restarting $svc (bounces the container — keeps volumes)..."
        dc restart "$svc"
        ;;

    shell|exec)
        svc=${2:-warehouse}
        info "docker compose exec $svc bash"
        dc exec "$svc" bash
        ;;

    test)
        svc=${2:-warehouse}
        case "$svc" in
            store|store-service)
                info "docker compose exec store go test ./..."
                dc exec store go test ./...
                ;;
            frontend)
                info "docker compose exec frontend npm run test:run"
                dc exec frontend npm run test:run
                ;;
            *)
                info "docker compose exec $svc npm run test:run"
                dc exec "$svc" npm run test:run
                ;;
        esac
        ;;

    help|--help|-h)
        cat <<USAGE
${BOLD}bash run.sh [command]${NC}

Lifecycle:
  up            Start services in the background (default). View logs in
                  Docker Desktop or with \`bash run.sh logs\`.
  foreground    Start in the foreground, streaming logs. Ctrl+C stops.
                  Alias: up-f
  down          Stop and remove all containers.
  rebuild       Rebuild images (after Dockerfile changes).
  restart [svc] Bounce one service's container (default: frontend). Useful
                  when Vite HMR misses a big refactor and a browser reload
                  doesn't help. Keeps volumes intact.

Inspection:
  ps            Show running services.
  logs [svc]    Tail logs (all or one service).

Work inside containers:
  shell [svc]   Open a bash shell in a running container (default: warehouse).
  test  [svc]   Run the test suite inside the container (default: warehouse).

Currently orchestrated services: ${DEV_SERVICES[*]}
USAGE
        ;;

    *)
        err "Unknown command: $cmd"
        err "Try: bash run.sh help"
        exit 1
        ;;
esac
