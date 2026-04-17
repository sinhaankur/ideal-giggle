#!/bin/sh
set -eu

# Modes:
# - auto: choose host if host Ollama is reachable, else all-in-one
# - host: app container + host Ollama
# - allinone: single container with preinstalled Ollama
# - sidecar: app + separate Ollama container profile
MODE="${EMPATHIA_MODE:-auto}"
HOST_OLLAMA_URL="${EMPATHIA_HOST_OLLAMA_URL:-http://host.docker.internal:11434}"

# Product defaults with safe overrides.
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2}"
OLLAMA_AUTO_PULL="${OLLAMA_AUTO_PULL:-true}"

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  COMPOSE_STYLE="docker-compose-v2"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_STYLE="docker-compose-v1"
else
  echo "Error: Docker Compose is not available. Install Docker Desktop or docker compose plugin."
  exit 1
fi

compose() {
  if [ "${COMPOSE_STYLE}" = "docker-compose-v2" ]; then
    docker compose "$@"
    return
  fi
  docker-compose "$@"
}

host_ollama_reachable() {
  if command -v curl >/dev/null 2>&1; then
    base="${HOST_OLLAMA_URL%/}"
    tags_url="${base}/api/tags"
    curl -fsS --max-time 2 "${tags_url}" >/dev/null 2>&1
    return $?
  fi

  if command -v ollama >/dev/null 2>&1; then
    OLLAMA_HOST="${HOST_OLLAMA_URL}" ollama list >/dev/null 2>&1
    return $?
  fi

  return 1
}

start_host_mode() {
  echo "Starting EMpathia in host mode (host Ollama: ${HOST_OLLAMA_URL})"
  export OLLAMA_BASE_URL="${HOST_OLLAMA_URL}"
  export NEXT_PUBLIC_OLLAMA_BASE_URL="${HOST_OLLAMA_URL}"
  export NEXT_PUBLIC_DEFAULT_PROVIDER="${NEXT_PUBLIC_DEFAULT_PROVIDER:-ollama}"
  compose up --build empathia "$@"
}

start_allinone_mode() {
  echo "Starting EMpathia in all-in-one mode (preinstalled Ollama in container)"
  export OLLAMA_MODEL
  export OLLAMA_AUTO_PULL
  export NEXT_PUBLIC_DEFAULT_PROVIDER="${NEXT_PUBLIC_DEFAULT_PROVIDER:-ollama}"
  compose --profile allinone up --build "$@"
}

start_sidecar_mode() {
  echo "Starting EMpathia in sidecar mode (app + ollama profile)"
  export OLLAMA_MODEL
  export OLLAMA_BASE_URL="http://ollama:11434"
  export NEXT_PUBLIC_OLLAMA_BASE_URL="http://ollama:11434"
  export NEXT_PUBLIC_DEFAULT_PROVIDER="${NEXT_PUBLIC_DEFAULT_PROVIDER:-ollama}"
  compose --profile ollama up --build "$@"
}

case "${MODE}" in
  auto)
    if host_ollama_reachable; then
      echo "Detected reachable host Ollama."
      start_host_mode "$@"
    else
      echo "Host Ollama not detected. Falling back to all-in-one mode."
      start_allinone_mode "$@"
    fi
    ;;
  host)
    start_host_mode "$@"
    ;;
  allinone)
    start_allinone_mode "$@"
    ;;
  sidecar)
    start_sidecar_mode "$@"
    ;;
  *)
    echo "Invalid EMPATHIA_MODE: ${MODE}"
    echo "Valid values: auto | host | allinone | sidecar"
    exit 1
    ;;
esac