from __future__ import annotations

from PySide6.QtCore import QSize, Qt, Signal
from PySide6.QtWidgets import (
    QAbstractItemView,
    QHeaderView,
    QListView,
    QStackedWidget,
    QTreeView,
    QVBoxLayout,
    QWidget,
)


class FileViewStack(QWidget):
    selectionChanged = Signal()
    itemActivated = Signal(object)
    itemSingleClicked = Signal(object)
    contextMenuRequested = Signal(object, object)

    def __init__(
        self,
        proxy_model,
        list_icon_size: int,
        grid_icon_size: int,
        row_padding: int,
        grid_spacing: int,
        parent=None,
    ) -> None:
        super().__init__(parent)
        self._proxy = proxy_model
        self._list_icon_size = list_icon_size
        self._grid_icon_size = grid_icon_size
        self._row_padding = row_padding
        self._grid_spacing = grid_spacing

        self.list_view = QTreeView()
        self.list_view.setModel(self._proxy)
        self.list_view.setSelectionMode(QAbstractItemView.ExtendedSelection)
        self.list_view.setEditTriggers(QAbstractItemView.SelectedClicked | QAbstractItemView.EditKeyPressed)
        self.list_view.setContextMenuPolicy(Qt.CustomContextMenu)
        self.list_view.setSortingEnabled(True)
        self.list_view.setAlternatingRowColors(True)
        self.list_view.setUniformRowHeights(True)
        self.list_view.setIconSize(QSize(self._list_icon_size, self._list_icon_size))
        self.list_view.header().setStretchLastSection(False)
        self.list_view.header().setSectionResizeMode(0, QHeaderView.Stretch)
        self.list_view.header().setSectionResizeMode(1, QHeaderView.ResizeToContents)
        self.list_view.header().setSectionResizeMode(2, QHeaderView.ResizeToContents)
        self.list_view.header().setSectionResizeMode(3, QHeaderView.ResizeToContents)

        self.icon_view = QListView()
        self.icon_view.setObjectName("IconView")
        self.icon_view.setModel(self._proxy)
        self.icon_view.setSelectionMode(QAbstractItemView.ExtendedSelection)
        self.icon_view.setEditTriggers(QAbstractItemView.SelectedClicked | QAbstractItemView.EditKeyPressed)
        self.icon_view.setContextMenuPolicy(Qt.CustomContextMenu)
        self.icon_view.setViewMode(QListView.IconMode)
        self.icon_view.setResizeMode(QListView.Adjust)
        self.icon_view.setSpacing(self._grid_spacing)
        self.icon_view.setIconSize(QSize(self._grid_icon_size, self._grid_icon_size))

        self.active_view = self.list_view

        self._stack = QStackedWidget()
        self._stack.addWidget(self.list_view)
        self._stack.addWidget(self.icon_view)
        self._stack.setCurrentWidget(self.list_view)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        layout.addWidget(self._stack)

        self.list_view.doubleClicked.connect(self._on_item_activated)
        self.list_view.clicked.connect(self._on_item_clicked)
        self.icon_view.doubleClicked.connect(self._on_item_activated)
        self.icon_view.clicked.connect(self._on_item_clicked)
        self.list_view.customContextMenuRequested.connect(
            lambda pos: self.contextMenuRequested.emit(pos, self.list_view)
        )
        self.icon_view.customContextMenuRequested.connect(
            lambda pos: self.contextMenuRequested.emit(pos, self.icon_view)
        )

        selection_model = self.list_view.selectionModel()
        if selection_model is not None:
            selection_model.selectionChanged.connect(lambda *_: self.selectionChanged.emit())
        selection_model = self.icon_view.selectionModel()
        if selection_model is not None:
            selection_model.selectionChanged.connect(lambda *_: self.selectionChanged.emit())

    def set_root_index(self, proxy_index) -> None:
        self.list_view.setRootIndex(proxy_index)
        self.icon_view.setRootIndex(proxy_index)

    def set_view_mode(self, mode: str) -> None:
        next_view = self.icon_view if mode == "icon" else self.list_view
        if next_view is self.active_view:
            return
        selection_model = self.active_view.selectionModel()
        selected = selection_model.selectedIndexes() if selection_model else []
        self._stack.setCurrentWidget(next_view)
        self.active_view = next_view
        if selected:
            next_selection = next_view.selectionModel()
            if next_selection is not None:
                next_selection.clear()
                for index in selected:
                    next_selection.select(index, QAbstractItemView.SelectionFlag.Select)
                next_view.setCurrentIndex(selected[0])
        self.selectionChanged.emit()

    def view_mode(self) -> str:
        return "icon" if self.active_view is self.icon_view else "list"

    def apply_sort(self, column: int, order: Qt.SortOrder) -> None:
        self.list_view.sortByColumn(column, order)

    def set_icon_sizes(self, list_size: int, grid_size: int) -> None:
        self._list_icon_size = list_size
        self._grid_icon_size = grid_size
        self.list_view.setIconSize(QSize(list_size, list_size))
        self.icon_view.setIconSize(QSize(grid_size, grid_size))

    def set_spacing(self, row_padding: int, grid_spacing: int) -> None:
        self._row_padding = row_padding
        self._grid_spacing = grid_spacing
        self.icon_view.setSpacing(grid_spacing)

    def current_index(self):
        return self.active_view.currentIndex()

    def edit(self, index) -> None:
        self.active_view.edit(index)
        self.active_view.setCurrentIndex(index)

    def set_stack_visible(self, visible: bool) -> None:
        self._stack.setVisible(visible)

    def _on_item_activated(self, index) -> None:
        self.itemActivated.emit(index)

    def _on_item_clicked(self, index) -> None:
        self.itemSingleClicked.emit(index)
