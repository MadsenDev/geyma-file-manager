from __future__ import annotations

from base64 import b64decode
from dataclasses import dataclass
from pathlib import Path
import os
import tempfile
from typing import Any

from PySide6.QtCore import QObject, QRunnable, Signal

from geyma.ai.provider_registry import create_provider
from geyma.utils.config import ConfigStore


class ImageGenerationSignals(QObject):
    progress = Signal(int)
    current = Signal(str)
    meta = Signal(str)
    error = Signal(str)
    finished = Signal(str)


@dataclass(frozen=True)
class ImageGenerationPlan:
    mode: str
    payload: dict[str, Any]


class ImageGenerationWorker(QRunnable):
    def __init__(self, mode: str, payload: dict[str, Any]) -> None:
        super().__init__()
        self.signals = ImageGenerationSignals()
        self._plan = ImageGenerationPlan(mode=mode, payload=payload)
        self._cancel = False
        self._config = ConfigStore()

    def cancel(self) -> None:
        self._cancel = True

    def run(self) -> None:
        self.signals.current.emit("Generating image")
        self.signals.progress.emit(5)

        if self._cancel:
            self.signals.finished.emit("")
            return

        provider_name = self._config.get_str("ai_provider", "none")
        provider = create_provider(provider_name)
        feature = _feature_for_mode(self._plan.mode)
        if not provider.is_configured():
            self.signals.error.emit("AI provider is not configured.")
            self.signals.finished.emit("")
            return
        if not provider.supports(feature):
            self.signals.error.emit("Provider does not support image generation.")
            self.signals.finished.emit("")
            return

        self.signals.meta.emit("Contacting provider...")
        try:
            response = provider.run(feature, self._plan.payload)
        except RuntimeError as exc:
            self.signals.error.emit(str(exc))
            self.signals.finished.emit("")
            return

        if self._cancel:
            self.signals.finished.emit("")
            return

        self.signals.progress.emit(70)
        self.signals.meta.emit("Processing response...")
        image_bytes = _extract_image_bytes(response)
        if not image_bytes:
            self.signals.error.emit("No image data returned from provider.")
            self.signals.finished.emit("")
            return

        self.signals.progress.emit(90)
        self.signals.meta.emit("Saving image...")
        output_path = _write_output(self._plan.payload, image_bytes)
        self.signals.progress.emit(100)
        self.signals.meta.emit("Saved")
        self.signals.finished.emit(str(output_path))


def _feature_for_mode(mode: str) -> str:
    if mode == "variation":
        return "image_variation"
    if mode == "edit":
        return "image_edit"
    return "image_generation"


def _extract_image_bytes(response: dict[str, Any]) -> bytes:
    raw = response.get("image_bytes")
    if isinstance(raw, bytes):
        return raw
    if isinstance(raw, str):
        try:
            return b64decode(raw)
        except ValueError:
            return b""
    raw = response.get("image_base64") or response.get("b64_json")
    if isinstance(raw, str):
        try:
            return b64decode(raw)
        except ValueError:
            return b""
    return b""


def _write_output(payload: dict[str, Any], image_bytes: bytes) -> Path:
    folder = Path(payload.get("folder", "")).expanduser()
    folder.mkdir(parents=True, exist_ok=True)
    template = str(payload.get("filename", "generated_{n}")).strip() or "generated_{n}"
    ext = str(payload.get("format", "png")).lstrip(".").lower() or "png"
    if "{n}" not in template:
        template = f"{template}_{{n}}"
    output = _resolve_unique_path(folder, template, ext)
    with tempfile.NamedTemporaryFile(delete=False, dir=str(folder), suffix=f".{ext}") as tmp:
        tmp.write(image_bytes)
        tmp.flush()
        os.fsync(tmp.fileno())
        tmp_path = Path(tmp.name)
    os.replace(str(tmp_path), str(output))
    return output


def _resolve_unique_path(folder: Path, template: str, ext: str) -> Path:
    for counter in range(1, 10000):
        name = template.format(n=counter)
        candidate = folder / f"{name}.{ext}"
        if not candidate.exists():
            return candidate
    return folder / f"{template.format(n='final')}.{ext}"
