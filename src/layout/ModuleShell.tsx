import { tr } from "@/i18n";
import { useRef, type ReactNode } from "react";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { hexA } from "../theme/skins";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import { MODULE_NAMES, type ModuleId, type ZoneId } from "../state/layout";
import { isStretchModule, moduleMinWidth } from "../state/layout";
const MODULE_DRAG_TYPE = "application/x-geyma-module";
interface ModuleShellProps {
  id: ModuleId;
  zone: ZoneId;
  index: number;
  isPanel: boolean;
  onDragStart: (id: ModuleId, fromZone: ZoneId) => void;
  onDragEnd: () => void;
  children: ReactNode;
}
export function ModuleShell({
  id,
  zone,
  index,
  isPanel,
  onDragStart,
  onDragEnd,
  children
}: ModuleShellProps) {
  const t = useTheme();
  const editMode = useStore((s) => s.editMode);
  const hideModule = useStore((s) => s.hideModule);
  const moveModule = useStore((s) => s.moveModule);
  const layout = useStore((s) => s.layout);
  const centerSplit = useStore((s) => s.centerSplit);
  const openContextMenu = useStore((s) => s.openMenu);
  const openOptions = useStore((s) => s.openModMenu);
  const toggleEditMode = useStore((s) => s.toggleEditMode);
  const resetLayout = useStore((s) => s.resetLayout);
  const showModule = useStore((s) => s.showModule);
  const ref = useRef<HTMLDivElement>(null);
  const customWidth = useStore((s) => s.moduleWidths[id]);
  const stretch = isStretchModule(id);
  const sizing = moduleSizing(id, zone, stretch, customWidth);
  const openModuleMenu = (x: number, y: number) => {
    const destinations: {
      zone: ZoneId;
      label: string;
    }[] = [
    {
      zone: "top",
      label: tr("ui.module_shell.move_to_top")
    },
    {
      zone: "left",
      label: tr("ui.module_shell.move_to_left_rail")
    },
    {
      zone: "center",
      label: tr("ui.module_shell.move_to_center")
    },
    ...(centerSplit ?
    [
    {
      zone: "center2" as ZoneId,
      label: tr("ui.module_shell.move_to_lower_pane")
    }] :

    []),
    {
      zone: "right",
      label: tr("ui.module_shell.move_to_right_rail")
    },
    {
      zone: "bottom",
      label: tr("ui.module_shell.move_to_bottom")
    }];

    openContextMenu({
      x,
      y,
      items: [
      {
        label: tr("ui.module_shell.module_settings"),
        onClick: () => openOptions(id, x, y)
      },
      {
        label: editMode ?
        tr("ui.module_shell.exit_edit_mode") :
        tr("ui.module_shell.edit_layout"),
        onClick: toggleEditMode
      },
      ...(editMode ?
      destinations.
      filter((destination) => destination.zone !== zone).
      map((destination) => ({
        label: destination.label,
        onClick: () =>
        moveModule(
          id,
          destination.zone,
          layout[destination.zone].length
        )
      })) :
      []),
      {
        divider: true
      },
      {
        label: `Hide ${MODULE_NAMES[id]}`,
        danger: true,
        onClick: () => hideModule(id)
      },
      {
        divider: true
      },
      {
        label: tr("ui.module_shell.settings"),
        onClick: () => showModule("settings", "right")
      },
      {
        label: tr("ui.module_shell.reset_layout"),
        onClick: resetLayout
      }]

    });
  };
  return (
    <div
      ref={ref}
      data-mod={id}
      data-zone-index={index}
      draggable={editMode}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData(MODULE_DRAG_TYPE, id);
        onDragStart(id, zone);
      }}
      onDragEnd={onDragEnd}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openModuleMenu(e.clientX, e.clientY);
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        flex: sizing.flex,
        minHeight: stretch ?
        id === "files" || id === "files2" ?
        200 :
        140 :
        undefined,
        minWidth: sizing.minWidth,
        width: sizing.width,
        maxWidth: sizing.maxWidth,
        background: isPanel ? t.card : "transparent",
        border: isPanel ? `1px solid ${

        t.border}` :

        "none",
        borderRadius: isPanel ? t.radius : 0,
        boxShadow: editMode ? `0 0 0 1px ${hexA(t.ink, 0.08)}` : "none",
        cursor: editMode ? "grab" : "default",
        overflow: stretch ? "hidden" : "visible"
      }}>
      
      {editMode &&
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 8px",
          gap: 8,
          borderBottom: `1px solid ${
          t.border}`,

          flex: "none"
        }}>
        
          <span
          style={{
            fontFamily: t.mono,
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: ".08em",
            color: t.inkFaint,
            fontWeight: 700
          }}>
          
            {MODULE_NAMES[id]}
          </span>
          <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3
          }}>
          
            <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => openOptions(id, e.clientX, e.clientY)}
            title={tr("ui.module_shell.module_settings")}
            style={iconBtnStyle(t.inkFaint)}>
            
              <Icon d={ICONS.gear} size={13} />
            </button>
            <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => hideModule(id)}
            title={tr("ui.module_shell.hide_module")}
            style={iconBtnStyle(t.inkFaint)}>
            
              <Icon d={ICONS.close} size={13} />
            </button>
          </span>
        </div>
      }
      <div
        style={{
          flex: stretch ? "1 1 0" : "none",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: stretch ? "auto" : "visible"
        }}>
        
        {children}
      </div>
    </div>);

}
function moduleSizing(
id: ModuleId,
zone: ZoneId,
stretch: boolean,
customWidth?: number)
: Pick<React.CSSProperties, "flex" | "minWidth" | "width" | "maxWidth"> {
  if ((zone === "top" || zone === "bottom") && customWidth != null) {
    return {
      flex: "0 0 auto",
      width: customWidth,
      minWidth: moduleMinWidth(id)
    };
  }
  if (stretch)
  return {
    flex: "1 1 0",
    minWidth: 0
  };
  if (zone === "top" || zone === "bottom") {
    if (id === "location")
    return {
      flex: "1 1 280px",
      minWidth: 180,
      maxWidth: 520
    };
    if (id === "search")
    return {
      flex: "0 0 clamp(220px, 28vw, 360px)",
      minWidth: 220
    };
    if (id === "nav")
    return {
      flex: "0 0 112px",
      width: 112,
      minWidth: 112
    };
    if (id === "viewswitch")
    return {
      flex: "0 0 auto",
      minWidth: 160
    };
    if (id === "tabs")
    return {
      flex: "0 1 360px",
      minWidth: 180,
      maxWidth: 440
    };
  }
  return {
    flex: "none",
    minWidth: 0
  };
}
function iconBtnStyle(color: string): React.CSSProperties {
  return {
    width: 20,
    height: 20,
    display: "grid",
    placeItems: "center",
    border: 0,
    background: "transparent",
    borderRadius: 5,
    color,
    cursor: "pointer",
    padding: 0
  };
}