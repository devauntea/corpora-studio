#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::Engine;
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::{
    collections::HashSet,
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager, State};

const MAX_PROJECT: u64 = 80_000_000;
#[derive(Default)]
struct Files(Mutex<HashSet<PathBuf>>);
#[derive(Default)]
struct ExitApproval(AtomicBool);
#[derive(Serialize)]
struct Opened {
    content: String,
    path: String,
}

fn validate_envelope(content: &str) -> Result<(), String> {
    if content.len() as u64 > MAX_PROJECT {
        return Err("Project exceeds 80 MB.".into());
    }
    let v: serde_json::Value =
        serde_json::from_str(content).map_err(|_| "Invalid project JSON.")?;
    if v["format"] != "form-studio"
        || (v["version"] != 1
            && v["version"] != 2
            && v["version"] != 3
            && v["version"] != 4
            && v["version"] != 5)
    {
        return Err("Unsupported project format or version.".into());
    }
    Ok(())
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or("The destination has no parent folder.")?;
    let mut temp = tempfile::NamedTempFile::new_in(parent)
        .map_err(|e| format!("Cannot create save file: {e}"))?;
    temp.write_all(bytes)
        .map_err(|e| format!("Cannot write project: {e}"))?;
    temp.as_file()
        .sync_all()
        .map_err(|e| format!("Cannot flush project: {e}"))?;
    temp.persist(path)
        .map_err(|e| format!("Cannot replace destination: {}", e.error))?;
    // Persist is an atomic same-filesystem replacement. Directory sync is best effort.
    if let Ok(dir) = fs::File::open(parent) {
        let _ = dir.sync_all();
    }
    Ok(())
}

