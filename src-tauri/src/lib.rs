mod fsops;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            fsops::disk_usage,
            fsops::list_devices,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
