#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$ROOT_DIR/.venv"
PYTHON_BIN="${PYTHON:-python3}"
VENV_PYTHON="$VENV_DIR/bin/python"

if [[ ! -x "$VENV_PYTHON" ]]; then
    "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

"$VENV_PYTHON" -m pip install -e "$ROOT_DIR"
exec "$VENV_PYTHON" -m geyma "$@"
