# Scripts

Helper shell scripts for local development and operations.

## `docker.sh`

A thin wrapper around `docker compose` that selects the right `.env.*` file
based on `NODE_ENV` and exposes the most common workflows as short commands.

### Prerequisites

- Docker Engine **≥ 20.10** (with the `docker compose` v2 plugin)
- Bash **≥ 4**
- Two env files at the project root, one per environment:
  - `.env.development` (default) → database `employee_db_developement`
  - `.env.production` → database `employee_db_production`

  Both live in the same Postgres instance, so you can switch the API
  between environments without restarting the database container.

  Copy [`.env.example`](../.env.example) and adjust as needed:

  ```bash
  cp .env.example .env.development
  ```

### Usage

```bash
./scripts/docker.sh <command> [env]
```

- `<command>` — one of the commands listed below.
- `[env]` — optional environment selector (`development` | `production`).
  Defaults to the `NODE_ENV` shell variable, or `development` if unset.

The script always runs from the project root, so you can invoke it from any
working directory.

### Commands

| Command   | What it does                                                     |
| --------- | ---------------------------------------------------------------- |
| `up`      | Build (if needed) and start all services in the background.      |
| `down`    | Stop and remove containers. **Volumes are preserved.**           |
| `restart` | Restart all services in place.                                   |
| `rebuild` | Force a `--no-cache` rebuild and recreate containers.            |
| `logs`    | Tail logs for all services. Press `Ctrl-C` to exit.              |
| `ps`      | Show container status.                                           |
| `sh`      | Open an interactive shell inside the `api` container.            |
| `psql`    | Open a `psql` prompt against the `DB_NAME` of the selected env.  |
| `db:up`   | Start **only** the `postgres` service in the background.         |
| `db:down` | Stop **only** the `postgres` service. Volume preserved.          |
| `db:logs` | Tail logs for the `postgres` service.                            |
| `nuke`    | Stop everything **and delete volumes** (destroys DB data, prompt). |
| `help`    | Print the inline usage block.                                    |

### Examples

```bash
# Default development stack (.env.development → employee_db_developement)
./scripts/docker.sh up

# Bring up the production stack (.env.production → employee_db_production)
./scripts/docker.sh up production

# Tail logs
./scripts/docker.sh logs

# Open a psql session against the active environment's database
./scripts/docker.sh psql production

# Force a clean rebuild after Dockerfile changes
./scripts/docker.sh rebuild

# Stop the stack but keep the database volume
./scripts/docker.sh down

# Wipe everything, including the postgres volume (asks for confirmation)
./scripts/docker.sh nuke
```

### How environment selection works

1. The script picks `.env.<env>` (e.g. `.env.development`) and passes it to
   `docker compose --env-file`. Variables in that file are interpolated into
   [`docker-compose.yml`](../docker-compose.yml).
2. `NODE_ENV` is exported so the `api` container starts in the correct mode,
   which in turn drives which `.env.<NODE_ENV>` file Nest loads at runtime
   (see [`src/app.module.ts`](../src/app.module.ts)).
3. If the selected env file is missing, the script exits early with a clear
   error message.

## Seeding

Seed data is defined in [`src/database/seed/employees.seed.ts`](../src/database/seed/employees.seed.ts)
and executed by [`src/database/seed/index.ts`](../src/database/seed/index.ts), which loads
`.env.${NODE_ENV}` via `dotenv` to pick up `DATABASE_URL`.

```bash
pnpm db:seed                       # additive (skips rows whose email already exists)
pnpm db:seed:reset                 # TRUNCATE the table first (dev only!)

# Target a different environment by setting NODE_ENV:
NODE_ENV=production pnpm db:seed
```

### `DATABASE_URL` host: `postgres` vs `localhost`

The env files use `@postgres:5432` because that's the service name resolved
inside the Docker network — perfect for the `api` container, broken on the
host. Two options when running scripts (seed, migrate, etc.) **outside** Docker:

- **Recommended:** create a per-developer override (already gitignored):

  ```bash
  # .env.development.local
  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/employee_db_developement
  ```

  Loaded with higher precedence than `.env.development`, so the in-container
  config stays intact.

- **One-off:** prefix the command:

  ```bash
  DATABASE_URL="postgresql://postgres:postgres@localhost:5432/employee_db_developement" \
    pnpm db:seed
  ```

Alternatively, run the seed *inside* the api container, where `postgres`
resolves natively:

```bash
./scripts/docker.sh up
docker compose --env-file .env.development exec api pnpm db:seed
```

### Troubleshooting

- **`Missing .env.<env>`** — copy `.env.example` to the expected filename.
- **`permission denied`** — ensure the script is executable:
  ```bash
  chmod +x scripts/docker.sh
  ```
- **`docker: command not found` / Compose v1 errors** — install Docker Engine
  with the Compose v2 plugin; the script uses `docker compose` (space), not
  the legacy `docker-compose`.
- **Port already in use** — change `PORT` (api) or `DB_PORT_HOST` (postgres)
  in the active env file, then re-run `up`.
- **`getaddrinfo EAI_AGAIN postgres`** — you're running a script on the host
  with the in-container `DATABASE_URL`. Use a `.env.<env>.local` override or
  prefix the command (see *Seeding* above).
- **Database doesn't exist** — Postgres only auto-creates `POSTGRES_DB` from
  the env file. To pre-create all three databases on the first container
  start, mount [`docker/postgres/init-databases.sh`](../docker/postgres/init-databases.sh)
  via a volume in [`docker-compose.yml`](../docker-compose.yml), or create
  them manually:
  ```sql
  CREATE DATABASE employee_db_developement;
  CREATE DATABASE employee_db_production;
  ```
