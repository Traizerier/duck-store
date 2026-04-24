#!/usr/bin/env bash
# Duck Store — orchestrate the dev stacks via docker compose.
#
# Each "stack" (warehouse, store) is a separate compose project with its
# own {mongo, backend, frontend} trio — own network, own volume, own
# lifecycle. No cross-stack HTTP / DNS.
#
# Same docker-compose.yml template, parameterized per stack via
# .env.<stack>. run.sh invokes compose once per stack.
#
# Typical flow:
#   bash run.sh up                  # both stacks up in the background
#   bash run.sh up warehouse        # just the warehouse stack
#   bash run.sh logs store          # tail logs for the store stack
#   bash run.sh test warehouse      # run backend tests in the warehouse stack
#   bash run.sh down                # stop + remove everything
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

# ---------- stacks ----------
# Each stack = a compose project name + a matching .env file. Add a new
# stack by dropping in `.env.<name>` and adding the name here.
STACKS=(warehouse store)

project_for()  { echo "duckstore-$1"; }
env_file_for() { echo ".env.$1"; }

# Invoke compose against a given stack, forwarding remaining args.
dc_for() {
    local stack=$1; shift
    local env_file
    env_file=$(env_file_for "$stack")
    if [ ! -f "$env_file" ]; then
        err "Missing $env_file (expected for stack '$stack'). Known stacks: ${STACKS[*]}"
        return 1
    fi
    docker compose \
        -p "$(project_for "$stack")" \
        --env-file "$env_file" \
        -f docker-compose.yml \
        -f docker-compose.dev.yml \
        "$@"
}

# resolve_stacks(args...) — if any args match a known stack name, use
# those; otherwise default to all stacks.
resolve_stacks() {
    if [ $# -eq 0 ]; then
        printf '%s\n' "${STACKS[@]}"
        return
    fi
    local any_known=0
    for arg in "$@"; do
        for known in "${STACKS[@]}"; do
            if [ "$arg" = "$known" ]; then
                echo "$arg"
                any_known=1
                break
            fi
        done
    done
    if [ $any_known -eq 0 ]; then
        err "No known stack in args: $*. Known stacks: ${STACKS[*]}"
        return 1
    fi
}

cmd=${1:-up}
shift 2>/dev/null || true

case "$cmd" in
    up)
        readarray -t targets < <(resolve_stacks "$@") || exit 1
        for stack in "${targets[@]}"; do
            info "Bringing up stack: $stack"
            dc_for "$stack" up -d --remove-orphans
        done
        echo
        info "All up. Running containers:"
        docker ps --filter "label=com.docker.compose.project" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo
        echo "  bash run.sh logs <stack>       # tail logs for a stack"
        echo "  bash run.sh shell <stack>      # open bash in that stack's backend container"
        echo "  bash run.sh test  <stack>      # run backend tests in that stack"
        echo "  bash run.sh down               # stop everything"
        ;;

    foreground|up-f)
        # Foreground mode only makes sense for a single stack — Ctrl+C
        # has to stream from one. Require an explicit stack arg.
        if [ $# -ne 1 ]; then
            err "foreground requires a single stack arg: bash run.sh foreground <stack>"
            exit 1
        fi
        info "Foreground: $1 (Ctrl+C stops this stack)"
        dc_for "$1" up --remove-orphans
        ;;

    down|stop)
        readarray -t targets < <(resolve_stacks "$@") || exit 1
        for stack in "${targets[@]}"; do
            info "Tearing down stack: $stack"
            dc_for "$stack" down --remove-orphans
        done
        ;;

    logs)
        # Default to all stacks if no arg; one stack if arg given.
        if [ $# -eq 0 ]; then
            # multiplex: show logs from every stack, prefixed by stack name
            for stack in "${STACKS[@]}"; do
                dc_for "$stack" logs -f --tail=50 &
            done
            wait
        else
            dc_for "$1" logs -f --tail=200
        fi
        ;;

    ps|status)
        for stack in "${STACKS[@]}"; do
            info "Stack: $stack"
            dc_for "$stack" ps
            echo
        done
        ;;

    build|rebuild)
        readarray -t targets < <(resolve_stacks "$@") || exit 1
        for stack in "${targets[@]}"; do
            info "Building stack: $stack"
            dc_for "$stack" build
        done
        ;;

    restart)
        if [ $# -lt 1 ]; then
            err "restart requires a stack arg: bash run.sh restart <stack> [service]"
            exit 1
        fi
        stack=$1; shift
        # Default service = frontend (HMR misses are the common restart case).
        svc=${1:-frontend}
        info "Restarting $stack/$svc"
        dc_for "$stack" restart "$svc"
        ;;

    shell|exec)
        stack=${1:-warehouse}
        svc=${2:-backend}
        info "docker compose exec ($stack) $svc bash"
        dc_for "$stack" exec "$svc" bash
        ;;

    test)
        stack=${1:-warehouse}
        svc=${2:-backend}
        case "$svc" in
            frontend)
                info "($stack) frontend tests"
                dc_for "$stack" exec frontend npm run test:run
                ;;
            *)
                info "($stack) backend tests"
                dc_for "$stack" exec backend npm run test:run
                ;;
        esac
        ;;

    stacks)
        printf '%s\n' "${STACKS[@]}"
        ;;

    control-plane|cp)
        # The control plane is its own compose project, separate from the
        # managed stacks. It needs REPO_ROOT_HOST so the mounts in
        # docker-compose.control-plane.yml resolve to paths the host
        # Docker daemon can see.
        export REPO_ROOT_HOST="$repo_root"
        sub=${1:-up}; shift 2>/dev/null || true
        cp_compose() {
            docker compose \
                -p duckstore-control-plane \
                --env-file .env.control-plane \
                -f docker-compose.control-plane.yml \
                "$@"
        }
        case "$sub" in
            up)
                info "Bringing up control plane (repo=$REPO_ROOT_HOST)"
                cp_compose up -d --build --remove-orphans
                echo
                info "Control plane:"
                echo "  curl http://localhost:\${CONTROL_PLANE_HOST_PORT:-4000}/health"
                echo "  curl -H \"Authorization: Bearer \$CONTROL_PLANE_TOKEN\" http://localhost:4000/stacks"
                ;;
            down|stop)
                info "Tearing down control plane"
                cp_compose down --remove-orphans
                ;;
            logs)
                cp_compose logs -f --tail=200
                ;;
            ps|status)
                cp_compose ps
                ;;
            restart)
                cp_compose restart
                ;;
            shell|exec)
                cp_compose exec control-plane sh
                ;;
            test)
                cp_compose exec control-plane npm run test:run
                ;;
            rebuild|build)
                cp_compose build
                ;;
            *)
                err "Unknown control-plane subcommand: $sub"
                err "Try: up | down | logs | ps | restart | shell | test | rebuild"
                exit 1
                ;;
        esac
        ;;

    help|--help|-h)
        cat <<USAGE
