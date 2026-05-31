use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{
  Manager, RunEvent, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

const DESKTOP_PORT: u16 = 38472;
/// PyInstaller onefile sidecar can be slow on first launch.
const HEALTH_TIMEOUT_SECS: u64 = 120;

struct SidecarHandle(Mutex<Option<CommandChild>>);

fn app_data_root() -> PathBuf {
  std::env::var("LOCALAPPDATA")
    .map(|p| PathBuf::from(p).join("ProjectPilot"))
    .unwrap_or_else(|_| PathBuf::from(".project_pilot"))
}

fn ensure_app_dirs(root: &PathBuf) -> std::io::Result<(PathBuf, PathBuf)> {
  let database_dir = root.join("database");
  let logs_dir = root.join("logs");
  std::fs::create_dir_all(&database_dir)?;
  std::fs::create_dir_all(root.join("cache"))?;
  std::fs::create_dir_all(root.join("config"))?;
  std::fs::create_dir_all(&logs_dir)?;
  Ok((database_dir, logs_dir))
}

fn sqlite_database_url(db_path: &PathBuf) -> String {
  let normalized = db_path.to_string_lossy().replace('\\', "/");
  format!("sqlite+aiosqlite:///{normalized}")
}

fn append_startup_log(logs_dir: &Path, message: &str) {
  let _ = (|| -> std::io::Result<()> {
    std::fs::create_dir_all(logs_dir)?;
    let path = logs_dir.join("desktop.log");
    let mut file = OpenOptions::new().create(true).append(true).open(path)?;
    writeln!(file, "{message}")?;
    Ok(())
  })();
}

fn show_startup_error(message: &str) {
  let _ = rfd::MessageDialog::new()
    .set_title("Project Pilot")
    .set_description(message)
    .set_level(rfd::MessageLevel::Error)
    .show();
}

fn resolve_static_dir(app: &tauri::App) -> Result<PathBuf, String> {
  let candidates = [
    "dist",
    "resources/dist",
    "resources/resources/dist",
  ];
  for candidate in candidates {
    if let Ok(path) = app
      .path()
      .resolve(candidate, tauri::path::BaseDirectory::Resource)
    {
      if path.join("index.html").is_file() {
        return Ok(path);
      }
    }
  }
  Err(
    "Frontend static files not found in app resources (expected index.html under resources/dist)."
      .to_string(),
  )
}

fn wait_for_health(port: u16) -> Result<(), String> {
  let url = format!("http://127.0.0.1:{port}/health");
  let deadline = Instant::now() + Duration::from_secs(HEALTH_TIMEOUT_SECS);
  while Instant::now() < deadline {
    if let Ok(resp) = ureq::get(&url).call() {
      if resp.status() == 200 {
        return Ok(());
      }
    }
    std::thread::sleep(Duration::from_millis(200));
  }
  Err(format!(
    "Sidecar health check timed out ({url}). See %LOCALAPPDATA%\\ProjectPilot\\logs\\"
  ))
}

fn spawn_sidecar(
  app: &tauri::App,
  static_dir: PathBuf,
  database_url: String,
  logs_dir: PathBuf,
) -> Result<CommandChild, String> {
  // pydantic-settings expects JSON for list-typed env vars (CORS_ORIGINS).
  let cors_json = format!(r#"["http://127.0.0.1:{DESKTOP_PORT}"]"#);
  let sidecar = app
    .shell()
    .sidecar("project-pilot-api")
    .map_err(|e| e.to_string())?
    .env("HOST", "127.0.0.1")
    .env("PORT", DESKTOP_PORT.to_string())
    .env("DATABASE_URL", database_url)
    .env("STATIC_DIR", static_dir.to_string_lossy().to_string())
    .env("CORS_ORIGINS", cors_json)
    .env("LOG_DIR", logs_dir.to_string_lossy().to_string())
    .spawn()
    .map_err(|e| e.to_string())?;
  Ok(sidecar.1)
}

fn kill_sidecar(app: &tauri::AppHandle) {
  if let Some(state) = app.try_state::<SidecarHandle>() {
    if let Some(child) = state.0.lock().unwrap().take() {
      let _ = child.kill();
    }
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
      }
    }))
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(
      tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        .build(),
    )
    .manage(SidecarHandle(Mutex::new(None)))
    .setup(|app| {
      let result: Result<(), String> = (|| {
        let url = if cfg!(debug_assertions) {
          append_startup_log(
            &app_data_root().join("logs"),
            "debug: opening http://localhost:5173 (start uvicorn separately)",
          );
          WebviewUrl::External(
            url::Url::parse("http://localhost:5173").map_err(|e| e.to_string())?,
          )
        } else {
          let data_root = app_data_root();
          let (database_dir, logs_dir) = ensure_app_dirs(&data_root).map_err(|e| e.to_string())?;
          append_startup_log(&logs_dir, "release: starting sidecar");
          let db_file = database_dir.join("project_pilot.db");
          let database_url = sqlite_database_url(&db_file);
          let static_dir = resolve_static_dir(app)?;
          append_startup_log(
            &logs_dir,
            &format!("static_dir={}", static_dir.display()),
          );
          let child = spawn_sidecar(app, static_dir, database_url, logs_dir.clone())?;
          append_startup_log(&logs_dir, "sidecar spawned, waiting for /health");
          wait_for_health(DESKTOP_PORT)?;
          append_startup_log(&logs_dir, "sidecar healthy");
          app.state::<SidecarHandle>().0.lock().unwrap().replace(child);
          WebviewUrl::External(
            url::Url::parse(&format!("http://127.0.0.1:{DESKTOP_PORT}/"))
              .map_err(|e| e.to_string())?,
          )
        };

        WebviewWindowBuilder::new(app, "main", url)
          .title("Project Pilot")
          .inner_size(1280.0, 800.0)
          .center()
          .visible(true)
          .build()
          .map_err(|e| e.to_string())?;
        append_startup_log(
          &app_data_root().join("logs"),
          "main window created",
        );
        Ok(())
      })();

      if let Err(err) = result {
        let log_dir = app_data_root().join("logs");
        append_startup_log(&log_dir, &format!("startup failed: {err}"));
        let hint = format!(
          "{err}\n\nDetails may be in:\n{}",
          log_dir.display()
        );
        show_startup_error(&hint);
        return Err(err.into());
      }
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app_handle, event| {
      if let RunEvent::Exit = event {
        kill_sidecar(app_handle);
      }
    });
}
