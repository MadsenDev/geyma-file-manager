from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import QProcess


def mount_device(path: str) -> bool:
    target = Path(path)
    if target.exists() and target.is_dir():
        return True
    # Try udisksctl mount -b <device>
    return QProcess.startDetached("udisksctl", ["mount", "-b", path])


def unmount_device(path: str) -> bool:
    target = Path(path)
    if target.exists() and target.is_dir():
        return QProcess.startDetached("udisksctl", ["unmount", "-m", path])
    return QProcess.startDetached("udisksctl", ["unmount", "-b", path])
