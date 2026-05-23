use std::sync::{Arc, Mutex};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;

type BackendChild = Arc<Mutex<Option<CommandChild>>>;

fn get_download_dir() -> std::path::PathBuf {
    if let Ok(profile) = std::env::var("USERPROFILE") {
        std::path::PathBuf::from(profile).join("Downloads")
    } else if let Ok(home) = std::env::var("HOME") {
        std::path::PathBuf::from(home).join("Downloads")
    } else {
        std::path::PathBuf::from(".")
    }
}

#[tauri::command]
fn save_pdf(filename: String, data_base64: String) -> Result<String, String> {
    let bytes = STANDARD.decode(&data_base64)
        .map_err(|e| format!("Error decodificando base64: {e}"))?;

    let dir = get_download_dir();
    let path = dir.join(&filename);
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![save_pdf])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let shell = app.shell();
            let (_rx, child) = shell
                .sidecar("backend")
                .expect("No se encontró el sidecar 'backend'")
                .spawn()
                .expect("Error al iniciar el backend");

            // Guardamos el handle para poder matarlo al salir
            app.manage(Arc::new(Mutex::new(Some(child))));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                // Matar el backend al cerrar la app — evita proceso zombie
                if let Some(state) = app_handle.try_state::<BackendChild>() {
                    if let Ok(mut guard) = state.lock() {
                        if let Some(child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        });
}
