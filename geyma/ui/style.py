from __future__ import annotations

from dataclasses import dataclass

from geyma.utils.config import ConfigStore


def _rgba(rgb: tuple[int, int, int], alpha: float) -> str:
    r, g, b = rgb
    a = f"{alpha:.2f}".rstrip("0").rstrip(".")
    return f"rgba({r}, {g}, {b}, {a})"


@dataclass(frozen=True)
class ThemeTokens:
    # Core colors
    bg: str = "#0a0d12"
    text: str = "#e6edf3"
    text_muted: str = "#9fb3c8"
    text_subtle: str = "#c7d2df"
    text_disabled: str = "#7f93aa"

    # RGB anchors (used for alpha blending)
    chrome_rgb: tuple[int, int, int] = (15, 20, 27)
    surface_rgb: tuple[int, int, int] = (12, 16, 24)
    surface2_rgb: tuple[int, int, int] = (15, 22, 32)
    border_rgb: tuple[int, int, int] = (255, 255, 255)
    accent_rgb: tuple[int, int, int] = (45, 212, 191)
    selection_rgb: tuple[int, int, int] = (23, 56, 68)

    # Accents
    accent: str = "#2dd4bf"

    # Radii
    r_sm: int = 10
    r_md: int = 12
    r_lg: int = 18
    r_xl: int = 20
    r_pill: int = 999


