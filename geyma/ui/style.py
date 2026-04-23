from __future__ import annotations

from dataclasses import dataclass

from geyma.utils.config import ConfigStore


def _rgba(rgb: tuple[int, int, int], alpha: float) -> str:
    r, g, b = rgb
    a = f"{alpha:.2f}".rstrip("0").rstrip(".")
    return f"rgba({r}, {g}, {b}, {a})"


@dataclass(frozen=True)
class ThemeTokens:
    bg: str = "#11161c"
    panel: str = "#171d24"
    panel_alt: str = "#1b232c"
    text: str = "#edf2f7"
    text_muted: str = "#aab6c3"
    text_disabled: str = "#728091"
    chrome_rgb: tuple[int, int, int] = (23, 29, 36)
    surface_rgb: tuple[int, int, int] = (18, 23, 30)
    surface2_rgb: tuple[int, int, int] = (25, 33, 42)
    border_rgb: tuple[int, int, int] = (255, 255, 255)
    accent_rgb: tuple[int, int, int] = (100, 166, 255)
    selection_rgb: tuple[int, int, int] = (39, 75, 116)
    accent: str = "#64a6ff"
    r_sm: int = 6
    r_md: int = 8
    r_lg: int = 10
    r_xl: int = 14
    r_pill: int = 999


