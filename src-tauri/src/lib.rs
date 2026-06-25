use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{
  Manager, RunEvent, WebviewUrl, WebviewWindowBuilder,
};
use tauri::webview::NewWindowResponse;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

const DESKTOP_PORT: u16 = 38472;
const DEV_VITE_PORT: u16 = 5173;
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

fn is_in_app_web_origin(url: &url::Url) -> bool {
  if url.scheme() == "tauri" || url.scheme() == "asset" {
    return true;
  }
  let host = url.host_str();
  let port = url.port();
  if host == Some("127.0.0.1") && port == Some(DESKTOP_PORT) {
    return true;
  }
  if host == Some("localhost") && port == Some(DESKTOP_PORT) {
    return true;
  }
  cfg!(debug_assertions) && host == Some("localhost") && port == Some(DEV_VITE_PORT)
}

fn open_external_in_system_browser(app: &tauri::AppHandle, url: &url::Url) {
  if !matches!(url.scheme(), "http" | "https" | "mailto" | "tel") {
    return;
  }
  append_startup_log(
    &app_data_root().join("logs"),
    &format!("open external: {}", url.as_str()),
  );
  if let Err(err) = app.opener().open_url(url.as_str(), None::<&str>) {
    append_startup_log(
      &app_data_root().join("logs"),
      &format!("open external failed: {err}"),
    );
  }
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

fn health_matches_expected(body: &str) -> bool {
  let Ok(json) = serde_json::from_str::<serde_json::Value>(body) else {
    return false;
  };
  let expected_version = env!("CARGO_PKG_VERSION");
  json.get("status").and_then(|v| v.as_str()) == Some("ok")
    && json.get("version").and_then(|v| v.as_str()) == Some(expected_version)
}

fn wait_for_health(port: u16) -> Result<(), String> {
  let url = format!("http://127.0.0.1:{port}/health");
  let expected_version = env!("CARGO_PKG_VERSION");
  let deadline = Instant::now() + Duration::from_secs(HEALTH_TIMEOUT_SECS);
  while Instant::now() < deadline {
    if let Ok(resp) = ureq::get(&url).call() {
      if resp.status() == 200 {
        if let Ok(body) = resp.into_string() {
          if health_matches_expected(&body) {
            return Ok(());
          }
          append_startup_log(
            &app_data_root().join("logs"),
            &format!(
              "health ignored: port {port} responded but version mismatch (expected {expected_version}, body={body})"
            ),
          );
        }
      }
    }
    std::thread::sleep(Duration::from_millis(200));
  }
  Err(format!(
    "Sidecar health check timed out ({url}, expected version {expected_version}). \
     Another project-pilot-api.exe may still be using port {port} — end all project-pilot* \
     processes in Task Manager, then retry. Logs: %LOCALAPPDATA%\\ProjectPilot\\logs\\"
  ))
}

fn kill_stale_sidecar_processes(logs_dir: &Path) {
  #[cfg(windows)]
  {
    append_startup_log(logs_dir, "release: clearing stale project-pilot-api.exe processes");
    let output = std::process::Command::new("taskkill")
      .args(["/F", "/IM", "project-pilot-api.exe", "/T"])
      .output();
    match output {
      Ok(out) => {
        let detail = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if detail.is_empty() {
          append_startup_log(logs_dir, "release: no stale sidecar processes found");
        } else {
          append_startup_log(logs_dir, &format!("release: taskkill sidecar: {detail}"));
        }
      }
      Err(err) => {
        append_startup_log(
          logs_dir,
          &format!("release: taskkill sidecar failed: {err}"),
        );
      }
    }
    std::thread::sleep(Duration::from_millis(500));
  }
}

fn verify_sidecar_api(port: u16, logs_dir: &Path) -> Result<(), String> {
  let url = format!("http://127.0.0.1:{port}/api/project-libraries");
  let resp = ureq::get(&url)
    .call()
    .map_err(|e| format!("Sidecar API probe failed ({url}): {e}"))?;
  if resp.status() != 200 {
    return Err(format!(
      "Sidecar API probe returned HTTP {} for {url}. \
       Port {port} may be held by an incompatible project-pilot-api.exe.",
      resp.status()
    ));
  }
  append_startup_log(logs_dir, &format!("sidecar api ok: GET {url} -> 200"));
  Ok(())
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
          kill_stale_sidecar_processes(&logs_dir);
          let child = spawn_sidecar(app, static_dir, database_url, logs_dir.clone())?;
          append_startup_log(&logs_dir, "sidecar spawned, waiting for /health");
          wait_for_health(DESKTOP_PORT)?;
          verify_sidecar_api(DESKTOP_PORT, &logs_dir)?;
          append_startup_log(&logs_dir, "sidecar healthy");
          app.state::<SidecarHandle>().0.lock().unwrap().replace(child);
          WebviewUrl::External(
            url::Url::parse(&format!("http://127.0.0.1:{DESKTOP_PORT}/"))
              .map_err(|e| e.to_string())?,
          )
        };

        let app_handle = app.handle().clone();
        WebviewWindowBuilder::new(app, "main", url)
          .title("Project Pilot")
          .inner_size(1280.0, 800.0)
          .center()
          .visible(true)
          .on_navigation({
            let app_handle = app_handle.clone();
            move |nav_url| {
              if is_in_app_web_origin(nav_url) {
                return true;
              }
              if matches!(nav_url.scheme(), "http" | "https" | "mailto" | "tel") {
                open_external_in_system_browser(&app_handle, nav_url);
                return false;
              }
              false
            }
          })
          .on_new_window({
            let app_handle = app_handle.clone();
            move |nav_url, _features| {
              if is_in_app_web_origin(&nav_url) {
                return NewWindowResponse::Deny;
              }
              if matches!(nav_url.scheme(), "http" | "https" | "mailto" | "tel") {
                open_external_in_system_browser(&app_handle, &nav_url);
              }
              NewWindowResponse::Deny
            }
          })
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
