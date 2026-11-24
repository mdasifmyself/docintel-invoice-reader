# DocIntel: AI invoice and document reading

DocIntel reads invoices and receipts and turns them into checked data.

- **Case study:** https://asifmyself.xyz/case-studies/docintel-invoice-reader

You upload files: PDFs, scans, phone photos, TIFF, Excel or CSV. DocIntel finds every invoice, pulls out the
important values with AI, and **proves each value against the document**. It checks the maths, finds duplicates and
differences between documents, and sends only the unsure cases to a person. Everything can be searched and exported
to Excel.

The one rule: **nothing is guessed.** A value without proof in the document stays empty and is flagged.

## Key features

| | |
|---|---|
| **Inputs** | PDF (text or scanned, up to 1,500 pages, many invoices per file), JPG, PNG, multi-page TIFF, XLSX (every sheet), XLS, CSV (any delimiter and number format) |
| **Extracts** | invoice number, date, supplier, customer, subtotal, tax, total, currency, line items: structured JSON, each value with its source quote and confidence |
| **Never invents** | no proof in the document → the field stays empty and is flagged; ambiguous dates are never guessed |
| **Checks** | missing fields, impossible amounts, subtotal + tax = total, line items = subtotal, quantity × price, future and ambiguous dates, duplicate invoices and files, PDF ↔ PDF and PDF ↔ Excel differences |
| **People** | review queue, side-by-side page and data, plain "What to do" for every problem, corrections with full history, approval |
| **Find** | keyword, semantic (meaning) and hybrid search with filters; Excel export of everything or any filtered view |
| **Runs reliably** | background workers, automatic retries, resumable jobs, automatic recovery of stuck jobs, system health page |
| **Cost control** | daily AI call budget, upload limits, rate limits, and an optional access code that locks the app |

## How it works

```mermaid
flowchart LR
    U[Browser] --> W["Web app<br/>Next.js"]
    W -->|/api proxy| A["REST API<br/>FastAPI"]
    A --> Q[(Redis queue)]
    Q --> K["Workers<br/>OCR · PDF · sheets · AI"]
    K --> G["AI gateway<br/>n8n → OpenAI"]
    A & K --> P[("PostgreSQL<br/>+ pgvector")]
```

1. **Check the file**: the type comes from the file's bytes, not its name; damaged, empty and locked files stop
   with a clear reason.
2. **Read**: text PDFs are read directly; scans and photos are rotated, straightened and cleaned, then read with
   Tesseract OCR; every Excel sheet is read and columns are mapped without AI.
3. **Split**: long PDFs and multi-page TIFFs are split into separate invoices.
4. **Extract**: an AI model fills a strict JSON form and must quote its source for every value. **Scans are read
   twice** (OCR text and page image, independently) and the two readings are compared.
5. **Prove and check**: code verifies each quote and value; unproven values are removed; all validation rules,
   duplicate checks and cross-document checks run.
6. **Index**: full-text and vector search; results, problems and the full processing history are stored.

## Architecture

| Part | Technology | What it does |
|---|---|---|
| Web app | Next.js 16, React 19, TypeScript | Upload, live progress, review, corrections, search, system health. Forwards `/api/*` to the API, so the browser talks to one address only. |
| API | Python 3.12, FastAPI, Pydantic | REST API with interactive documentation at `/api/docs`. Uploads return at once; the work runs in the background. |
| Background work | Redis + RQ workers | OCR and AI jobs, retries, timeouts, recovery of stuck jobs. Add workers to process more files at once. |
| Reading | Tesseract 5 + OpenCV, pypdfium2, pandas, openpyxl, xlrd | OCR with image clean-up, exact text from digital PDFs, every spreadsheet sheet. |
| AI | OpenAI `gpt-4.1-mini` (text and images), `text-embedding-3-small` (search) | Strict JSON output with a source quote for each value. Called directly, or through the n8n gateway. |
| AI gateway (optional) | n8n workflow | Keeps the OpenAI key inside n8n. Allows only two kinds of calls and caps the request size. |
| Data and search | PostgreSQL 16 + pgvector + pg_trgm | Records, processing history, keyword search, fuzzy name search and meaning search in one database. |

More detail: [architecture](docs/02-architecture.md) · [database schema](docs/03-database-schema.md) ·
[API](docs/04-api-reference.md).

## Measured test results

Measured on **10 November 2026** by [`evaluation/run_eval.py`](evaluation/run_eval.py) against a deployed copy of
the system (2 workers on a small 2-CPU server), starting from an empty database and an empty AI answer cache.

**The test files are synthetic.** They are generated invoices with a known correct answer for every value: 96 files
holding 141 invoices (digital PDFs, scans, phone photos, very poor photos, TIFF, batch PDFs, Excel, XLS, CSV, broken
and locked files) with 55 planted problems. All companies in them are fictional. Real invoices from many suppliers
vary more, so accuracy on real documents may be lower.

| Metric | Result |
|---|---|
| Field accuracy (8 fields × 141 invoices) | **100.0 %** |
| Invoices with every field correct | 100.0 % |
| Line items exactly right (every amount) | 99.0 % |
| Invoices found (incl. splitting multi-invoice PDFs and TIFFs) | 141 / 141 |
| Values invented where nothing was printed | **0** |
| Planted problems caught (wrong totals, duplicates, conflicts, missing fields…) | **55/55** |
| Valid files processed / failure rate | 100.0 % / 0.0 % |
| Broken or locked files stopped with a clear reason | 100.0 % of 6 |
| Clean invoices sent to a person anyway | 5.7 % (6 / 105), all values read from phone photos that the OCR text could not confirm |
| Median time per file (incl. OCR and AI) | 5.0 s (scans ≈ 15 s: read twice) |
| 1,000-page batch PDF | 1,000 pages, 789/789 invoices found, 100.0 % field accuracy, 17.3 min |
| Automated tests | 93 passed, 87 % line coverage |