def _qss(tokens: ThemeTokens, *, row_padding: int) -> str:
    chrome = _rgba(tokens.chrome_rgb, 1.0)
    chrome_soft = _rgba(tokens.chrome_rgb, 0.96)
    chrome_menu = _rgba(tokens.chrome_rgb, 0.99)
    surface = _rgba(tokens.surface_rgb, 1.0)
    surface_soft = _rgba(tokens.surface_rgb, 0.9)
    surface_softer = _rgba(tokens.surface2_rgb, 0.72)
    border_subtle = _rgba(tokens.border_rgb, 0.08)
    border_input = _rgba(tokens.border_rgb, 0.12)
    border_focus = _rgba(tokens.accent_rgb, 0.95)
    hover_bg = _rgba(tokens.accent_rgb, 0.10)
    selected_bg = _rgba(tokens.selection_rgb, 0.88)
    selected_bg_strong = _rgba(tokens.selection_rgb, 0.96)
    checked_bg = _rgba(tokens.accent_rgb, 0.30)
    checked_border = _rgba(tokens.accent_rgb, 0.8)
    button_bg = _rgba(tokens.surface2_rgb, 0.88)
    button_hover_bg = _rgba(tokens.surface2_rgb, 1.0)
    button_pressed_bg = _rgba(tokens.selection_rgb, 0.9)
    button_disabled_bg = _rgba(tokens.chrome_rgb, 0.7)

    return f"""
        QDialog {{
            background-color: {tokens.bg};
        }}

        QMainWindow {{
            background-color: {tokens.bg};
        }}

        QToolBar {{
            background-color: {chrome};
            border: 1px solid {border_subtle};
            border-radius: {tokens.r_md}px;
            spacing: 8px;
            padding: 8px 10px;
        }}
        QToolBar#MainToolbar {{
            background-color: {chrome};
        }}
        QToolBar::separator {{
            background: {_rgba(tokens.border_rgb, 0.08)};
            width: 1px;
            margin: 4px 8px;
        }}

        QToolBar QToolButton {{
            color: {tokens.text};
            background: {button_bg};
            border: 1px solid {border_subtle};
            border-radius: {tokens.r_sm}px;
            padding: 5px 10px;
            min-height: 26px;
        }}
        QToolBar QToolButton:hover {{
            background-color: {button_hover_bg};
            border: 1px solid {_rgba(tokens.border_rgb, 0.16)};
        }}
        QToolBar QToolButton:pressed {{
            background-color: {button_pressed_bg};
        }}
        QToolBar QToolButton:checked {{
            background-color: {selected_bg};
            border: 1px solid {_rgba(tokens.accent_rgb, 0.70)};
            font-weight: 600;
        }}
        QToolBar QLabel {{
            color: {tokens.text_muted};
        }}
        QToolBar QLineEdit {{
            background-color: {_rgba((13, 17, 23), 1.0)};
            border: 1px solid {border_input};
            border-radius: {tokens.r_sm}px;
            padding: 6px 10px;
            min-height: 26px;
        }}
        QToolBar QLineEdit:focus {{
            border: 1px solid {border_focus};
        }}

        QComboBox, QSpinBox, QDoubleSpinBox {{
            background-color: {_rgba((13, 17, 23), 1.0)};
            border: 1px solid {border_input};
            border-radius: {tokens.r_sm}px;
            padding: 5px 8px;
            color: {tokens.text};
        }}
        QComboBox:focus, QSpinBox:focus, QDoubleSpinBox:focus {{
            border: 1px solid {border_focus};
        }}
        QComboBox::drop-down {{
            border: 0;
            width: 26px;
        }}
        QComboBox QAbstractItemView {{
            background-color: {tokens.panel};
            color: {tokens.text};
            border: 1px solid {border_input};
            border-radius: {tokens.r_sm}px;
            padding: 4px;
            outline: 0;
        }}

        QCheckBox, QRadioButton {{
            color: {tokens.text_muted};
            spacing: 6px;
        }}
        QCheckBox::indicator, QRadioButton::indicator {{
            width: 16px;
            height: 16px;
        }}
        QCheckBox::indicator {{
            border-radius: 4px;
            border: 1px solid {border_input};
            background: {_rgba((13, 17, 23), 1.0)};
        }}
        QCheckBox::indicator:checked {{
            border: 1px solid {checked_border};
            background: {checked_bg};
            image: url(:/qt-project.org/styles/commonstyle/images/checkbox_checked.png);
        }}
        QCheckBox::indicator:unchecked {{
            image: none;
        }}
        QRadioButton::indicator {{
            border-radius: 8px;
            border: 1px solid {border_input};
            background: {_rgba((13, 17, 23), 1.0)};
        }}
        QRadioButton::indicator:checked {{
            border: 1px solid {checked_border};
            background: {checked_bg};
            image: url(:/qt-project.org/styles/commonstyle/images/radiobutton_checked.png);
        }}
        QRadioButton::indicator:unchecked {{
            image: none;
        }}

        QLineEdit, QPlainTextEdit, QTextEdit {{
            background-color: {_rgba((13, 17, 23), 1.0)};
            border: 1px solid {border_input};
            border-radius: {tokens.r_sm}px;
            padding: 6px 10px;
            color: {tokens.text};
            selection-background-color: {tokens.accent};
        }}
        QLineEdit:focus, QPlainTextEdit:focus, QTextEdit:focus {{
            border: 1px solid {border_focus};
        }}

        QLabel {{
            color: {tokens.text_muted};
        }}

        QListWidget, QTreeView, QListView, QTreeWidget {{
            background-color: {surface};
            border: 1px solid {border_subtle};
            border-radius: {tokens.r_md}px;
            color: {tokens.text};
            alternate-background-color: {_rgba(tokens.surface2_rgb, 0.65)};
            outline: 0;
        }}
        QTreeView::item {{
            padding: {row_padding}px 8px;
        }}
        QListView#IconView::item {{
            padding: {row_padding}px 8px;
        }}
        QTreeWidget::item:selected,
        QTreeWidget::item:selected:active,
        QTreeView::item:selected,
        QTreeView::item:selected:active,
        QListView#IconView::item:selected,
        QListView#IconView::item:selected:active {{
            background-color: {selected_bg};
            color: {tokens.text};
        }}
        QTreeWidget::item:hover,
        QTreeView::item:hover,
        QListView#IconView::item:hover {{
            background-color: {hover_bg};
        }}
        QTreeView QLineEdit {{
            padding: 3px 8px;
        }}

        QHeaderView::section {{
            background-color: {_rgba(tokens.surface2_rgb, 0.78)};
            color: {tokens.text_muted};
            padding: 8px 8px;
            border: 0;
            border-bottom: 1px solid {border_subtle};
        }}

        QTreeWidget#Sidebar {{
            background-color: {tokens.panel};
        }}
        QTreeWidget#Sidebar::item {{
            padding: 6px 6px;
            border-radius: {tokens.r_sm}px;
        }}
        QTreeWidget#Sidebar::item:selected,
        QTreeWidget#Sidebar::item:selected:active {{
            background-color: {selected_bg};
        }}
        QTreeWidget#Sidebar::item:hover {{
            background-color: {hover_bg};
        }}
        QTreeWidget#Sidebar::branch {{
            background: transparent;
        }}

        QListWidget#SettingsNav {{
            padding: 8px;
        }}
        QListWidget#SettingsNav::item {{
            padding: 6px 8px;
            margin: 1px 0px;
            border-radius: {tokens.r_sm}px;
        }}
        QListWidget#SettingsNav::item:hover:!selected {{
            background-color: {hover_bg};
        }}
        QListWidget#SettingsNav::item:selected,
        QListWidget#SettingsNav::item:selected:active {{
            background-color: {selected_bg};
            border: 1px solid {_rgba(tokens.accent_rgb, 0.4)};
        }}
        QListWidget#SettingsNav::item:selected:hover {{
            background-color: {selected_bg_strong};
        }}

        QPushButton {{
            color: {tokens.text};
            background-color: {button_bg};
            border: 1px solid {border_subtle};
            border-radius: {tokens.r_sm}px;
            padding: 6px 12px;
        }}
        QPushButton:hover {{
            background-color: {button_hover_bg};
            border: 1px solid {_rgba(tokens.border_rgb, 0.16)};
        }}
        QPushButton:pressed {{
            background-color: {button_pressed_bg};
        }}
        QPushButton:disabled {{
            color: {tokens.text_disabled};
            background-color: {button_disabled_bg};
            border: 1px solid {_rgba(tokens.border_rgb, 0.04)};
        }}

        QTabWidget::pane {{
            border: 1px solid {border_subtle};
            border-radius: {tokens.r_md}px;
            padding: 8px;
            background: {surface_soft};
        }}
        QTabBar::tab {{
            background: {_rgba(tokens.surface2_rgb, 0.78)};
            border: 1px solid {border_subtle};
            padding: 8px 12px;
            border-top-left-radius: {tokens.r_sm}px;
            border-top-right-radius: {tokens.r_sm}px;
            margin-right: 6px;
            color: {tokens.text_muted};
        }}
        QTabBar::tab:selected {{
            border: 1px solid {_rgba(tokens.accent_rgb, 0.50)};
            background: {selected_bg};
        }}

        QGroupBox {{
            border: 1px solid {border_subtle};
            border-radius: {tokens.r_md}px;
            margin-top: 12px;
            padding: 10px;
            background: {surface_soft};
        }}
        QGroupBox::title {{
            subcontrol-origin: margin;
            subcontrol-position: top left;
            padding: 0 8px;
            color: {tokens.text_muted};
        }}

        QDialogButtonBox QPushButton {{
            padding: 8px 14px;
        }}

        QMenu {{
            background-color: {chrome_menu};
            color: {tokens.text};
            border: 1px solid {_rgba(tokens.border_rgb, 0.08)};
            border-radius: {tokens.r_sm}px;
            padding: 4px;
        }}
        QMenu::item {{
            padding: 7px 10px;
            border-radius: {tokens.r_sm}px;
        }}
        QMenu::item:selected {{
            background-color: {selected_bg};
        }}
        QMenu::separator {{
            height: 1px;
            background: {_rgba(tokens.border_rgb, 0.08)};
            margin: 6px 8px;
        }}

        QStatusBar {{
            background-color: {chrome};
            color: {tokens.text_muted};
            padding: 6px 10px;
        }}

        QProgressBar {{
            background-color: {_rgba((13, 17, 23), 1.0)};
            border: 1px solid {border_subtle};
            border-radius: {tokens.r_sm}px;
            text-align: center;
            color: {tokens.text_muted};
        }}
        QProgressBar::chunk {{
            background-color: {tokens.accent};
            border-radius: {tokens.r_sm}px;
        }}

        #InlineSearchPanel, #WorkingSetPanel, #ActivityPanel {{
            background: {surface_soft};
            border: 1px solid {border_subtle};
            border-radius: {tokens.r_md}px;
            padding: 8px;
        }}

        #EmptyState {{
            background-color: {surface_softer};
            border: 1px dashed {_rgba(tokens.border_rgb, 0.12)};
            border-radius: {tokens.r_lg}px;
            padding: 22px;
        }}
        #EmptyStateIcon {{
            color: {tokens.accent};
            font-size: 18px;
        }}
        #EmptyStateTitle {{
            color: {tokens.text};
            font-weight: 600;
        }}
        #EmptyStateSubtitle {{
            color: {tokens.text_muted};
        }}

        #TitleBar {{
            background-color: {chrome};
            border-bottom: 1px solid {border_subtle};
        }}
        #TitleLabel {{
            color: {tokens.text};
            font-weight: 600;
        }}
        #TitleButton {{
            background-color: {chrome_soft};
            border: 1px solid {border_subtle};
            border-radius: {tokens.r_sm}px;
            padding: 2px 8px;
            min-width: 22px;
        }}
        #TitleButton:hover {{
            border: 1px solid {_rgba(tokens.border_rgb, 0.16)};
        }}

        #WorkingSetIndicator {{
            color: {tokens.accent};
            background-color: {_rgba(tokens.selection_rgb, 0.5)};
            border: 1px solid {_rgba(tokens.accent_rgb, 0.3)};
            border-radius: {tokens.r_pill}px;
            padding: 2px 10px;
        }}

        QScrollBar:vertical {{
            background: transparent;
            width: 10px;
            margin: 2px;
        }}
        QScrollBar::handle:vertical {{
            background: #334252;
            min-height: 24px;
            border-radius: 6px;
        }}
        QScrollBar::handle:vertical:hover {{
            background: {tokens.accent};
        }}
        QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
            height: 0px;
        }}

        QToolTip {{
            background-color: {chrome_menu};
            color: {tokens.text};
            border: 1px solid {border_input};
            border-radius: {tokens.r_sm}px;
            padding: 5px 8px;
        }}
    """


def build_stylesheet(config: ConfigStore) -> str:
    row_padding = int(config.get("row_padding", 6))
    tokens = ThemeTokens()
    return _qss(tokens, row_padding=row_padding)
