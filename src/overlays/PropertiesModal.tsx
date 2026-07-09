import { tr } from "@/i18n";
import { Fragment, useEffect, useState } from "react";
import { useStore } from "../state/store";
import { explainError } from "../lib/errors";
import { useTheme } from "../theme/ThemeContext";
import { itemColors, type ResolvedTheme } from "../theme/skins";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import { extOf, formatSize, formatWhen, kindOf } from "../lib/format";
import { getFsBackend } from "../fs";
import type { FsEntry, PathPermissions } from "../fs/types";
import { Modal } from "./Modal";
interface PropertiesModalProps {
  entry: FsEntry;
  onClose: () => void;
}
const PERM_ROWS: {
  label: string;
  owner: number;
  group: number;
  other: number;
}[] = [
  {
    label: tr("ui.properties_modal.read"),
    owner: 0o400,
    group: 0o040,
    other: 0o004,
  },
  {
    label: tr("ui.properties_modal.write"),
    owner: 0o200,
    group: 0o020,
    other: 0o002,
  },
  {
    label: tr("ui.properties_modal.execute"),
    owner: 0o100,
    group: 0o010,
    other: 0o001,
  },
];
export function PropertiesModal({ entry, onClose }: PropertiesModalProps) {
  const t = useTheme();
  const setPathMode = useStore((s) => s.setPathMode);
  const [perms, setPerms] = useState<PathPermissions | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getFsBackend()
      .then((backend) => backend.getPathPermissions(entry.path))
      .then((p) => {
        if (!cancelled) setPerms(p);
      })
      .catch((e) => {
        if (!cancelled) setError(explainError(e));
      });
    return () => {
      cancelled = true;
    };
  }, [entry.path]);
  const kind = kindOf(entry.name, entry.isDir);
  const colors = itemColors(kind, t);
  const ext = extOf(entry.name);
  async function toggleBit(bit: number) {
    if (!perms) return;
    const nextMode = perms.mode ^ bit;
    setPerms({
      ...perms,
      mode: nextMode,
    });
    await setPathMode(entry.path, nextMode);
  }
  return (
    <Modal title={tr("ui.properties_modal.properties")} onClose={onClose}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 12,
            background: colors.bg,
            color: colors.tint,
            display: "grid",
            placeItems: "center",
            flex: "none",
          }}
        >
          {entry.isDir ? (
            <Icon d={ICONS.folder} size={22} color={colors.tint} />
          ) : (
            <span
              style={{
                fontFamily: t.mono,
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {ext}
            </span>
          )}
        </div>
        <div
          style={{
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {entry.name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: t.inkFaint,
            }}
          >
            {entry.isDir ? tr("ui.properties_modal.folder") : kind}
          </div>
        </div>
      </div>

      <Row
        label={tr("ui.properties_modal.location")}
        value={entry.path}
        t={t}
        mono
      />
      {!entry.isDir && (
        <Row
          label={tr("ui.properties_modal.size")}
          value={formatSize(entry.size)}
          t={t}
        />
      )}
      <Row
        label={tr("ui.properties_modal.modified")}
        value={formatWhen(entry.modifiedMs)}
        t={t}
      />
      <Row
        label={tr("ui.properties_modal.created")}
        value={formatWhen(entry.createdMs)}
        t={t}
      />

      {error && (
        <div
          style={{
            fontSize: 11.5,
            color: t.inkFaint,
            marginTop: 10,
          }}
        >
          {tr("ui.properties_modal.permissions_unavailable_error", {
            error,
          })}
        </div>
      )}

      {perms && (
        <>
          <Row
            label={tr("ui.properties_modal.owner")}
            value={tr("ui.properties_modal.owner_uid", {
              owner: perms.owner,
              uid: perms.uid,
            })}
            t={t}
          />
          <Row
            label={tr("ui.properties_modal.group")}
            value={tr("ui.properties_modal.group_gid", {
              group: perms.group,
              gid: perms.gid,
            })}
            t={t}
          />
          {perms.isSymlink && (
            <Row
              label={tr("ui.properties_modal.links_to")}
              value={perms.symlinkTarget || "?"}
              t={t}
              mono
            />
          )}

          <div
            style={{
              fontFamily: t.mono,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: ".1em",
              color: t.inkFaint,
              margin: "14px 0 8px",
              fontWeight: 700,
            }}
          >
            {tr("ui.properties_modal.permissions_mode", { mode: perms.mode.toString(8).padStart(3, "0") })}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr repeat(3, 52px)",
              gap: 6,
              fontSize: 11.5,
              alignItems: "center",
            }}
          >
            <span />
            <span
              style={{
                textAlign: "center",
                color: t.inkFaint,
              }}
            >
              {tr("ui.properties_modal.owner")}
            </span>
            <span
              style={{
                textAlign: "center",
                color: t.inkFaint,
              }}
            >
              {tr("ui.properties_modal.group")}
            </span>
            <span
              style={{
                textAlign: "center",
                color: t.inkFaint,
              }}
            >
              {tr("ui.properties_modal.other")}
            </span>
            {PERM_ROWS.map((row) => (
              <Fragment key={row.label}>
                <span
                  style={{
                    color: t.inkSoft,
                  }}
                >
                  {row.label}
                </span>
                {[row.owner, row.group, row.other].map((bit) => (
                  <span
                    key={bit}
                    style={{
                      textAlign: "center",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={(perms.mode & bit) !== 0}
                      onChange={() => void toggleBit(bit)}
                    />
                  </span>
                ))}
              </Fragment>
            ))}
          </div>
        </>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: 16,
        }}
      >
        <button
          onClick={onClose}
          className="gy-prim"
          style={{
            border: "none",
            background: t.accent,
            color: "#fff",
            borderRadius: 8,
            padding: "7px 14px",
            cursor: "pointer",
            fontSize: 12.5,
            fontWeight: 700,
          }}
        >
          {tr("ui.properties_modal.close")}
        </button>
      </div>
    </Modal>
  );
}
function Row({
  label,
  value,
  t,
  mono,
}: {
  label: string;
  value: string;
  t: ResolvedTheme;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        padding: "3px 0",
        fontSize: 12,
      }}
    >
      <span
        style={{
          color: t.inkFaint,
          flex: "none",
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: t.ink,
          fontFamily: mono ? t.mono : "inherit",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: "right",
          flex: 1,
          minWidth: 0,
        }}
      >
        {value}
      </span>
    </div>
  );
}
