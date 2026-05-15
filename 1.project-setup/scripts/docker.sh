#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# docker.sh — convenience wrapper around `docker compose` for this project.
#
# Usage:
#   ./scripts/docker.sh <command> [env]
#
# Commands:
#   up           Build (if needed) and start services in the background.
#   down         Stop and remove containers (volumes preserved).
#   restart      Restart all services.
#   rebuild      Force-rebuild images and start fresh containers.
#   logs         Tail logs for all services (Ctrl-C to exit).
#   ps           Show container status.
#   sh           Open a shell inside the api container.
#   psql         Open a psql prompt inside the postgres container.
#   db:up        Start ONLY the postgres service (in the background).
#   db:down      Stop ONLY the postgres service (volume preserved).
#   db:logs      Tail logs for the postgres service.
#   nuke         Stop everything AND delete volumes (DESTROYS DB DATA).
#
# Environment selector (positional arg 2, default: development):
#   development | production
#
#   The matching .env.<env> file is passed to compose via --env-file, and
#   NODE_ENV is exported so containers boot in the right mode.
#
# Examples:
#   ./scripts/docker.sh up
#   ./scripts/docker.sh up production
#   ./scripts/docker.sh logs
#   ./scripts/docker.sh nuke
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# Resolve project root (parent of the scripts/ directory) so the script works
# from any cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

COMMAND="${1:-help}"
NODE_ENV="${2:-${NODE_ENV:-development}}"
ENV_FILE=".env.${NODE_ENV}"

# ── helpers ──────────────────────────────────────────────────────────────────
color() { printf '\033[%sm%s\033[0m\n' "$1" "$2"; }
info()  { color "1;34" "▶ $*"; }
warn()  { color "1;33" "⚠ $*"; }
err()   { color "1;31" "✖ $*" >&2; }

require_env_file() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    err "Missing ${ENV_FILE}. Copy .env.example and fill it in."
    exit 1
  fi
}

# Build the compose invocation with the selected env file.
compose() {
  require_env_file
  NODE_ENV="${NODE_ENV}" docker compose --env-file "${ENV_FILE}" "$@"
}

confirm() {
  local prompt="${1:-Are you sure?} [y/N] "
  read -r -p "${prompt}" reply
  [[ "${reply}" =~ ^[Yy]$ ]]
}

usage() {
  sed -n '2,33p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

# ── commands ─────────────────────────────────────────────────────────────────
case "${COMMAND}" in
  up)
    info "Starting stack (NODE_ENV=${NODE_ENV}, env-file=${ENV_FILE})"
    compose up -d --build
    compose ps
    ;;

  down)
    info "Stopping stack (volumes preserved)"
    compose down
    ;;

  restart)
    info "Restarting services"
    compose restart
    ;;

  rebuild)
    info "Rebuilding images from scratch"
    compose build --no-cache
    compose up -d --force-recreate
    compose ps
    ;;

  logs)
    info "Tailing logs (Ctrl-C to exit)"
    compose logs -f --tail=100
    ;;

  ps)
    compose ps
    ;;

  sh)
    info "Opening shell in api container"
    compose exec api sh
    ;;

  psql)
    info "Opening psql in postgres container"
    # shellcheck disable=SC2046
    compose exec postgres psql \
      -U "$(grep -E '^DB_USER=' "${ENV_FILE}" | cut -d= -f2- || echo postgres)" \
      -d "$(grep -E '^DB_NAME=' "${ENV_FILE}" | cut -d= -f2- || echo employee_db)"
    ;;

  db:up)
    info "Starting postgres only (NODE_ENV=${NODE_ENV}, env-file=${ENV_FILE})"
    compose up -d postgres
    compose ps postgres
    ;;

  db:down)
    info "Stopping postgres (volume preserved)"
    compose stop postgres
    ;;

  db:logs)
    info "Tailing postgres logs (Ctrl-C to exit)"
    compose logs -f --tail=100 postgres
    ;;

  nuke)
    warn "This will remove containers AND delete the postgres volume."
    if confirm "Proceed?"; then
      compose down -v --remove-orphans
      info "Done."
    else
      info "Aborted."
    fi
    ;;

  help|-h|--help)
    usage
    ;;

  *)
    err "Unknown command: ${COMMAND}"
    usage
    exit 1
    ;;
esac
