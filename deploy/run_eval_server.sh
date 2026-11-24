#!/usr/bin/env bash
# Run a measured evaluation on the server from a clean state (fresh database, empty AI answer cache).
#   deploy/run_eval_server.sh            # labelled dataset (96 files)
#   deploy/run_eval_server.sh --big      # the 1,000-page batch PDF
set -euo pipefail
# Settings: ~/.config/asif-demos/docintel-server.env; if the server is locked, the access code is read from
# ~/.config/asif-demos/docintel_access_code (leave the file out when ACCESS_CODES is empty on the server).
source ~/.config/asif-demos/docintel-server.env
KEY="${SSH_KEY/#\~/$HOME}"
AC_FILE=~/.config/asif-demos/docintel_access_code
CODE_ARG=""; [[ -f "$AC_FILE" ]] && CODE_ARG="--code $(cat "$AC_FILE")"
ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes "$SSH_HOST" "cd $REMOTE_DIR/app && \
  if [ \"${1:-}\" != \"--big\" ]; then \
    docker compose exec -T db psql -U docintel -d docintel -qc 'TRUNCATE cross_checks, corrections, validation_issues, invoices, document_pages, processing_events, documents CASCADE;' && \
    docker compose exec -T -u 0 api sh -c 'rm -rf /data/uploads/* /data/uploads/previews' ; fi && \
  docker compose exec -T redis sh -c 'redis-cli --scan --pattern \"docintel:ai_cache:*\" | xargs -r redis-cli del >/dev/null' && \
  docker compose -f docker-compose.yml -f deploy/docker-compose.server.yml run --rm --no-deps -u 0 -l traefik.enable=false \
    -e PYTHONPATH=/app -v $REMOTE_DIR/app/evaluation:/eval -v $REMOTE_DIR/app/dataset:/dataset \
    api python /eval/run_eval.py --api http://api:8000 $CODE_ARG --data /dataset/out --out /eval/results --timeout 5400 ${1:-} \
    > /tmp/docintel-demo-eval.log 2>&1; tail -c 2500 /tmp/docintel-demo-eval.log"