${BOLD}bash run.sh [command] [stack...]${NC}

Each stack is a self-contained {mongo, backend, frontend} trio. Stacks
are fully independent — no cross-stack data or network. Known stacks:
${BOLD}${STACKS[*]}${NC}

${BOLD}Lifecycle:${NC}
  up [stack...]         Start one or more stacks in the background
                        (default: all). Example: ${BOLD}bash run.sh up warehouse${NC}
  foreground <stack>    Start one stack in the foreground. Ctrl+C stops
                        it. Requires the stack name. Alias: up-f
  down [stack...]       Stop + remove one or more stacks (default: all)
                        Alias: stop
  rebuild [stack...]    Rebuild images (after Dockerfile changes).
  restart <stack> [svc] Bounce one service in a stack (default: frontend).

${BOLD}Inspection:${NC}
  ps                    Show containers per stack.
  logs [stack]          Tail logs (all stacks multiplexed, or one stack).
  stacks                List known stack names.

${BOLD}Work inside containers:${NC}
  shell <stack> [svc]   Open a bash shell (default svc: backend).
  test  <stack> [svc]   Run the test suite (default svc: backend).

${BOLD}Control plane (stack-manager HTTP API):${NC}
  control-plane up      Start the control plane (duckstore-control-plane project)
  control-plane down    Stop the control plane
  control-plane logs    Tail its logs
  control-plane ps      Show its container status
  control-plane test    Run stack-manager tests inside the container
                        Alias: ${BOLD}cp${NC} (e.g. bash run.sh cp up).
                        The control plane is NOT a managed stack — it sits
                        alongside them and can start/stop them via HTTP.

${BOLD}Add a third stack:${NC}
  1. Drop in ${BOLD}.env.<name>${NC} with INSTANCE_NAME, FRONTEND_TITLE, host ports, MONGO_DB_NAME.
  2. Add "<name>" to the STACKS array near the top of this script.
  3. ${BOLD}bash run.sh up <name>${NC}
USAGE
        ;;

    *)
        err "Unknown command: $cmd"
        err "Try: bash run.sh help"
        exit 1
        ;;
esac
