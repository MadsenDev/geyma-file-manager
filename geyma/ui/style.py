from __future__ import annotations

from geyma.utils.config import ConfigStore


def build_stylesheet(config: ConfigStore) -> str:
    row_padding = int(config.get("row_padding", 6))
    return (
        """
        QDialog {
            background-color: #0a0d12;
        }

        QMainWindow {
            background-color: #0a0d12;
        }

        /* Top chrome */
        QToolBar {
            background-color: rgba(16, 22, 32, 0.62);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 18px;
            spacing: 10px;
            padding: 10px 12px;
        }
        QToolBar#MainToolbar {
            background: qlineargradient(
                x1: 0, y1: 0, x2: 0, y2: 1,
                stop: 0 rgba(255, 255, 255, 0.06),
                stop: 1 rgba(16, 22, 32, 0.58)
            );
        }
        QToolBar::separator {
            background: rgba(255, 255, 255, 0.08);
            width: 1px;
            margin: 6px 10px;
        }

        QToolBar QToolButton {
            color: #e6edf3;
            background: rgba(15, 20, 27, 0.60);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 12px;
            padding: 6px 10px;
            min-height: 28px;
        }
        QToolBar QToolButton:hover {
            background-color: rgba(26, 36, 52, 0.70);
            border: 1px solid rgba(45, 212, 191, 0.55);
        }
        QToolBar QToolButton:pressed {
            background-color: rgba(32, 46, 66, 0.75);
        }
        QToolBar QToolButton:checked {
            background-color: rgba(16, 58, 53, 0.70);
            border: 1px solid rgba(45, 212, 191, 0.90);
            color: #e9fbf7;
            font-weight: 600;
        }
        QToolBar QLabel {
            color: #9fb3c8;
        }
        QToolBar QLineEdit {
            background-color: rgba(10, 14, 20, 0.70);
            border: 1px solid rgba(255, 255, 255, 0.08);
            padding: 7px 12px;
            min-height: 28px;
        }
        QToolBar QLineEdit:focus {
            border: 1px solid rgba(45, 212, 191, 0.85);
            background-color: rgba(12, 18, 28, 0.85);
        }

        /* Inputs */
        QComboBox, QSpinBox, QDoubleSpinBox {
            background-color: rgba(10, 14, 20, 0.78);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 6px 10px;
            color: #e6edf3;
        }
        QComboBox:focus, QSpinBox:focus, QDoubleSpinBox:focus {
            border: 1px solid rgba(45, 212, 191, 0.95);
        }
        QComboBox::drop-down {
            border: 0;
            width: 26px;
        }
        QComboBox QAbstractItemView {
            background-color: #0f141b;
            color: #e6edf3;
            border: 1px solid #253040;
            border-radius: 12px;
            padding: 6px;
            outline: 0;
        }

        QCheckBox, QRadioButton {
            color: #c7d2df;
            spacing: 8px;
        }
        QCheckBox::indicator, QRadioButton::indicator {
            width: 16px;
            height: 16px;
        }
        QCheckBox::indicator {
            border-radius: 5px;
            border: 1px solid rgba(255, 255, 255, 0.10);
            background: rgba(10, 14, 20, 0.78);
        }
        QCheckBox::indicator:checked {
            border: 1px solid rgba(45, 212, 191, 0.95);
            background: rgba(16, 58, 53, 0.75);
        }
        QRadioButton::indicator {
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.10);
            background: rgba(10, 14, 20, 0.78);
        }
        QRadioButton::indicator:checked {
            border: 1px solid rgba(45, 212, 191, 0.95);
            background: rgba(16, 58, 53, 0.75);
        }

        QLineEdit, QPlainTextEdit, QTextEdit {
            background-color: rgba(10, 14, 20, 0.78);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 6px 12px;
            color: #e6edf3;
            selection-background-color: #2dd4bf;
        }
        QLineEdit:focus, QPlainTextEdit:focus, QTextEdit:focus {
            border: 1px solid rgba(45, 212, 191, 0.95);
            background-color: rgba(12, 18, 28, 0.85);
        }

        /* Base text */
        QLabel {
            color: #c7d2df;
        }

        /* Lists / views */
        QListWidget, QTreeView, QListView, QTreeWidget {
            background-color: rgba(12, 16, 24, 0.62);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 18px;
            color: #e6edf3;
            alternate-background-color: rgba(15, 22, 32, 0.55);
            outline: 0;
        }
        QListWidget::item, QTreeWidget::item {
            padding: 8px 10px;
            margin: 2px 6px;
            border-radius: 10px;
        }
        QTreeView::item {
            padding: %dpx 10px;
        }
        QListView#IconView::item {
            padding: %dpx 10px;
        }
        QListWidget::item:selected,
        QListWidget::item:selected:active,
        QTreeWidget::item:selected,
        QTreeWidget::item:selected:active,
        QTreeView::item:selected,
        QTreeView::item:selected:active,
        QListView#IconView::item:selected,
        QListView#IconView::item:selected:active {
            background-color: rgba(23, 56, 68, 0.82);
            color: #e9fbf7;
        }
        QListWidget::item:hover,
        QTreeWidget::item:hover,
        QTreeView::item:hover,
        QListView#IconView::item:hover {
            background-color: rgba(45, 212, 191, 0.08);
        }
        QTreeView QLineEdit {
            padding: 4px 10px;
            border-radius: 10px;
        }

        QHeaderView::section {
            background-color: rgba(15, 22, 32, 0.50);
            color: #9fb3c8;
            padding: 10px 10px;
            border: 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        /* Sidebar: headers are disabled items */
        QListWidget#Sidebar::item:disabled {
            color: #7f93aa;
            margin: 10px 10px 4px 10px;
            padding: 0px;
            background: transparent;
        }
        QListWidget#Sidebar::item:disabled:selected {
            background: transparent;
        }
        QListWidget#Sidebar::item {
            padding: 6px 10px;
            margin: 1px 10px;
            border-radius: 10px;
        }
        QListWidget#Sidebar::item:selected,
        QListWidget#Sidebar::item:selected:active {
            background-color: rgba(23, 56, 68, 0.82);
            color: #e9fbf7;
        }
        QListWidget#Sidebar::item:hover {
            background-color: rgba(45, 212, 191, 0.08);
        }

        /* Buttons */
        QPushButton {
            color: #e6edf3;
            background-color: rgba(15, 20, 27, 0.60);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 999px;
            padding: 6px 14px;
        }
        QPushButton:hover {
            color: #f4faf8;
            background-color: rgba(26, 36, 52, 0.70);
            border: 1px solid rgba(45, 212, 191, 0.55);
        }
        QPushButton:pressed {
            background-color: rgba(32, 46, 66, 0.75);
        }
        QPushButton:disabled {
            color: #7f93aa;
            background-color: rgba(15, 20, 27, 0.40);
            border: 1px solid rgba(255, 255, 255, 0.05);
        }

        /* Tabs */
        QTabWidget::pane {
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 14px;
            padding: 8px;
            background: rgba(12, 17, 23, 0.55);
        }
        QTabBar::tab {
            background: rgba(15, 22, 32, 0.55);
            border: 1px solid rgba(255, 255, 255, 0.06);
            padding: 8px 12px;
            border-top-left-radius: 12px;
            border-top-right-radius: 12px;
            margin-right: 6px;
            color: #9fb3c8;
        }
        QTabBar::tab:selected {
            color: #e9fbf7;
            border: 1px solid rgba(45, 212, 191, 0.80);
            background: rgba(19, 32, 45, 0.65);
        }

        /* Grouping */
        QGroupBox {
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 16px;
            margin-top: 14px;
            padding: 10px;
            background: rgba(12, 16, 24, 0.42);
        }
        QGroupBox::title {
            subcontrol-origin: margin;
            subcontrol-position: top left;
            padding: 0 8px;
            color: #9fb3c8;
        }
        QFormLayout QLabel {
            color: #9fb3c8;
        }

        QDialogButtonBox QPushButton {
            padding: 8px 14px;
        }

        /* Menus */
        QMenu {
            background-color: rgba(15, 20, 27, 0.86);
            color: #e6edf3;
            border: 1px solid rgba(255, 255, 255, 0.07);
            border-radius: 14px;
            padding: 6px;
        }
        QMenu::item {
            padding: 8px 12px;
            border-radius: 10px;
        }
        QMenu::item:selected {
            background-color: rgba(23, 56, 68, 0.82);
        }
        QMenu::separator {
            height: 1px;
            background: rgba(255, 255, 255, 0.08);
            margin: 6px 8px;
        }

        /* Status */
        QStatusBar {
            background-color: rgba(15, 20, 27, 0.62);
            color: #c7d2df;
            padding: 8px 12px;
        }

        /* Progress */
        QProgressBar {
            background-color: rgba(12, 17, 23, 0.55);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 12px;
            text-align: center;
            color: #c7d2df;
        }
        QProgressBar::chunk {
            background-color: #2dd4bf;
            border-radius: 8px;
        }

        /* Panels */
        #InlineSearchPanel, #WorkingSetPanel, #ActivityPanel {
            background: rgba(12, 16, 24, 0.42);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 18px;
            padding: 10px;
        }

        /* Empty state */
        #EmptyState {
            background-color: rgba(12, 16, 24, 0.38);
            border: 1px dashed rgba(255, 255, 255, 0.12);
            border-radius: 20px;
            padding: 26px;
        }
        #EmptyStateIcon {
            color: #2dd4bf;
            font-size: 20px;
        }
        #EmptyStateTitle {
            color: #e6edf3;
            font-size: 16px;
            font-weight: 600;
        }
        #EmptyStateSubtitle {
            color: #9fb3c8;
            font-size: 12px;
        }

        /* Frameless title bar */
        #TitleBar {
            background-color: rgba(15, 20, 27, 0.62);
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        #TitleLabel {
            color: #e6edf3;
            font-weight: 600;
        }
        #TitleButton {
            background-color: rgba(15, 20, 27, 0.55);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 8px;
            padding: 2px 8px;
            min-width: 22px;
        }
        #TitleButton:hover {
            border: 1px solid rgba(45, 212, 191, 0.55);
        }

        #WorkingSetIndicator {
            color: #2dd4bf;
            background-color: rgba(12, 32, 32, 0.55);
            border: 1px solid rgba(45, 212, 191, 0.28);
            border-radius: 999px;
            padding: 2px 10px;
        }

        /* Scrollbars */
        QScrollBar:vertical {
            background: #0f141b;
            width: 10px;
            margin: 2px;
        }
        QScrollBar::handle:vertical {
            background: #263244;
            min-height: 24px;
            border-radius: 6px;
        }
        QScrollBar::handle:vertical:hover {
            background: #2dd4bf;
        }
        QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
            height: 0px;
        }

        QToolTip {
            background-color: rgba(15, 20, 27, 0.92);
            color: #e6edf3;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 6px 10px;
        }
        """
        % (row_padding, row_padding)
    )
