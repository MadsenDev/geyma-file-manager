from __future__ import annotations

from pathlib import Path

from collections import OrderedDict

from PySide6.QtCore import Qt
from PySide6.QtGui import QIcon, QImageReader, QPixmap
from PySide6.QtWidgets import QFileIconProvider

from geyma.utils.config import ConfigStore


class ThumbnailIconProvider(QFileIconProvider):
    def __init__(self) -> None:
        super().__init__()
        self._cache: OrderedDict[str, QIcon] = OrderedDict()
        self._config = ConfigStore()
        self._cache_limit = int(self._config.get("thumbnail_cache_size", 256))

    def icon(self, file_info):
        if file_info.isDir():
            return super().icon(file_info)

        path = file_info.filePath()
        if not self._is_image(path):
            return super().icon(file_info)

        max_bytes = self._max_thumbnail_bytes()
        try:
            if file_info.size() > max_bytes:
                return super().icon(file_info)
        except OSError:
            return super().icon(file_info)

        cached = self._cache.get(path)
        if cached is not None:
            self._cache.move_to_end(path)
            return cached

        size = self._thumbnail_size()
        reader = QImageReader(path)
        reader.setAutoTransform(True)
        image = reader.read()
        if image.isNull():
            return super().icon(file_info)

        pixmap = QPixmap.fromImage(image).scaled(
            size,
            size,
            Qt.KeepAspectRatio,
            Qt.SmoothTransformation,
        )
        icon = QIcon(pixmap)
        self._cache[path] = icon
        if len(self._cache) > self._cache_limit:
            self._cache.popitem(last=False)
        return icon

    def _thumbnail_size(self) -> int:
        return int(self._config.get("grid_icon_size", 64))

    def _max_thumbnail_bytes(self) -> int:
        mode = str(self._config.get("thumbnail_mode", "minimal")).lower()
        if mode == "full":
            return int(self._config.get("thumbnail_max_bytes", 50 * 1024 * 1024))
        return int(self._config.get("thumbnail_max_bytes", 10 * 1024 * 1024))

    @staticmethod
    def _is_image(path: str) -> bool:
        suffix = Path(path).suffix.lower().lstrip(".")
        if not suffix:
            return False
        return suffix.encode() in QImageReader.supportedImageFormats()
