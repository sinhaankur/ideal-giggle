#!/bin/sh
set -eu

OLLAMA_HOST="${OLLAMA_HOST:-http://ollama:11434}"
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2}"
export OLLAMA_HOST

echo "Waiting for Ollama at ${OLLAMA_HOST}..."
reachable="false"
for _ in $(seq 1 60); do
  if ollama list >/dev/null 2>&1; then
    echo "Ollama is reachable."
    reachable="true"
    break
  fi
  sleep 2
done

if [ "${reachable}" != "true" ]; then
  echo "Ollama did not become reachable in time at ${OLLAMA_HOST}."
  exit 1
fi

echo "Pulling/updating model: ${OLLAMA_MODEL}"
ollama pull "${OLLAMA_MODEL}"

echo "Model ready: ${OLLAMA_MODEL}"