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

# The empathy-tuned TinyLlama preset is built locally from a Modelfile rather
# than pulled from the registry. Build it from its base when requested.
MODELFILE="${OLLAMA_MODELFILE:-/app/scripts/empathia-tiny.Modelfile}"
if [ "${OLLAMA_MODEL}" = "empathia-tiny" ] && [ -f "${MODELFILE}" ]; then
  echo "Building empathy preset '${OLLAMA_MODEL}' from ${MODELFILE}"
  ollama pull tinyllama:1.1b-chat-v1.0-q4_K_M
  ollama create "${OLLAMA_MODEL}" -f "${MODELFILE}"
else
  echo "Pulling/updating model: ${OLLAMA_MODEL}"
  ollama pull "${OLLAMA_MODEL}"
fi

echo "Model ready: ${OLLAMA_MODEL}"