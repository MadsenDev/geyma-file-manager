//! SMB device discovery for the Network panel: browse the LAN for hosts advertising
//! `_smb._tcp` over mDNS/DNS-SD (macOS, Samba with Avahi, and most NAS boxes do; stock
//! Windows advertises over WS-Discovery instead, which is out of scope here — those
//! machines still work through manual entry), then enumerate a discovered host's disk
//! shares over the srvsvc pipe so the panel can show device → shares as a tree.

use std::collections::BTreeMap;
use std::net::IpAddr;
use std::time::{Duration, Instant};

use mdns_sd::{ServiceDaemon, ServiceEvent};
use serde::Serialize;
use smb::{Client, ClientConfig};
use smb_rpc::interface::ShareKind;

const SMB_SERVICE: &str = "_smb._tcp.local.";
const DEFAULT_SCAN_MS: u64 = 2500;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredSmbServer {
    /// Instance name from the advertisement, e.g. "Office NAS".
    pub name: String,
    /// Advertised hostname without the trailing dot, e.g. "office-nas.local".
    pub hostname: String,
    /// Best address to connect to: the first IPv4 address if one was advertised
    /// (works without an mDNS-aware system resolver), otherwise the hostname.
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SmbShareInfo {
    pub name: String,
    pub comment: String,
}

/// "Office NAS._smb._tcp.local." → "Office NAS". mDNS escapes literal dots in instance
/// names as `\.` (and other bytes as `\DDD`); undo the common cases so display names read
/// naturally.
fn instance_name(fullname: &str) -> String {
    let name = fullname
        .strip_suffix(&format!(".{SMB_SERVICE}"))
        .unwrap_or(fullname);
    name.replace("\\.", ".").replace("\\032", " ").replace('\\', "")
}

fn trim_host(hostname: &str) -> String {
    hostname.trim_end_matches('.').to_string()
}

#[tauri::command]
pub async fn smb_discover(timeout_ms: Option<u64>) -> Result<Vec<DiscoveredSmbServer>, String> {
    let timeout = Duration::from_millis(timeout_ms.unwrap_or(DEFAULT_SCAN_MS).clamp(500, 15_000));
    tauri::async_runtime::spawn_blocking(move || {
        let daemon = ServiceDaemon::new().map_err(|error| format!("Could not start mDNS discovery: {error}"))?;
        let receiver = daemon
            .browse(SMB_SERVICE)
            .map_err(|error| format!("Could not browse for SMB services: {error}"))?;

        // Keyed by fullname so a service resolved on several interfaces collapses to one
        // entry (preferring a resolution that carries an IPv4 address).
        let mut found: BTreeMap<String, DiscoveredSmbServer> = BTreeMap::new();
        let deadline = Instant::now() + timeout;
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                break;
            }
            match receiver.recv_timeout(remaining) {
                Ok(ServiceEvent::ServiceResolved(info)) => {
                    let hostname = trim_host(&info.host);
                    let ipv4 = info
                        .addresses
                        .iter()
                        .map(|a| a.to_ip_addr())
                        .find(IpAddr::is_ipv4);
                    let server = DiscoveredSmbServer {
                        name: instance_name(&info.fullname),
                        host: ipv4.map(|ip| ip.to_string()).unwrap_or_else(|| hostname.clone()),
                        hostname,
                        port: info.port,
                    };
                    match found.get(&info.fullname) {
                        // Keep an entry that already has an IPv4 address over one that doesn't.
                        Some(existing) if existing.host.parse::<IpAddr>().is_ok() && ipv4.is_none() => {}
                        _ => {
                            found.insert(info.fullname.clone(), server);
                        }
                    }
                }
                Ok(_) => {}
                Err(_) => break, // daemon went away; report what we have
            }
        }
        daemon.stop_browse(SMB_SERVICE).ok();
        daemon.shutdown().ok();
        Ok(found.into_values().collect())
    })
    .await
    .map_err(|error| format!("Discovery task failed: {error}"))?
}

#[tauri::command]
pub async fn smb_list_shares(
    host: String,
    port: u16,
    username: String,
    password: String,
) -> Result<Vec<SmbShareInfo>, String> {
    // An empty username means "browse as guest" — many NAS boxes allow share
    // enumeration for the guest account with no password.
    let username = if username.trim().is_empty() { "Guest".to_string() } else { username };
    let server = format!("{host}:{port}");
    let client = Client::new(ClientConfig::default());
    client
        .ipc_connect(&server, &username, password)
        .await
        .map_err(|error| format!("Could not connect to {host}: {error}"))?;
    let shares = client
        .list_shares(&server)
        .await
        .map_err(|error| format!("Could not list shares on {host}: {error}"))?;
    client.close().await.ok();

    let mut out: Vec<SmbShareInfo> = shares
        .iter()
        .filter(|share| {
            let ty = **share.share_type;
            ty.kind() == ShareKind::Disk && !ty.special()
        })
        .filter_map(|share| {
            let name = share.netname.as_ref().map(|n| n.to_string())?;
            // Hidden administrative shares (ADMIN$, C$, ...) aren't browseable entries.
            if name.is_empty() || name.ends_with('$') {
                return None;
            }
            let comment = share.remark.as_ref().map(|r| r.to_string()).unwrap_or_default();
            Some(SmbShareInfo { name, comment })
        })
        .collect();
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_service_suffix_from_fullname() {
        assert_eq!(instance_name("Office NAS._smb._tcp.local."), "Office NAS");
    }

    #[test]
    fn unescapes_dns_sd_instance_names() {
        assert_eq!(instance_name(r"web\.server._smb._tcp.local."), "web.server");
        assert_eq!(instance_name(r"My\032NAS._smb._tcp.local."), "My NAS");
    }

    #[test]
    fn leaves_non_service_names_alone() {
        assert_eq!(instance_name("plain-host"), "plain-host");
    }

    #[test]
    fn trims_trailing_dot_from_hostnames() {
        assert_eq!(trim_host("office-nas.local."), "office-nas.local");
        assert_eq!(trim_host("office-nas.local"), "office-nas.local");
    }
}
