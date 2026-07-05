from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os
import shutil
import time

from PySide6.QtCore import QObject, QRunnable, Signal


class TransferSignals(QObject):
    progress = Signal(int)
    current = Signal(str)
    meta = Signal(str)
    error = Signal(str)
    finished = Signal()
    itemResult = Signal(str, str, str, bool, str)


@dataclass
class TransferPlan:
    items: list["TransferItem"]


@dataclass
class TransferItem:
    source: Path
    destination: Path
    mode: str
    replace: bool = False
    preserve: bool = True


class TransferWorker(QRunnable):
    def __init__(
        self,
        items: list[TransferItem],
    ) -> None:
        super().__init__()
        self.signals = TransferSignals()
        self._plan = TransferPlan(items)
        self._cancel = False

    def cancel(self) -> None:
        self._cancel = True

    def run(self) -> None:
        total = len(self._plan.items)
        if total == 0:
            self.signals.finished.emit()
            return

        start_time = time.monotonic()
        total_bytes = self._estimate_total_bytes()
        bytes_done = 0
        for index, item in enumerate(self._plan.items, start=1):
            if self._cancel:
                break
            source = item.source
            dest = item.destination
            if not source.exists():
                continue
            self.signals.current.emit(source.name)
            try:
                if item.replace:
                    self._remove_existing(dest)
                if item.mode == "copy":
                    bytes_done += self._copy_item_with_progress(source, dest, item.preserve)
                else:
                    if self._same_filesystem(source, dest):
                        source.rename(dest)
                    else:
                        bytes_done += self._copy_item_with_progress(source, dest, item.preserve)
                        self._remove_existing(source)
                self.signals.itemResult.emit(str(source), str(dest), item.mode, True, "")
            except OSError as exc:
                self.signals.error.emit(str(exc))
                self.signals.itemResult.emit(str(source), str(dest), item.mode, False, str(exc))
            percent = self._compute_percent(bytes_done, total_bytes, index, total)
            self.signals.progress.emit(percent)
            elapsed = max(time.monotonic() - start_time, 0.01)
            if total_bytes > 0:
                rate = bytes_done / elapsed
                remaining = max(total_bytes - bytes_done, 0)
                eta_seconds = int(remaining / rate) if rate > 0 else 0
                self.signals.meta.emit(f"{self._format_rate(rate)} - {self._format_eta(eta_seconds)}")
            else:
                rate = index / elapsed
                remaining = total - index
                eta_seconds = int(remaining / rate) if rate > 0 else 0
                self.signals.meta.emit(f"{rate:.1f} items/s - {self._format_eta(eta_seconds)}")

        self.signals.finished.emit()

    def _copy_item_with_progress(self, source: Path, dest: Path, preserve: bool) -> int:
        if source.is_symlink():
            if preserve:
                shutil.copy2(source, dest, follow_symlinks=False)
            else:
                shutil.copyfile(source, dest, follow_symlinks=False)
            return source.lstat().st_size
        if source.is_dir():
            return self._copy_dir_with_progress(source, dest, preserve)
        return self._copy_file_with_progress(source, dest, preserve)

    def _copy_dir_with_progress(self, source: Path, dest: Path, preserve: bool) -> int:
        bytes_done = 0
        dest.mkdir(parents=True, exist_ok=True)
        for root, dirnames, filenames in os.walk(source):
            if self._cancel:
                break
            rel = Path(root).relative_to(source)
            dest_root = dest / rel
            dest_root.mkdir(parents=True, exist_ok=True)
            for name in filenames:
                if self._cancel:
                    break
                src_file = Path(root) / name
                dst_file = dest_root / name
                bytes_done += self._copy_file_with_progress(src_file, dst_file, preserve)
            for name in dirnames:
                (dest_root / name).mkdir(parents=True, exist_ok=True)
        if preserve:
            shutil.copystat(source, dest, follow_symlinks=False)
        return bytes_done

    def _copy_file_with_progress(self, source: Path, dest: Path, preserve: bool) -> int:
        if source.is_symlink():
            if preserve:
                shutil.copy2(source, dest, follow_symlinks=False)
            else:
                shutil.copyfile(source, dest, follow_symlinks=False)
            return source.lstat().st_size
        bytes_done = 0
        buffer_size = 1024 * 1024
        with source.open("rb") as src, dest.open("wb") as dst:
            while True:
                if self._cancel:
                    break
                chunk = src.read(buffer_size)
                if not chunk:
                    break
                dst.write(chunk)
                bytes_done += len(chunk)
        if preserve:
            shutil.copystat(source, dest, follow_symlinks=False)
        return bytes_done

    @staticmethod
    def _same_filesystem(src: Path, dest: Path) -> bool:
        try:
            return src.stat().st_dev == dest.parent.stat().st_dev
        except OSError:
            return False

    @staticmethod
    def _remove_existing(path: Path) -> None:
        if not path.exists():
            return
        if path.is_dir() and not path.is_symlink():
            shutil.rmtree(path)
        else:
            path.unlink()

    def _estimate_total_bytes(self) -> int:
        total = 0
        for item in self._plan.items:
            if item.mode == "copy" or not self._same_filesystem(item.source, item.destination):
                total += self._size_for_path(item.source)
        return total

    def _size_for_path(self, path: Path) -> int:
        if path.is_symlink():
            try:
                return path.lstat().st_size
            except OSError:
                return 0
        if path.is_file():
            try:
                return path.stat().st_size
            except OSError:
                return 0
        if path.is_dir():
            total = 0
            for root, dirnames, filenames in os.walk(path):
                if self._cancel:
                    break
                dirnames[:] = [d for d in dirnames if not (Path(root) / d).is_symlink()]
                for name in filenames:
                    file_path = Path(root) / name
                    try:
                        if file_path.is_symlink():
                            total += file_path.lstat().st_size
                        else:
                            total += file_path.stat().st_size
                    except OSError:
                        continue
            return total
        return 0

    @staticmethod
    def _compute_percent(bytes_done: int, total_bytes: int, index: int, total: int) -> int:
        if total_bytes > 0:
            return int((bytes_done / total_bytes) * 100)
        return int((index / total) * 100)

    @staticmethod
    def _format_rate(bytes_per_sec: float) -> str:
        units = ["B/s", "KB/s", "MB/s", "GB/s"]
        rate = bytes_per_sec
        for unit in units:
            if rate < 1024 or unit == units[-1]:
                return f"{rate:.1f} {unit}"
            rate /= 1024
        return f"{rate:.1f} B/s"
    @staticmethod
    def _format_eta(seconds: int) -> str:
        minutes, sec = divmod(seconds, 60)
        hours, minutes = divmod(minutes, 60)
        if hours:
            return f"ETA {hours}h {minutes}m"
        if minutes:
            return f"ETA {minutes}m {sec}s"
        return f"ETA {sec}s"
