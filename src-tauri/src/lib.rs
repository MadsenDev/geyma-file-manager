mod ai;
mod archives;
mod fsops;
mod media;
mod preview;
mod remote;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let media_server = media::start().expect("failed to start media server");
    tauri::Builder::default()
        .manage(media_server)
        .manage(remote::RemoteSessions::default())
        .manage(ai::AiState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fsops::list_dir,
            fsops::stat_path,
            fsops::home_dir,
            fsops::read_text_file,
            fsops::create_folder,
            fsops::create_file,
            fsops::rename_path,
            fsops::move_path,
            fsops::copy_path,
            fsops::trash_path,
            fsops::restore_path,
            fsops::delete_permanently,
            fsops::trash_dir_path,
            fsops::extract_archive,
            fsops::create_archive,
            fsops::disk_usage,
            fsops::list_devices,
            fsops::get_path_permissions,
            fsops::set_path_mode,
            fsops::create_symlink,
            media::media_server_info,
            media::media_playback_support,
            preview::preview_archive,
            preview::preview_text_file,
            remote::remote_connect,
            remote::remote_disconnect,
            remote::remote_list_dir,
            remote::remote_stat,
            remote::remote_create_folder,
            remote::remote_create_file,
            remote::remote_rename_path,
            remote::remote_move_path,
            remote::remote_delete_permanently,
            remote::remote_read_text_file,
            remote::remote_copy_path,
            remote::upload_to_remote,
            remote::download_from_remote,
            remote::keyring_save_password,
            remote::keyring_load_password,
            remote::keyring_delete_password,
            ai::ai_status,
            ai::ai_install,
            ai::ai_start_server,
            ai::ai_stop_server,
            ai::ai_list_models,
            ai::ai_pull_model,
            ai::ai_delete_model,
            ai::ai_generate,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
