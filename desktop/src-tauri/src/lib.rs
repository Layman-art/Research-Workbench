mod backups;
mod database;
mod desktop;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            desktop::show_main_window(app)
        }))
        .manage(desktop::DesktopState::default())
        .manage(backups::BackupState::default())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .setup(|app| {
            desktop::setup_tray(app)?;
            if !std::env::args().any(|arg| arg == "--hidden") {
                desktop::show_main_window(app.handle());
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            database::get_database_url,
            database::execute_transaction,
            desktop::get_close_to_tray,
            desktop::set_close_to_tray,
            desktop::open_data_directory,
            desktop::open_local_path,
            desktop::finish_exit,
            backups::create_backup,
            backups::list_backups,
            backups::restore_backup,
            backups::storage_info
        ])
        .on_window_event(desktop::handle_window_event)
        .build(tauri::generate_context!())
        .expect("failed to build Research Workbench");

    app.run(desktop::handle_run_event);
}
