use std::sync::{Arc, Mutex};
use std::net::TcpStream;
use std::time::Duration;
use base64::{Engine as _, engine::general_purpose::STANDARD};
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;

type BackendChild = Arc<Mutex<Option<CommandChild>>>;

/// Guarda PDFs en la carpeta Descargas del usuario.
#[tauri::command]
fn save_pdf(filename: String, data_base64: String) -> Result<String, String> {
    let bytes = STANDARD
        .decode(&data_base64)
        .map_err(|e| format!("Error decodificando base64: {e}"))?;

    let dir = if let Ok(p) = std::env::var("USERPROFILE") {
        std::path::PathBuf::from(p).join("Downloads")
    } else if let Ok(p) = std::env::var("HOME") {
        std::path::PathBuf::from(p).join("Downloads")
    } else {
        std::path::PathBuf::from(".")
    };

    let path = dir.join(&filename);
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

/// Espera hasta que el puerto 8000 acepte conexiones TCP (backend listo).
/// Retorna true si el backend responde antes de `max_secs`, false si agota el tiempo.
fn wait_for_backend(max_secs: u64) -> bool {
    for _ in 0..max_secs {
        if TcpStream::connect_timeout(
            &"127.0.0.1:8000".parse().unwrap(),
            Duration::from_millis(500),
        )
        .is_ok()
        {
            return true;
        }
        std::thread::sleep(Duration::from_secs(1));
    }
    false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![save_pdf])
        .setup(|app| {
            // ── Logging en debug ──────────────────────────────────────────
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // ── Arrancar backend sidecar ──────────────────────────────────
            let shell = app.shell();
            let (_rx, child) = shell
                .sidecar("backend")
                .expect("No se encontró el sidecar 'backend'. Asegurate de compilar con PyInstaller primero.")
                .spawn()
                .expect("No se pudo iniciar el proceso backend.");

            // Guardamos el handle para matarlo al cerrar la app
            app.manage(Arc::new(Mutex::new(Some(child))));

            // ── Mostrar ventana solo cuando el backend esté listo ─────────
            // La ventana arranca oculta (visible: false en tauri.conf.json).
            // Un thread en background hace polling al puerto 8000 y la muestra.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let ready = wait_for_backend(45); // máx 45 segundos

                if let Some(window) = handle.get_webview_window("main") {
                    if ready {
                        let _ = window.show();
                        let _ = window.set_focus();
                    } else {
                        // Backend no respondió — mostrar igual con error en consola
                        eprintln!("[elashes] Backend tardó demasiado — mostrando ventana de todas formas.");
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Error construyendo la aplicación Tauri")
        .run(|app_handle, event| {
            // ── Matar el backend al cerrar — evita procesos zombie ────────
            if let tauri::RunEvent::Exit = event {
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
