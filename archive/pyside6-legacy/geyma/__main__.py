from __future__ import annotations

import os
from pathlib import Path
import sys


def _maybe_reexec_local_venv(exc: ModuleNotFoundError) -> None:
    if exc.name != "PySide6":
        raise exc

    repo_root = Path(__file__).resolve().parents[1]
    venv_python = repo_root / ".venv" / "bin" / "python"
    active_prefix = Path(sys.prefix).resolve()
    venv_prefix = (repo_root / ".venv").resolve()
    if not venv_python.exists() or active_prefix == venv_prefix:
        raise exc

    os.execv(str(venv_python), [str(venv_python), "-m", "geyma", *sys.argv[1:]])


try:
    from geyma.app import main
except ModuleNotFoundError as exc:
    _maybe_reexec_local_venv(exc)
    raise


if __name__ == "__main__":
    raise SystemExit(main())
