import { tr } from "@/i18n";
import { useEffect, useState } from "react";
import { useStore, smbDeviceKey } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { DANGER } from "../theme/skins";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import { navItemStyle, panelTitleStyle, iconButtonStyle } from "./common";
import type { RemoteConnection, RemoteStatus } from "../state/types";
import type { SmbDevice } from "../fs/types";
import { ConnectionModal } from "../overlays/ConnectionModal";
import { SmbBrowseModal } from "../overlays/SmbBrowseModal";
function rootPathFor(conn: RemoteConnection): string {
  if (conn.protocol === "sftp")
  return `sftp://${
  conn.username}@${
  conn.host}:${
  conn.port}/`;

  return `smb://${conn.username}@${conn.host}:${conn.port}/${conn.share ?? ""}`;
}
function statusColor(
t: ReturnType<typeof useTheme>,
status: RemoteStatus)
: string {
  switch (status) {
    case "connected":
      return "#3FA75C";
    case "connecting":
      return "#D89B2B";
    case "error":
      return "#C24444";
    default:
      return t.inkFaint;
  }
}
function statusLabel(status: RemoteStatus): string {
  switch (status) {
    case "connected":
      return tr("ui.network.connected");
    case "connecting":
      return tr("ui.network.connecting");
    case "error":
      return tr("ui.network.connection_failed");
    default:
      return tr("ui.network.disconnected");
  }
}
export function Network() {
  const t = useTheme();
  const connections = useStore((s) => s.remoteConnections);
  const status = useStore((s) => s.remoteStatus);
  const path = useStore((s) => s.path);
  const connectRemoteConnection = useStore((s) => s.connectRemoteConnection);
  const disconnectRemoteConnection = useStore(
    (s) => s.disconnectRemoteConnection
  );
  const removeRemoteConnection = useStore((s) => s.removeRemoteConnection);
  const goPath = useStore((s) => s.goPath);
  const newTab = useStore((s) => s.newTab);
  const openMenu = useStore((s) => s.openMenu);
  const showToast = useStore((s) => s.showToast);
  const [modalTarget, setModalTarget] = useState<
    RemoteConnection | "new" | null>(
    null);
  const smbDevices = useStore((s) => s.smbDevices);
  const smbScan = useStore((s) => s.smbScan);
  const smbShares = useStore((s) => s.smbShares);
  const discoverSmbDevices = useStore((s) => s.discoverSmbDevices);
  const forgetSmbShares = useStore((s) => s.forgetSmbShares);
  const connectDiscoveredShare = useStore((s) => s.connectDiscoveredShare);
  const [expandedDevices, setExpandedDevices] = useState<
    Record<string, boolean>>(
    {});
  const [browseTarget, setBrowseTarget] = useState<SmbDevice | null>(null);
  // First time the panel shows up, kick off a scan so devices just appear.
  useEffect(() => {
    if (useStore.getState().smbScan === "idle") void discoverSmbDevices();
  }, [discoverSmbDevices]);
  function toggleDevice(device: SmbDevice) {
    const key = smbDeviceKey(device);
    const open = !expandedDevices[key];
    setExpandedDevices({ ...expandedDevices, [key]: open });
    if (open && !smbShares[key]) setBrowseTarget(device);
  }
  function deviceMenu(device: SmbDevice, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    openMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
      {
        label: tr("ui.network.sign_in_as_different_user"),
        onClick: () => {
          forgetSmbShares(device);
          setExpandedDevices((prev) => ({ ...prev, [smbDeviceKey(device)]: true }));
          setBrowseTarget(device);
        }
      },
      {
        label: tr("ui.network.copy_address"),
        onClick: () => {
          void navigator.clipboard.writeText(device.hostname);
          showToast(tr("ui.network.address_copied"));
        }
      }]
    });
  }
  function handleClick(conn: RemoteConnection) {
    const st = status[conn.id] ?? "disconnected";
    if (st === "connected") goPath(rootPathFor(conn));else
    if (st !== "connecting") void connectRemoteConnection(conn.id);
  }
  function itemMenu(conn: RemoteConnection, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const st = status[conn.id] ?? "disconnected";
    openMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
      st === "connected" ?
      {
        label: tr("ui.network.open_in_new_tab"),
        onClick: () => newTab(rootPathFor(conn))
      } :
      {
        label: tr("ui.network.connect"),
        onClick: () => void connectRemoteConnection(conn.id)
      },
      st === "connected" ?
      {
        label: tr("ui.network.disconnect"),
        onClick: () => void disconnectRemoteConnection(conn.id)
      } :
      undefined,
      {
        divider: true
      },
      {
        label: tr("ui.network.edit_connection"),
        onClick: () => setModalTarget(conn)
      },
      {
        label: tr("ui.network.copy_root_path"),
        onClick: () => {
          void navigator.clipboard.writeText(rootPathFor(conn));
          showToast(tr("ui.network.path_copied"));
        }
      },
      {
        divider: true
      },
      {
        label: tr("ui.network.forget_connection"),
        danger: true,
        onClick: () => removeRemoteConnection(conn.id)
      }].
      filter(Boolean) as {
        label: string;
        onClick?: () => void;
        danger?: boolean;
        divider?: boolean;
      }[]
    });
  }
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
        
        <div style={panelTitleStyle(t)}>{tr("ui.network.network")}</div>
        <button
          onClick={() => setModalTarget("new")}
          title={tr("ui.network.add_connection")}
          className="gy-soft"
          style={{
            ...iconButtonStyle(t),
            width: 24,
            height: 24,
            marginRight: 6
          }}>
          
          <Icon d={ICONS.plus} size={13} />
        </button>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          padding: "0 6px 8px"
        }}>
        
        {connections.map((conn) => {
          const st = status[conn.id] ?? "disconnected";
          const active =
          st === "connected" &&
          path.startsWith(`${

          conn.protocol}://${
          conn.username}@${
          conn.host}:${
          conn.port}`

          );
          return (
            <button
              key={conn.id}
              className="gy-item"
              onClick={() => handleClick(conn)}
              onContextMenu={(e) => itemMenu(conn, e)}
              title={statusLabel(st)}
              style={navItemStyle(t, active, false)}>
              
              <Icon d={ICONS.network} size={15} />
              <span
                style={{
                  flex: 1,
                  textAlign: "left",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}>
                
                {conn.label}
              </span>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 99,
                  background: statusColor(t, st),
                  flex: "none"
                }} />
              
            </button>);

        })}
        {connections.length === 0 &&
        <div
          style={{
            padding: "6px 9px",
            fontSize: 11.5,
            color: t.inkFaint
          }}>

            {tr("ui.network.no_saved_connections")}
          </div>
        }
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>

        <div style={panelTitleStyle(t)}>{tr("ui.network.devices")}</div>
        <button
          onClick={() => void discoverSmbDevices()}
          title={tr("ui.network.scan_for_devices")}
          className="gy-soft"
          disabled={smbScan === "scanning"}
          style={{
            ...iconButtonStyle(t),
            width: 24,
            height: 24,
            marginRight: 6,
            opacity: smbScan === "scanning" ? 0.5 : 1
          }}>

          <Icon d={ICONS.refresh} size={13} />
        </button>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          padding: "0 6px 8px"
        }}>

        {smbDevices.map((device) => {
          const key = smbDeviceKey(device);
          const open = !!expandedDevices[key];
          const listing = smbShares[key];
          return (
            <div key={key}>
              <button
                className="gy-item"
                onClick={() => toggleDevice(device)}
                onContextMenu={(e) => deviceMenu(device, e)}
                title={device.hostname}
                style={navItemStyle(t, false, false)}>

                <Icon d={open ? ICONS.chevronDown : ICONS.chevronRight} size={11} />
                <Icon d={ICONS.system} size={15} />
                <span
                  style={{
                    flex: 1,
                    textAlign: "left",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}>

                  {device.name}
                </span>
              </button>
              {open &&
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  paddingLeft: 18
                }}>

                  {listing?.status === "loading" &&
                <div style={{ padding: "4px 9px", fontSize: 11.5, color: t.inkFaint }}>
                      {tr("ui.network.loading_shares")}
                    </div>
                }
                  {listing?.status === "error" &&
                <div style={{ padding: "4px 9px", fontSize: 11.5 }}>
                      <div style={{ color: DANGER, marginBottom: 2, overflowWrap: "anywhere" }}>{listing.error?.message}</div>
                      {listing.error?.detail &&
                  <div style={{ color: t.inkFaint, fontFamily: t.mono, fontSize: 10, marginBottom: 4, overflowWrap: "anywhere" }}>
                          {listing.error.detail}
                        </div>
                  }
                      <button
                    onClick={() => setBrowseTarget(device)}
                    className="gy-soft"
                    style={{
                      border: `1px solid ${t.border}`,
                      background: "transparent",
                      color: t.inkSoft,
                      borderRadius: 6,
                      padding: "3px 8px",
                      cursor: "pointer",
                      fontSize: 11.5
                    }}>

                        {tr("ui.network.try_again")}
                      </button>
                    </div>
                }
                  {listing?.status === "loaded" && listing.shares.length === 0 &&
                <div style={{ padding: "4px 9px", fontSize: 11.5, color: t.inkFaint }}>
                      {tr("ui.network.no_shares")}
                    </div>
                }
                  {listing?.status === "loaded" &&
                listing.shares.map((share) =>
                <button
                  key={share.name}
                  className="gy-item"
                  onClick={() => void connectDiscoveredShare(device, share.name)}
                  title={share.comment || share.name}
                  style={navItemStyle(t, false, false)}>

                      <Icon d={ICONS.folder} size={14} />
                      <span
                    style={{
                      flex: 1,
                      textAlign: "left",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}>

                        {share.name}
                      </span>
                    </button>
                )}
                </div>
              }
            </div>);

        })}
        {smbScan === "scanning" &&
        <div style={{ padding: "6px 9px", fontSize: 11.5, color: t.inkFaint }}>
            {tr("ui.network.scanning")}
          </div>
        }
        {smbScan === "done" && smbDevices.length === 0 &&
        <div style={{ padding: "6px 9px", fontSize: 11.5, color: t.inkFaint }}>
            {tr("ui.network.no_devices_found")}
          </div>
        }
      </div>
      {browseTarget &&
      <SmbBrowseModal
        device={browseTarget}
        onClose={() => setBrowseTarget(null)} />

      }
      {modalTarget &&
      <ConnectionModal
        initial={modalTarget === "new" ? null : modalTarget}
        onClose={() => setModalTarget(null)} />

      }
    </div>);

}