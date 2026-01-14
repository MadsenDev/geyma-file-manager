from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import QProcess


def mount_device(path: str) -> bool:
    if Path(path).exists():
        return True
    # Try udisksctl mount -b <device>
    return QProcess.startDetached("udisksctl", ["mount", "-b", path])


def unmount_device(path: str) -> bool:
    return QProcess.startDetached("udisksctl", ["unmount", "-b", path])
