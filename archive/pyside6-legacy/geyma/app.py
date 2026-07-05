import logging
from pathlib import Path
import sys

from PySide6.QtWidgets import QApplication
from PySide6.QtGui import QGuiApplication, QIcon

from geyma.ui.main_window import MainWindow


def main() -> int:
    _setup_logging()
    app = QApplication(sys.argv)
    app.setApplicationName("geyma")
    app.setApplicationDisplayName("Geyma File Manager")
    QGuiApplication.setDesktopFileName("geyma")
    icon = _load_app_icon()
    if not icon.isNull():
        app.setWindowIcon(icon)

    start_path = sys.argv[1] if len(sys.argv) > 1 else None
    window = MainWindow(start_path=start_path)
    if not icon.isNull():
        window.setWindowIcon(icon)
    window.show()

    return app.exec()


def _setup_logging() -> None:
    log_dir = Path.home() / ".cache/geyma/logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / "geyma.log"
    debug = _load_debug_flag()
    handlers = [logging.FileHandler(log_path)]
    if debug:
        handlers.append(logging.StreamHandler())
    logging.basicConfig(
        level=logging.DEBUG if debug else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=handlers,
    )


def _load_debug_flag() -> bool:
    try:
        from geyma.utils.config import ConfigStore

        return ConfigStore().get_bool("debug_logging", False)
    except Exception:
        return False


def _load_app_icon() -> QIcon:
    root = Path(__file__).resolve().parents[1]
    svg_path = root / "assets" / "geyma.svg"
    if svg_path.exists():
        icon = QIcon(str(svg_path))
        if not icon.isNull():
            return icon
    png_path = root / "assets" / "geyma.png"
    if png_path.exists():
        return QIcon(str(png_path))
    return QIcon.fromTheme("geyma")
