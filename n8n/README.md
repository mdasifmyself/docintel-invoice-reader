# AI gateway (n8n)

The workers never hold the OpenAI key. They call one n8n webhook, and n8n forwards an allow-listed request to OpenAI
using its own credential store.

```
worker ──POST {op, payload} + X-DocIntel-Key──▶ n8n webhook ──▶ Check request ──▶ OpenAI (responses | embeddings)
```

* **Allowed operations:** `responses` (extraction, image reading) and `embeddings` (semantic search). Anything else is
  rejected with 400.
* **Privacy:** `store: false` is forced on every response request; successful and failed executions are not saved in n8n.
* **Limits:** payloads over 6 MB are rejected (page images are sent as compressed JPEG).
* **Alerts (optional):** with `alerts_workflow.json` (the id of a separate alerts workflow) in the settings folder, an
  OpenAI error or a crashed run sends the team a short message: the error line only, never document text.

Files:

* `ai-gateway.workflow.json`: shareable export (credential ids replaced with placeholders). Import it into n8n, attach
  an OpenAI credential and a Header Auth credential named `X-DocIntel-Key`, and activate it.
* `build_gateway.py`: creates or updates the workflow through the n8n API, activates it and stores the gateway URL and
  header key locally. It reads three files from `~/.config/asif-demos/` (never committed):
  `n8n_url` (address of the n8n server), `n8n_api_key` (an n8n API key) and `openai_credential.json`
  (`{"id": "...", "name": "..."}` of an OpenAI credential that already exists in n8n). It writes
  `docintel_gateway_url`, `docintel_gateway_key` and `docintel_gateway_cred.json` into the same folder.

The workflow is named `DocIntel | AI Gateway` and listens on the webhook path
`docintel/ai`. Both belong to this copy only, so it can share an n8n server with other workflows.

Then set `AI_PROVIDER=n8n`, `AI_GATEWAY_URL` and `AI_GATEWAY_KEY` for the API and workers. Without n8n, set
`AI_PROVIDER=openai` and `OPENAI_API_KEY` instead; the result is the same.
