# Setup and deployment

## Run everything on one machine (Docker)

Requirements: Docker with Compose v2, an OpenAI API key, Node.js 20+ for the web app.

```bash
git clone <this repository> docintel && cd docintel
cp .env.example .env            # set OPENAI_API_KEY (AI_PROVIDER=openai is the default)
docker compose up -d --build    # API, 2 workers, PostgreSQL + pgvector, Redis
curl http://localhost:8000/api/v1/health
```

API documentation: http://localhost:8000/api/docs

Web app:

```bash
cd frontend
cp .env.example .env.local      # BACKEND_ORIGIN=http://localhost:8000
npm install
npm run dev                     # http://localhost:3000
```

Leave `ACCESS_CODES` empty for an open app (nobody is asked for a code), or set one or more codes to lock it: the
web app then shows a lock screen and the API needs the code on every request.

## Configuration (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `AI_PROVIDER` | `openai` (`.env.example`) | `openai` = direct with `OPENAI_API_KEY`; `n8n` = through the AI gateway webhook; `fake` = tests only |
| `OPENAI_API_KEY` |  | for `AI_PROVIDER=openai` |
| `AI_GATEWAY_URL`, `AI_GATEWAY_KEY` |  | for `AI_PROVIDER=n8n` (see [n8n/README.md](../n8n/README.md)) |
| `EXTRACTION_MODEL`, `VISION_MODEL` | `gpt-4.1-mini` | models for text and image readings |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | semantic search vectors (1536 dimensions) |
| `AI_CONCURRENCY` | `4` | parallel AI calls inside one document |
| `AI_DAILY_CALL_LIMIT` | `3000` | daily safety budget for AI calls |
| `AI_CACHE` | `true` | reuse AI answers for identical input (resumable jobs, no repeated cost) |
| `ACCESS_CODES` |  | comma-separated access codes; empty = open (no code asked), set = locked |
| `CORS_ORIGINS` | `http://localhost:3000` | only needed when a browser calls the API directly |
| `MAX_FILE_MB`, `MAX_FILES_PER_UPLOAD`, `MAX_PAGES` | `50`, `50`, `1500` | upload limits |
| `UPLOADS_PER_MINUTE` | `60` | upload requests allowed per visitor address per minute |
| `OCR_DPI` | `300` | rendering resolution for scanned PDF pages |
| `RECOVERY_STALE_MINUTES` | `15` | a processing document with no heartbeat for this long is requeued |
| `POSTGRES_PASSWORD` | `docintel` | database password |

Web app (`frontend/.env.local`, or the settings of the web host). These are read when the web app is built:

| Variable | Meaning |
|---|---|
| `BACKEND_ORIGIN` | address of the API server; the web app forwards `/api/*` there (never sent to browsers) |
| `NEXT_PUBLIC_REPO_URL` | optional link to the repository ("Source code" in the sidebar and footer) |
| `NEXT_PUBLIC_API_URL` | optional; only to make browsers call an API on another origin directly (then set `CORS_ORIGINS` on the server) |
| `NEXT_PUBLIC_BUILD_COMMIT` | optional build label, written into the page head |

## Production deployment

**Processing server** (any Linux VM with Docker and a Traefik reverse proxy):

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.server.yml up -d --build
```

The server overlay adds the HTTPS router for the API (`API_HOST`), removes public database and Redis ports, puts
everything on private networks, and sets hard CPU and memory limits on every container (API 0.5 CPU / 512 MB, each
worker 0.6 CPU / 640 MB, PostgreSQL 0.5 / 512 MB, Redis 0.25 / 192 MB). Workers get a 2-minute grace period to
finish the current document on restart.

Set `API_HOST` (the public host name of the API) in the server's `.env`. Traefik must be attached to the
`docintel-demo-edge` network. The database tables are created automatically when the API and workers start; there
is no separate migration step.

**Sample files.** The "Process all sample files" button reads from `/data/samples` inside the `files` volume. Copy
the 12 files once (they are in `frontend/public/samples/`; `deploy/deploy_server.sh` does not send the `frontend/`
folder to the server, so copy that folder there first or run this from a full checkout):

```bash
docker compose cp frontend/public/samples/. api:/data/samples/
```

`deploy/deploy_server.sh` syncs the code and restarts the stack (`… test` also runs the full test suite inside the
server). `deploy/run_eval_server.sh` runs a measured evaluation from a clean state. Server address and SSH key come
from a local, uncommitted file (`~/.config/asif-demos/docintel-server.env`).

**Web app** (any host that runs Next.js, Node.js 20+):

```bash
cd frontend
npm ci
BACKEND_ORIGIN=https://<api-host> npm run build
npm run start                                  # port 3000
```

`BACKEND_ORIGIN` is read at build time. On a hosting platform, set it in the project settings before the build.

**AI gateway** (n8n, optional): `python3 n8n/build_gateway.py` creates or updates the workflow and stores its header
key locally. It reads `n8n_url`, `n8n_api_key` and `openai_credential.json` from `~/.config/asif-demos/`.
Credentials are never committed.

## Limits for a public demo

An open demo can be used by anyone, so keep the cost and the load small with these settings (all in `.env`):
`AI_DAILY_CALL_LIMIT`, `MAX_FILE_MB`, `MAX_FILES_PER_UPLOAD`, `MAX_PAGES`, `UPLOADS_PER_MINUTE`. Set
`ACCESS_CODES` at any time to lock the demo again.

## Repository layout

```
backend/            FastAPI app, pipeline, workers, tests, Dockerfile
  app/api/          REST endpoints (documents, invoices, search, export, system)
  app/pipeline/     detect, readers (PDF/OCR), spreadsheets, segment, extract, evidence, validate, matching, runner
  app/ai/           AI client (n8n / OpenAI / fake) and the prompts
  tests/            pytest suite (unit, readers/OCR, API, failures, operations)
frontend/           Next.js web app
dataset/            labelled dataset generator (+ sample files)
evaluation/         evaluation script, results and history of runs
n8n/                AI gateway workflow (export + build script)
deploy/             production overlay and scripts
docs/               this documentation
```
