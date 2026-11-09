//! Native-only credential use. Only the fixed read-only balance endpoint is exposed.
use serde::Serialize;
use std::{fs, path::Path, time::Duration};
use tauri::Manager;

#[derive(Debug, Serialize)]
pub struct TripoAccount {
    connected: bool,
    balance: f64,
    frozen: f64,
}
fn read_key(path: &Path) -> Result<String, String> {
    let metadata = fs::metadata(path).map_err(|_| "No saved Tripo key. Run scripts/setup-tripo.py in Terminal.".to_string())?;
    if metadata.len() > 4096 { return Err("Saved Tripo key is invalid.".into()); }
    let key = fs::read_to_string(path).map_err(|_| "Cannot read the saved Tripo key.".to_string())?;
    let key = key.trim();
    if key.starts_with("tcli_") { return Err("The saved value is a Client ID, not an API key. Run setup-tripo.py with the secret API key.".into()); }
    if key.is_empty() || key.chars().any(char::is_whitespace) { return Err("Saved Tripo key is invalid.".into()); }
    Ok(key.to_owned())
}
fn parse_account(value: serde_json::Value) -> Result<TripoAccount, String> {
    let invalid = || "Tripo returned an invalid account response.".to_string();
    if value["code"].as_i64() != Some(0) { return Err(invalid()); }
    let balance = value["data"]["balance"].as_f64().filter(|n| n.is_finite()).ok_or_else(invalid)?;
    let frozen = value["data"]["frozen"].as_f64().filter(|n| n.is_finite()).ok_or_else(invalid)?;
    Ok(TripoAccount { connected: true, balance, frozen })
}
async fn query_balance(key: &str) -> Result<TripoAccount, String> {
    let client = reqwest::Client::builder()
        .https_only(true).redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(25)).build()
        .map_err(|_| "Could not initialize the secure Tripo connection.".to_string())?;
    let mut authorization = reqwest::header::HeaderValue::from_str(&format!("Bearer {key}"))
        .map_err(|_| "Saved Tripo key is invalid.".to_string())?;
    authorization.set_sensitive(true);
    let mut response = client.get("https://openapi.tripo3d.ai/v3/account/balance")
        .header(reqwest::header::AUTHORIZATION, authorization).send().await
        .map_err(|_| "Could not reach Tripo. Check your connection and retry.".to_string())?;
    if response.status().as_u16() == 401 || response.status().as_u16() == 403 {
        return Err("Tripo rejected the key. Save the secret API key using setup-tripo.py and try again.".into());
    }
    if !response.status().is_success() { return Err(format!("Tripo account check returned HTTP {}. Try again later.",response.status().as_u16())); }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "Could not read Tripo's response.".to_string())? {
        if bytes.len() + chunk.len() > 65536 { return Err("Tripo account response exceeded the size limit.".into()); }
        bytes.extend_from_slice(&chunk);
    }
    parse_account(serde_json::from_slice(&bytes).map_err(|_| "Tripo returned an invalid account response.".to_string())?)
}
#[tauri::command]
pub async fn tripo_account(app: tauri::AppHandle) -> Result<TripoAccount, String> {
    let path = app.path().home_dir().map_err(|_| "Cannot locate your home folder.".to_string())?
        .join(".config/form-studio/tripo-api-key");
    let key = read_key(&path)?;
    query_balance(&key).await
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validates_balance_without_returning_other_fields() {
        let result = parse_account(serde_json::json!({"code":0,"data":{"balance":0,"frozen":12.5,"private":"omit"}})).unwrap();
        assert_eq!(result.balance,0.0);assert_eq!(result.frozen,12.5);
        assert_eq!(serde_json::to_value(result).unwrap(),serde_json::json!({"connected":true,"balance":0.0,"frozen":12.5}));
        for value in [serde_json::json!({"code":1,"data":{"balance":10,"frozen":0}}),serde_json::json!({"code":0,"data":{"balance":"10","frozen":0}}),serde_json::json!({"code":0,"data":{"balance":10}})] {
            assert!(parse_account(value).is_err());
        }
    }
    #[test]
    fn client_ids_and_invalid_files_are_rejected_locally() {
        let folder=tempfile::tempdir().unwrap();let path=folder.path().join("key");
        assert!(read_key(&path).is_err());
        for input in ["tcli_test-fixture","","not a key",&"x".repeat(4097)] {
            fs::write(&path,input).unwrap();assert!(read_key(&path).is_err());
        }
    }
    #[test]
    #[ignore = "Explicit read-only live verification; uses the user's local credential"]
    fn live_account_check() {
        let path=std::path::PathBuf::from(std::env::var("HOME").unwrap()).join(".config/form-studio/tripo-api-key");
        let key=read_key(&path).unwrap();
        let account=tauri::async_runtime::block_on(query_balance(&key)).unwrap();
        assert!(account.connected && account.balance.is_finite());
    }
}