Full report with the method and the history of runs: [docs/08-evaluation-report.md](docs/08-evaluation-report.md).
Result files: [`evaluation/results/`](evaluation/results/).

## Run it locally (Docker Compose)

You need Docker with Compose v2, an OpenAI API key, and Node.js 20+ for the web app.

```bash
cp .env.example .env              # add OPENAI_API_KEY
docker compose up -d --build      # API, 2 workers, PostgreSQL + pgvector, Redis
open http://localhost:8000/api/docs

cd frontend
cp .env.example .env.local        # BACKEND_ORIGIN=http://localhost:8000
npm install
npm run dev                       # http://localhost:3000
```

The database tables are created automatically on the first start.

To use the **Process all sample files** button, copy the sample files into the running stack once:

```bash
docker compose cp frontend/public/samples/. api:/data/samples/
```

Full instructions: [docs/06-setup-and-deployment.md](docs/06-setup-and-deployment.md).

## Configuration

All settings are environment variables. Names only here; meanings and defaults are in
[docs/06-setup-and-deployment.md](docs/06-setup-and-deployment.md) and [`.env.example`](.env.example).

| Group | Variables (file `.env`) |
|---|---|
| AI | `AI_PROVIDER`, `OPENAI_API_KEY`, `AI_GATEWAY_URL`, `AI_GATEWAY_KEY`, `EXTRACTION_MODEL`, `VISION_MODEL`, `EMBEDDING_MODEL`, `AI_CONCURRENCY`, `AI_CACHE` |
| Cost and limits | `AI_DAILY_CALL_LIMIT`, `MAX_FILE_MB`, `MAX_FILES_PER_UPLOAD`, `MAX_PAGES`, `UPLOADS_PER_MINUTE` |
| Access | `ACCESS_CODES`, `CORS_ORIGINS` |
| Reading and recovery | `OCR_DPI`, `RECOVERY_STALE_MINUTES` |
| Services | `POSTGRES_PASSWORD`, `DATABASE_URL`, `REDIS_URL`, `API_HOST` (server deployment only) |

| Web app (file `frontend/.env.local`) | |
|---|---|
| `BACKEND_ORIGIN` | where the API is; read when the web app is built |
| `NEXT_PUBLIC_REPO_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_BUILD_COMMIT` | optional |

**Access code.** `ACCESS_CODES` is optional. Leave it empty and the app is open: nobody is asked for a code. Set
one or more codes (comma-separated) and the web app shows a lock screen, and every API request needs the code.

## Tests

```bash
docker compose up -d db redis
cd backend
pip install -r requirements-dev.txt          # Tesseract must be installed (apt install tesseract-ocr)
TEST_DATABASE_URL=postgresql+psycopg://docintel:docintel@localhost:5432/docintel_test \
REDIS_URL=redis://localhost:6379/15 pytest -rf --cov=app
```

The tests run against a real PostgreSQL, Redis and Tesseract, with a fake AI (no network, no cost). The same tests
and a type check plus production build of the web app run in GitHub Actions on every push. Details:
[docs/07-testing.md](docs/07-testing.md).

## Known limits

* The measured results come from synthetic test files. Real documents vary more.
* Very poor photos can still be misread. Such invoices are always sent to a person.
* OCR is set up for English only.
* A "$" sign alone is read as USD.
* Scanned invoices longer than 3 pages get one reading, not two.
* Speed depends on the AI provider's rate limit: a 1,000-page batch takes minutes, not seconds.
* There are no user accounts. Everyone who can open the app sees the same documents, so use an open demo with
  sample files only.

More: [docs/11-limitations-and-roadmap.md](docs/11-limitations-and-roadmap.md).

## Documentation

| Document | Contents |
|---|---|
| [01 Feature checklist](docs/01-feature-checklist.md) | Every feature → where it is implemented → evidence |
| [02 Architecture](docs/02-architecture.md) | Components, pipeline, design decisions, scaling |
| [03 Database schema](docs/03-database-schema.md) | Tables, ER diagram, indexes, search |
| [04 API reference](docs/04-api-reference.md) | Endpoints, examples, JSON shape, errors |
| [05 How to use](docs/05-how-to-use.md) | The screens, a typical session, reading results, errors |
| [06 Setup and deployment](docs/06-setup-and-deployment.md) | Local run, configuration, production deployment |
| [07 Testing](docs/07-testing.md) | Test suite, coverage, bugs found and fixed |
| [08 Evaluation report](docs/08-evaluation-report.md) | Dataset, method, measured accuracy and speed, run history |
| [09 Security](docs/09-security.md) | Access, transport, uploads, secrets, audit |
| [10 Operations and recovery](docs/10-operations-and-recovery.md) | Failure handling, recovery, runbook, monitoring |
| [11 Limitations and roadmap](docs/11-limitations-and-roadmap.md) | Honest limits and next steps |

## Repository

```
backend/      FastAPI API, processing pipeline, workers, tests (pytest), Dockerfile
frontend/     Next.js web app
dataset/      generator for the labelled test files and the sample files
evaluation/   evaluation script, latest results and the history of runs
n8n/          AI gateway workflow (keeps the OpenAI key out of the code)
deploy/       server overlay (HTTPS, limits) and deployment scripts
docs/         documentation
```

## Licence

© Md Asif. All rights reserved.

## Contact

Md Asif · https://asifmyself.xyz · mdasifmyself@gmail.com
