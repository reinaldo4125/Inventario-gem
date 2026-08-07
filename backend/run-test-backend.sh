#!/usr/bin/env bash
# Run backend in test environment (Unix)
ENV_FILE="$(dirname "$0")/.env.test"
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
else
  echo "No .env.test found. Create one from .env.test.example or export vars manually."
fi

npm --prefix "$(dirname "$0")" start