#[tauri::command]
async fn open_project(app: tauri::AppHandle) -> Result<Option<Opened>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(path) = rfd::FileDialog::new()
            .add_filter("Form Studio project", &["formstudio"])
            .pick_file()
        else {
            return Ok(None);
        };
        if fs::metadata(&path).map_err(|e| e.to_string())?.len() > MAX_PROJECT {
            return Err("Project exceeds 80 MB.".into());
        }
        let content = fs::read_to_string(&path).map_err(|e| format!("Cannot read project: {e}"))?;
        validate_envelope(&content)?;
        app.state::<Files>()
            .0
            .lock()
            .map_err(|_| "File state unavailable.")?
            .insert(path.clone());
        Ok(Some(Opened {
            content,
            path: path.to_string_lossy().into_owned(),
        }))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn save_project(
    app: tauri::AppHandle,
    content: String,
    path: Option<String>,
    name: String,
) -> Result<Option<String>, String> {
    validate_envelope(&content)?;
    tauri::async_runtime::spawn_blocking(move || {
        let chosen = if let Some(p) = path {
            let p = PathBuf::from(p);
            if !app
                .state::<Files>()
                .0
                .lock()
                .map_err(|_| "File state unavailable.")?
                .contains(&p)
            {
                return Err("Choose a destination with Save As before writing this file.".into());
            }
            p
        } else {
            let safe: String = name
                .chars()
                .filter(|c| c.is_alphanumeric() || " -_".contains(*c))
                .take(80)
                .collect();
            let Some(p) = rfd::FileDialog::new()
                .add_filter("Form Studio project", &["formstudio"])
                .set_file_name(format!("{safe}.formstudio"))
                .save_file()
            else {
                return Ok(None);
            };
            p
        };
        atomic_write(&chosen, content.as_bytes())?;
        app.state::<Files>()
            .0
            .lock()
            .map_err(|_| "File state unavailable.")?
            .insert(chosen.clone());
        Ok(Some(chosen.to_string_lossy().into_owned()))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn save_review(data: String, name: String) -> Result<Option<String>, String> {
    if data.len() > 50_000_000 {
        return Err("Review image exceeds 50 MB.".into());
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(
            data.strip_prefix("data:image/png;base64,")
                .ok_or("Expected a PNG image.")?,
        )
        .map_err(|_| "Invalid image data.")?;
    if !bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Err("Invalid PNG signature.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let safe: String = name
            .chars()
            .filter(|c| c.is_alphanumeric() || " -_".contains(*c))
            .take(80)
            .collect();
        let Some(path) = rfd::FileDialog::new()
            .add_filter("PNG review image", &["png"])
            .set_file_name(format!("{safe}-review.png"))
            .save_file()
        else {
            return Ok(None);
        };
        atomic_write(&path, &bytes)?;
        Ok(Some(path.to_string_lossy().into_owned()))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn close_app(app: tauri::AppHandle, approval: State<ExitApproval>) {
    approval.0.store(true, Ordering::SeqCst);
    app.exit(0);
}

#[tauri::command]
async fn decode_heic(data: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || decode_heic_local(&data))
        .await
        .map_err(|e| e.to_string())?
}
fn decode_heic_local(data: &str) -> Result<String, String> {
    if !cfg!(target_os = "macos") {
        return Err(
            "HEIC import currently requires macOS. Export a PNG or JPEG for this platform.".into(),
        );
    }
    if data.len() > 20_000_000 {
        return Err("HEIC exceeds 15 MB.".into());
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data)
        .map_err(|_| "Invalid HEIC bytes.")?;
    if bytes.len() < 12 || &bytes[4..8] != b"ftyp" {
        return Err("Invalid HEIC header.".into());
    }
    let dir = tempfile::tempdir().map_err(|e| e.to_string())?;
    let input = dir.path().join("source.heic");
    let output = dir.path().join("preview.png");
    fs::write(&input, bytes).map_err(|e| e.to_string())?;
    let metadata = std::process::Command::new("/usr/bin/sips")
        .args(["-g", "pixelWidth", "-g", "pixelHeight"])
        .arg(&input)
        .output()
        .map_err(|e| e.to_string())?;
    let info = String::from_utf8_lossy(&metadata.stdout);
    let dimension = |key: &str| -> Option<u64> {
        info.lines()
            .find(|l| l.trim_start().starts_with(key))
            .and_then(|l| l.split(':').nth(1))
            .and_then(|v| v.trim().parse().ok())
    };
    let w = dimension("pixelWidth").ok_or("HEIC dimensions unavailable.")?;
    let h = dimension("pixelHeight").ok_or("HEIC dimensions unavailable.")?;
    if w == 0 || h == 0 || w > 8192 || h > 8192 || w * h > 32_000_000 {
        return Err("HEIC exceeds 8192 pixels or 32 megapixels.".into());
    }
    let result = std::process::Command::new("/usr/bin/sips")
        .args(["-s", "format", "png"])
        .arg(&input)
        .arg("--out")
        .arg(&output)
        .output()
        .map_err(|e| e.to_string())?;
    if !result.status.success() {
        return Err("HEIC could not be decoded.".into());
    }
    if fs::metadata(&output).map_err(|e| e.to_string())?.len() > 16_500_000 {
        return Err("Decoded HEIC preview is too large. Import a JPEG copy instead.".into());
    }
    let png = fs::read(output).map_err(|e| e.to_string())?;
    Ok(format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(png)
    ))
}

fn main() {
    tauri::Builder::default()
        .manage(Files::default())
        .manage(ExitApproval::default())
        .menu(|app| {
            Menu::with_items(
                app,
                &[
                    &Submenu::with_items(
                        app,
                        "Form Studio",
                        true,
                        &[
                            &PredefinedMenuItem::about(app, None, None)?,
                            &PredefinedMenuItem::separator(app)?,
                            &MenuItem::with_id(
                                app,
                                "request-quit",
                                "Quit Form Studio",
                                true,
                                Some("CmdOrCtrl+Q"),
                            )?,
                        ],
                    )?,
                    &Submenu::with_items(
                        app,
                        "Edit",
                        true,
                        &[
                            &MenuItem::with_id(
                                app,
                                "studio-undo",
                                "Undo",
                                true,
                                Some("CmdOrCtrl+Z"),
                            )?,
                            &MenuItem::with_id(
                                app,
                                "studio-redo",
                                "Redo",
                                true,
                                Some("CmdOrCtrl+Shift+Z"),
                            )?,
                            &PredefinedMenuItem::separator(app)?,
                            &PredefinedMenuItem::cut(app, None)?,
                            &PredefinedMenuItem::copy(app, None)?,
                            &PredefinedMenuItem::paste(app, None)?,
                            &PredefinedMenuItem::select_all(app, None)?,
                        ],
                    )?,
                    &Submenu::with_items(
                        app,
                        "Window",
                        true,
                        &[
                            &PredefinedMenuItem::minimize(app, None)?,
                            &PredefinedMenuItem::maximize(app, None)?,
                            &PredefinedMenuItem::close_window(app, None)?,
                        ],
                    )?,
                ],
            )
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "request-quit" => {
                let _ = app.emit("app-quit-requested", ());
            }
            "studio-undo" => {
                let _ = app.emit("editor-history", "undo");
            }
            "studio-redo" => {
                let _ = app.emit("editor-history", "redo");
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            open_project,
            save_project,
            save_review,
            close_app,
            decode_heic
        ])
        .build(tauri::generate_context!())
        .expect("Form Studio could not start")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                if !app.state::<ExitApproval>().0.load(Ordering::SeqCst) {
                    api.prevent_exit();
                    let _ = app.emit("app-quit-requested", ());
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn replacing_project_is_complete() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("study.formstudio");
        atomic_write(&path, b"first").unwrap();
        atomic_write(&path, b"second complete content").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"second complete content");
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }
    #[test]
    fn failed_replacement_preserves_destination() {
        let dir = tempfile::tempdir().unwrap();
        let destination = dir.path().join("existing");
        fs::create_dir(&destination).unwrap();
        fs::write(destination.join("previous"), b"keep").unwrap();
        assert!(atomic_write(&destination, b"bad").is_err());
        assert_eq!(fs::read(destination.join("previous")).unwrap(), b"keep");
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }
    #[test]
    fn malformed_heic_is_rejected() {
        assert!(decode_heic_local("garbage").is_err());
        assert!(decode_heic_local("aGVsbG8=").is_err());
    }
    #[test]
    #[ignore = "Local reference files are deliberately not bundled"]
    fn supplied_heic_references_decode() {
        let directory =
            std::env::var("FORM_STUDIO_REFERENCE_DIR").expect("Set local reference folder");
        for name in ["IMG_5426.HEIC", "IMG_5456.HEIC"] {
            let path = std::path::Path::new(&directory).join(name);
            let original = fs::read(&path).unwrap();
            let encoded = base64::engine::general_purpose::STANDARD.encode(&original);
            let decoded = decode_heic_local(&encoded).unwrap();
            let png = base64::engine::general_purpose::STANDARD
                .decode(decoded.split(',').nth(1).unwrap())
                .unwrap();
            assert!(png.starts_with(b"\x89PNG\r\n\x1a\n"));
            assert_eq!(u32::from_be_bytes(png[16..20].try_into().unwrap()), 4032);
            assert_eq!(u32::from_be_bytes(png[20..24].try_into().unwrap()), 3024);
            assert_eq!(fs::read(&path).unwrap(), original);
            println!(
                "{name}: {} original bytes, {} preview bytes",
                original.len(),
                png.len()
            );
        }
    }
    #[test]
    fn invalid_projects_are_rejected() {
        assert!(validate_envelope("not json").is_err());
        assert!(validate_envelope(r#"{"format":"form-studio","version":99}"#).is_err());
        assert!(validate_envelope(r#"{"format":"form-studio","version":1}"#).is_ok());
        assert!(validate_envelope(r#"{"format":"form-studio","version":2}"#).is_ok());
        assert!(validate_envelope(r#"{"format":"form-studio","version":3}"#).is_ok());
        assert!(validate_envelope(r#"{"format":"form-studio","version":4}"#).is_ok());
        assert!(validate_envelope(r#"{"format":"form-studio","version":5}"#).is_ok());
    }
}
