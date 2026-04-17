#!/bin/sh
set -eu

OLLAMA_HOST="${OLLAMA_HOST:-0.0.0.0:11434}"
OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2}"
OLLAMA_AUTO_PULL="${OLLAMA_AUTO_PULL:-true}"
OLLAMA_START_TIMEOUT_SEC="${OLLAMA_START_TIMEOUT_SEC:-90}"

export OLLAMA_HOST

echo "Starting Ollama service on ${OLLAMA_HOST}..."
ollama serve >/tmp/ollama.log 2>&1 &
OLLAMA_PID="$!"

cleanup() {
  kill "${OLLAMA_PID}" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "Waiting for Ollama API at ${OLLAMA_BASE_URL}..."
reachable="false"
for _ in $(seq 1 "${OLLAMA_START_TIMEOUT_SEC}"); do
  if OLLAMA_HOST="${OLLAMA_BASE_URL}" ollama list >/dev/null 2>&1; then
    reachable="true"
    break
  fi
  sleep 1
done

if [ "${reachable}" != "true" ]; then
  echo "Ollama did not become ready within ${OLLAMA_START_TIMEOUT_SEC}s at ${OLLAMA_BASE_URL}."
  exit 1
fi

if [ "${OLLAMA_AUTO_PULL}" = "true" ]; then
  echo "Auto-updating model: ${OLLAMA_MODEL}"
  OLLAMA_HOST="${OLLAMA_BASE_URL}" ollama pull "${OLLAMA_MODEL}"
else
  echo "Skipping model auto-update (OLLAMA_AUTO_PULL=${OLLAMA_AUTO_PULL})."
fi

echo "Starting EMpathia app..."
pnpm start