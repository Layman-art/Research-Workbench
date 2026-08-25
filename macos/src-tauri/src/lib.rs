mod database;
mod desktop;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(desktop::DesktopState::default())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .setup(|app| {
            desktop::setup_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            database::get_database_url,
            database::execute_transaction,
            desktop::get_close_to_tray,
            desktop::set_close_to_tray,
            desktop::open_data_directory
        ])
        .on_window_event(desktop::handle_window_event)
        .build(tauri::generate_context!())
        .expect("failed to build Research Workbench");

    app.run(desktop::handle_run_event);
}