def _qss(tokens: ThemeTokens, *, row_padding: int) -> str:
    # Surfaces
    chrome = _rgba(tokens.chrome_rgb, 0.62)
    chrome_soft = _rgba(tokens.chrome_rgb, 0.55)
    chrome_menu = _rgba(tokens.chrome_rgb, 0.86)
    surface = _rgba(tokens.surface_rgb, 0.62)
    surface_soft = _rgba(tokens.surface_rgb, 0.42)
    surface_softer = _rgba(tokens.surface_rgb, 0.38)
    surface_panel = _rgba(tokens.surface2_rgb, 0.58)

    # Borders & states
    border_subtle = _rgba(tokens.border_rgb, 0.06)
    border_input = _rgba(tokens.border_rgb, 0.08)
    border_focus = _rgba(tokens.accent_rgb, 0.95)
    hover_bg = _rgba(tokens.accent_rgb, 0.08)
    selected_bg = _rgba(tokens.selection_rgb, 0.82)
    selected_bg_strong = _rgba(tokens.selection_rgb, 0.92)
    checked_bg = _rgba((16, 58, 53), 0.75)
    checked_border = _rgba(tokens.accent_rgb, 0.95)

    # Buttons
    button_bg = _rgba(tokens.chrome_rgb, 0.60)
    button_hover_bg = _rgba((26, 36, 52), 0.70)
    button_pressed_bg = _rgba((32, 46, 66), 0.75)
    button_disabled_bg = _rgba(tokens.chrome_rgb, 0.40)

    return f"""
        QDialog {{
            background-color: {tokens.bg};
        }}

        QMainWindow {{
            background-color: {tokens.bg};
        }}

        /* Top chrome */
        QToolBar {{
            background-color: {chrome};
            border: 1px solid {border_subtle};
            border-radius: {tokens.r_lg}px;
            spacing: 10px;
            padding: 10px 12px;
        }}
        QToolBar#MainToolbar {{
            background: qlineargradient(
                x1: 0, y1: 0, x2: 0, y2: 1,
                stop: 0 {_rgba(tokens.border_rgb, 0.06)},
                stop: 1 {surface_panel}
            );
        }}
        QToolBar::separator {{
            background: {_rgba(tokens.border_rgb, 0.08)};
            width: 1px;
            margin: 6px 10px;
        }}

        QToolBar QToolButton {{
            color: {tokens.text};
            background: {button_bg};
            border: 1px solid {border_subtle};
            border-radius: {tokens.r_md}px;
            padding: 6px 10px;
            min-height: 28px;
        }}
        QToolBar QToolButton:hover {{
            background-color: {button_hover_bg};
            border: 1px solid {_rgba(tokens.accent_rgb, 0.55)};
        }}
        QToolBar QToolButton:pressed {{
            background-color: {button_pressed_bg};
        }}
        QToolBar QToolButton:checked {{
            background-color: {_rgba((16, 58, 53), 0.70)};
            border: 1px solid {_rgba(tokens.accent_rgb, 0.90)};
            color: #e9fbf7;
            font-weight: 600;
        }}
        QToolBar QLabel {{
            color: {tokens.text_muted};
        }}
        QToolBar QLineEdit {{
            background-color: {_rgba((10, 14, 20), 0.70)};
            border: 1px solid {border_input};
            padding: 7px 12px;
            min-height: 28px;
        }}
        QToolBar QLineEdit:focus {{
            border: 1px solid {_rgba(tokens.accent_rgb, 0.85)};
            background-color: {_rgba((12, 18, 28), 0.85)};
        }}

        /* Inputs */
        QComboBox, QSpinBox, QDoubleSpinBox {{
            background-color: {_rgba((10, 14, 20), 0.78)};
            border: 1px solid {border_input};
            border-radius: {tokens.r_md}px;
            padding: 6px 10px;
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
            background-color: #0f141b;
            color: {tokens.text};
            border: 1px solid #253040;
            border-radius: {tokens.r_md}px;
            padding: 6px;
            outline: 0;
        }}

        QCheckBox, QRadioButton {{
            color: {tokens.text_subtle};
            spacing: 8px;
        }}
        QCheckBox::indicator, QRadioButton::indicator {{
            width: 16px;
            height: 16px;
        }}
        QCheckBox::indicator {{
            border-radius: 5px;
            border: 1px solid {_rgba(tokens.border_rgb, 0.10)};
            background: {_rgba((10, 14, 20), 0.78)};
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
            border: 1px solid {_rgba(tokens.border_rgb, 0.10)};
            background: {_rgba((10, 14, 20), 0.78)};
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
            background-color: {_rgba((10, 14, 20), 0.78)};
            border: 1px solid {border_input};
            border-radius: {tokens.r_md}px;
            padding: 6px 12px;
            color: {tokens.text};
            selection-background-color: {tokens.accent};
        }}
        QLineEdit:focus, QPlainTextEdit:focus, QTextEdit:focus {{
            border: 1px solid {border_focus};
            background-color: {_rgba((12, 18, 28), 0.85)};
        }}

        /* Base text */
        QLabel {{
            color: {tokens.text_subtle};
        }}

        /* Lists / views */
        QListWidget, QTreeView, QListView, QTreeWidget {{
            background-color: {surface};
            border: 1px solid {border_subtle};
            border-radius: {tokens.r_lg}px;
            color: {tokens.text};
            alternate-background-color: {_rgba(tokens.surface2_rgb, 0.55)};
            outline: 0;
        }}
        QListWidget::item, QTreeWidget::item {{
            padding: 8px 10px;
            margin: 2px 6px;
            border-radius: {tokens.r_sm}px;
        }}
        QTreeView::item {{
            padding: {row_padding}px 10px;
        }}
        QListView#IconView::item {{
            padding: {row_padding}px 10px;
        }}
        QListWidget::item:selected,
        QListWidget::item:selected:active,
        QTreeWidget::item:selected,
        QTreeWidget::item:selected:active,
        QTreeView::item:selected,
        QTreeView::item:selected:active,
        QListView#IconView::item:selected,
        QListView#IconView::item:selected:active {{
            background-color: {selected_bg};
            color: #e9fbf7;
        }}
        QListWidget::item:hover,
        QTreeWidget::item:hover,
        QTreeView::item:hover,
        QListView#IconView::item:hover {{
            background-color: {hover_bg};
        }}
        QTreeView QLineEdit {{
            padding: 4px 10px;
            border-radius: {tokens.r_sm}px;
        }}

        QHeaderView::section {{
            background-color: {_rgba(tokens.surface2_rgb, 0.50)};
            color: {tokens.text_muted};
            padding: 10px 10px;
            border: 0;
            border-bottom: 1px solid {border_subtle};
        }}

        /* Sidebar: headers are disabled items */
        QListWidget#Sidebar::item:disabled {{
            color: {tokens.text_disabled};
            margin: 10px 10px 4px 10px;
            padding: 0px;
            background: transparent;
        }}
        QListWidget#Sidebar::item:disabled:selected {{
            background: transparent;
        }}
        QListWidget#Sidebar::item {{
            padding: 6px 10px;
            margin: 1px 10px;
            border-radius: {tokens.r_sm}px;
        }}
        QListWidget#Sidebar::item:selected,
        QListWidget#Sidebar::item:selected:active {{
            background-color: {selected_bg};
            color: #e9fbf7;
        }}
        QListWidget#Sidebar::item:hover {{
            background-color: {hover_bg};
        }}

        /* Settings nav */
        QListWidget#SettingsNav {{
            padding: 10px;
        }}
        QListWidget#SettingsNav::item {{
            padding: 6px 10px;
            margin: 1px 0px;
            border-radius: {tokens.r_sm}px;
        }}
        QListWidget#SettingsNav::item:hover:!selected {{
            background-color: {hover_bg};
        }}
        QListWidget#SettingsNav::item:selected,
        QListWidget#SettingsNav::item:selected:active {{
            background-color: {selected_bg};
            border: 1px solid {_rgba(tokens.accent_rgb, 0.55)};
            color: #e9fbf7;
        }}
        QListWidget#SettingsNav::item:selected:hover {{
            background-color: {selected_bg_strong};
        }}

        /* Buttons */
        QPushButton {{
            color: {tokens.text};
            background-color: {button_bg};
            border: 1px solid {border_subtle};
            border-radius: {tokens.r_pill}px;
            padding: 6px 14px;
        }}
        QPushButton:hover {{
            color: #f4faf8;
            background-color: {button_hover_bg};
            border: 1px solid {_rgba(tokens.accent_rgb, 0.55)};
        }}
        QPushButton:pressed {{
            background-color: {button_pressed_bg};
        }}
        QPushButton:disabled {{
            color: {tokens.text_disabled};
            background-color: {button_disabled_bg};
            border: 1px solid {_rgba(tokens.border_rgb, 0.05)};
        }}

        /* Tabs */
        QTabWidget::pane {{
            border: 1px solid {border_subtle};
            border-radius: 14px;
            padding: 8px;
            background: {_rgba((12, 17, 23), 0.55)};
        }}
        QTabBar::tab {{
            background: {_rgba(tokens.surface2_rgb, 0.55)};
            border: 1px solid {border_subtle};
            padding: 8px 12px;
            border-top-left-radius: {tokens.r_md}px;
            border-top-right-radius: {tokens.r_md}px;
            margin-right: 6px;
            color: {tokens.text_muted};
        }}
        QTabBar::tab:selected {{
            color: #e9fbf7;
            border: 1px solid {_rgba(tokens.accent_rgb, 0.80)};
            background: {_rgba((19, 32, 45), 0.65)};
        }}

        /* Grouping */
        QGroupBox {{
            border: 1px solid {border_subtle};
            border-radius: 16px;
            margin-top: 14px;
            padding: 10px;
            background: {surface_soft};
        }}
        QGroupBox::title {{
            subcontrol-origin: margin;
            subcontrol-position: top left;
            padding: 0 8px;
            color: {tokens.text_muted};
        }}
        QFormLayout QLabel {{
            color: {tokens.text_muted};
        }}

        QDialogButtonBox QPushButton {{
            padding: 8px 14px;
        }}

        /* Menus */
        QMenu {{
            background-color: {chrome_menu};
            color: {tokens.text};
            border: 1px solid {_rgba(tokens.border_rgb, 0.07)};
            border-radius: 14px;
            padding: 6px;
        }}
        QMenu::item {{
            padding: 8px 12px;
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

        /* Status */
        QStatusBar {{
            background-color: {chrome};
            color: {tokens.text_subtle};
            padding: 8px 12px;
        }}

        /* Progress */
        QProgressBar {{
            background-color: {_rgba((12, 17, 23), 0.55)};
            border: 1px solid {border_subtle};
            border-radius: {tokens.r_md}px;
            text-align: center;
            color: {tokens.text_subtle};
        }}
        QProgressBar::chunk {{
            background-color: {tokens.accent};
            border-radius: 8px;
        }}

        /* Panels */
        #InlineSearchPanel, #WorkingSetPanel, #ActivityPanel {{
            background: {surface_soft};
            border: 1px solid {border_subtle};
            border-radius: {tokens.r_lg}px;
            padding: 10px;
        }}

        /* Empty state */
        #EmptyState {{
            background-color: {surface_softer};
            border: 1px dashed {_rgba(tokens.border_rgb, 0.12)};
            border-radius: {tokens.r_xl}px;
            padding: 26px;
        }}
        #EmptyStateIcon {{
            color: {tokens.accent};
            font-size: 20px;
        }}
        #EmptyStateTitle {{
            color: {tokens.text};
            font-size: 16px;
            font-weight: 600;
        }}
        #EmptyStateSubtitle {{
            color: {tokens.text_muted};
            font-size: 12px;
        }}

        /* Frameless title bar */
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
            border-radius: 8px;
            padding: 2px 8px;
            min-width: 22px;
        }}
        #TitleButton:hover {{
            border: 1px solid {_rgba(tokens.accent_rgb, 0.55)};
        }}

        #WorkingSetIndicator {{
            color: {tokens.accent};
            background-color: {_rgba((12, 32, 32), 0.55)};
            border: 1px solid {_rgba(tokens.accent_rgb, 0.28)};
            border-radius: {tokens.r_pill}px;
            padding: 2px 10px;
        }}

        /* Scrollbars (minimal) */
        QScrollBar:vertical {{
            background: transparent;
            width: 10px;
            margin: 2px;
        }}
        QScrollBar::handle:vertical {{
            background: #263244;
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
            background-color: {_rgba(tokens.chrome_rgb, 0.92)};
            color: {tokens.text};
            border: 1px solid {border_input};
            border-radius: {tokens.r_md}px;
            padding: 6px 10px;
        }}
    """


def build_stylesheet(config: ConfigStore) -> str:
    row_padding = int(config.get("row_padding", 6))
    tokens = ThemeTokens()
    return _qss(tokens, row_padding=row_padding)
