use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Manager, RunEvent, State, WindowEvent,
};
use tauri_plugin_shell::ShellExt;

pub struct DesktopState {
    close_to_tray: AtomicBool,
    is_quitting: AtomicBool,
}

impl Default for DesktopState {
    fn default() -> Self {
        Self {
            close_to_tray: AtomicBool::new(true),
            is_quitting: AtomicBool::new(false),
        }
    }
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

const fn should_restore_on_reopen(has_visible_windows: bool) -> bool {
    !has_visible_windows
}

pub fn handle_run_event(app: &AppHandle, event: RunEvent) {
    #[cfg(target_os = "macos")]
    if let RunEvent::Reopen {
        has_visible_windows,
        ..
    } = event
    {
        if should_restore_on_reopen(has_visible_windows) {
            show_main_window(app);
        }
    }
}

pub fn setup_tray(app: &mut App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "显示科研工作台", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;
    let mut builder = TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Research Workbench · 科研工作台")
        .icon_as_template(true)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main_window(app),
            "quit" => {
                app.state::<DesktopState>()
                    .is_quitting
                    .store(true, Ordering::Relaxed);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            ) {
                show_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }
    builder.build(app)?;
    Ok(())
}

#[tauri::command]
pub fn get_close_to_tray(state: State<'_, DesktopState>) -> bool {
    state.close_to_tray.load(Ordering::Relaxed)
}

#[tauri::command]
pub fn set_close_to_tray(state: State<'_, DesktopState>, enabled: bool) -> bool {
    state.close_to_tray.store(enabled, Ordering::Relaxed);
    enabled
}

#[tauri::command]
pub fn open_data_directory(app: AppHandle) -> Result<(), String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法定位应用数据目录：{error}"))?;
    std::fs::create_dir_all(&directory)
        .map_err(|error| format!("无法创建应用数据目录：{error}"))?;
    #[allow(deprecated)]
    app.shell()
        .open(directory.to_string_lossy(), None)
        .map_err(|error| format!("无法打开应用数据目录：{error}"))
}

pub fn handle_window_event(window: &tauri::Window, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        if window
            .state::<DesktopState>()
            .close_to_tray
            .load(Ordering::Relaxed)
            && !window
                .state::<DesktopState>()
                .is_quitting
                .load(Ordering::Relaxed)
        {
            api.prevent_close();
            let _ = window.hide();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn desktop_state_defaults_to_close_to_tray_without_quitting() {
        let state = DesktopState::default();
        assert!(state.close_to_tray.load(Ordering::Relaxed));
        assert!(!state.is_quitting.load(Ordering::Relaxed));
    }

    #[test]
    fn dock_reopen_restores_only_when_every_window_is_hidden() {
        assert!(should_restore_on_reopen(false));
        assert!(!should_restore_on_reopen(true));
    }
}
