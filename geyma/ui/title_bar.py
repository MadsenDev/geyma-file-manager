from __future__ import annotations

from PySide6.QtCore import QEvent, QPoint, Qt
from PySide6.QtWidgets import QHBoxLayout, QLabel, QPushButton, QWidget


class TitleBar(QWidget):
    def __init__(
        self,
        parent=None,
        title: str | None = None,
        show_minimize: bool = True,
        show_maximize: bool = True,
        show_close: bool = True,
    ) -> None:
        super().__init__(parent)
        self.setObjectName("TitleBar")
        self._drag_pos: QPoint | None = None

        self._title = QLabel(title or "Geyma File Manager")
        self._title.setObjectName("TitleLabel")

        self._min_button = QPushButton("—")
        self._max_button = QPushButton("□")
        self._close_button = QPushButton("×")
        for button in (self._min_button, self._max_button, self._close_button):
            button.setObjectName("TitleButton")
            button.setCursor(Qt.PointingHandCursor)
            button.installEventFilter(self)

        self._min_button.clicked.connect(self._on_minimize)
        self._max_button.clicked.connect(self._on_maximize_restore)
        self._close_button.clicked.connect(self._on_close)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(12, 6, 12, 6)
        layout.addWidget(self._title)
        layout.addStretch(1)
        if show_minimize:
            layout.addWidget(self._min_button)
        if show_maximize:
            layout.addWidget(self._max_button)
        if show_close:
            layout.addWidget(self._close_button)

        self._title.installEventFilter(self)
        self.installEventFilter(self)

    def set_title(self, title: str) -> None:
        self._title.setText(title)

    def eventFilter(self, obj, event):
        if event.type() == QEvent.MouseButtonPress and event.button() == Qt.LeftButton:
            if obj in {self._min_button, self._max_button, self._close_button}:
                return super().eventFilter(obj, event)
            if self._start_system_move():
                event.accept()
                return True
            self._drag_pos = event.globalPosition().toPoint() - self.window().frameGeometry().topLeft()
            event.accept()
            return True
        if event.type() == QEvent.MouseMove and self._drag_pos is not None:
            if event.buttons() & Qt.LeftButton:
                self.window().move(event.globalPosition().toPoint() - self._drag_pos)
                event.accept()
                return True
        if event.type() == QEvent.MouseButtonRelease:
            self._drag_pos = None
        return super().eventFilter(obj, event)

    def mousePressEvent(self, event) -> None:
        if event.button() == Qt.LeftButton:
            if self._start_system_move():
                event.accept()
                return
            self._drag_pos = event.globalPosition().toPoint() - self.window().frameGeometry().topLeft()
            event.accept()
        else:
            super().mousePressEvent(event)

    def mouseMoveEvent(self, event) -> None:
        if self._drag_pos is not None and event.buttons() & Qt.LeftButton:
            self.window().move(event.globalPosition().toPoint() - self._drag_pos)
            event.accept()
        else:
            super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event) -> None:
        self._drag_pos = None
        super().mouseReleaseEvent(event)

    def mouseDoubleClickEvent(self, event) -> None:
        if event.button() == Qt.LeftButton:
            self._on_maximize_restore()
            event.accept()
        else:
            super().mouseDoubleClickEvent(event)

    def _on_minimize(self) -> None:
        self.window().showMinimized()

    def _on_maximize_restore(self) -> None:
        window = self.window()
        if window.isMaximized():
            window.showNormal()
        else:
            window.showMaximized()

    def _on_close(self) -> None:
        self.window().close()

    def _start_system_move(self) -> bool:
        window = self.window().windowHandle()
        if window is None:
            return False
        try:
            return bool(window.startSystemMove())
        except Exception:
            return False
