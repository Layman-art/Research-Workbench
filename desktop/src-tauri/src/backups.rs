use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqliteConnectOptions, Connection, Row, SqliteConnection};
use std::{
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, State};

#[derive(Default)]
pub struct BackupState(pub tauri::async_runtime::Mutex<()>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    name: String,
    bytes: u64,
    created_at: u64,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub fn data_directory(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&directory).map_err(|e| format!("无法创建数据目录：{e}"))?;
    Ok(directory)
}

async fn connect(path: &Path, read_only: bool) -> Result<SqliteConnection, String> {
    SqliteConnection::connect_with(
        &SqliteConnectOptions::new()
            .filename(path)
            .read_only(read_only)
            .create_if_missing(false)
            .busy_timeout(Duration::from_secs(10)),
    )
    .await
    .map_err(|e| format!("无法读取数据库：{e}"))
}

pub async fn validate_database(path: &Path) -> Result<(), String> {
    let mut db = connect(path, true).await?;
    let check: String = sqlx::query_scalar("PRAGMA quick_check")
        .fetch_one(&mut db)
        .await
        .map_err(|e| format!("数据库校验失败：{e}"))?;
    if check != "ok" {
        return Err(format!("数据库校验失败：{check}"));
    }
    let tables: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('records','types','workspaces','settings')")
        .fetch_one(&mut db).await.map_err(|e| e.to_string())?;
    if tables != 4 {
        return Err("不是完整的科研工作台数据库".into());
    }
    db.close().await.map_err(|e| e.to_string())
}

fn list_at(directory: &Path) -> Result<Vec<BackupInfo>, String> {
    let backup_dir = directory.join("backups");
    if !backup_dir.exists() {
        return Ok(vec![]);
    }
    let mut backups = Vec::new();
    for item in std::fs::read_dir(backup_dir).map_err(|e| e.to_string())? {
        let item = item.map_err(|e| e.to_string())?;
        let name = item.file_name().to_string_lossy().into_owned();
        if !name.starts_with("workbench-") || !name.ends_with(".sqlite") {
            continue;
        }
        let metadata = item.metadata().map_err(|e| e.to_string())?;
        if !metadata.is_file() {
            continue;
        }
        let created_at = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        backups.push(BackupInfo {
            name,
            bytes: metadata.len(),
            created_at,
        });
    }
    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(backups)
}

pub async fn create_at(directory: &Path, reason: &str) -> Result<BackupInfo, String> {
    if reason.is_empty()
        || reason.len() > 40
        || !reason
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'-')
    {
        return Err("备份名称无效".into());
    }
    if reason.starts_with("daily-") {
        if let Some(existing) = list_at(directory)?
            .into_iter()
            .find(|b| b.name.contains(&format!("-{reason}-")))
        {
            validate_database(&directory.join("backups").join(&existing.name)).await?;
            return Ok(existing);
        }
    }
    let source = directory.join("research-workbench.db");
    validate_database(&source).await?;
    let folder = directory.join("backups");
    std::fs::create_dir_all(&folder).map_err(|e| format!("无法创建备份目录：{e}"))?;
    let timestamp = now_ms();
    let name = format!("workbench-{reason}-{timestamp}.sqlite");
    let temporary = folder.join(format!("{name}.partial"));
    let destination = folder.join(&name);
    let mut db = connect(&source, false).await?;
    // VACUUM INTO includes committed WAL data and produces a consistent independent database.
    let result = sqlx::query("VACUUM INTO ?")
        .bind(temporary.to_string_lossy().as_ref())
        .execute(&mut db)
        .await;
    db.close().await.map_err(|e| e.to_string())?;
    if let Err(error) = result {
        let _ = std::fs::remove_file(&temporary);
        return Err(format!("备份写入失败，原数据未改变：{error}"));
    }
    validate_database(&temporary).await?;
    std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(&temporary)
        .and_then(|f| f.sync_all())
        .map_err(|e| e.to_string())?;
    std::fs::rename(&temporary, &destination).map_err(|e| e.to_string())?;
    let bytes = std::fs::metadata(destination)
        .map_err(|e| e.to_string())?
        .len();
    // Rotate only verified backups created by this application, keeping the newest 30.
    for old in list_at(directory)?.into_iter().skip(30) {
        std::fs::remove_file(folder.join(old.name))
            .map_err(|e| format!("备份已完成，旧备份清理失败：{e}"))?;
    }
    Ok(BackupInfo {
        name,
        bytes,
        created_at: timestamp,
    })
}

fn backup_path(directory: &Path, name: &str) -> Result<PathBuf, String> {
    if !name.starts_with("workbench-") || !name.ends_with(".sqlite") || name.contains(['/', '\\']) {
        return Err("备份文件名无效".into());
    }
    let folder = directory
        .join("backups")
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let path = folder
        .join(name)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    if path.parent() != Some(folder.as_path()) {
        return Err("备份路径无效".into());
    }
    Ok(path)
}

#[derive(Serialize, Deserialize)]
struct RestoreRequest {
    token: String,
}

fn sync_file(path: &Path) -> Result<(), String> {
    std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(path)
        .and_then(|file| file.sync_all())
        .map_err(|e| e.to_string())
}

async fn stage_restore(directory: &Path, name: &str) -> Result<(), String> {
    let request_path = directory.join("restore-request.json");
    if request_path.exists() {
        return Err("已有待恢复的备份，请先重启完成恢复".into());
    }
    let source = backup_path(directory, name)?;
    validate_database(&source).await?;
    let token = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos()
        .to_string();
    let staging = directory.join(format!("restore-{token}.sqlite"));
    // Copy before rotation: choosing the oldest backup must remain safe.
    std::fs::copy(source, &staging).map_err(|e| e.to_string())?;
    sync_file(&staging)?;
    validate_database(&staging).await?;
    // A corrupt source database must not prevent recovery. Its raw files are
    // preserved together at startup before any of them can be removed.
    let _ = create_at(directory, "before-restore").await;
    let temporary = directory.join("restore-request.tmp");
    std::fs::write(
        &temporary,
        serde_json::to_vec(&RestoreRequest { token }).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    sync_file(&temporary)?;
    std::fs::rename(temporary, request_path).map_err(|e| e.to_string())
}

pub async fn prepare_database(directory: &Path) -> Result<(), String> {
    let request = directory.join("restore-request.json");
    let destination = directory.join("research-workbench.db");
    if request.exists() {
        let restore: RestoreRequest =
            serde_json::from_slice(&std::fs::read(&request).map_err(|e| e.to_string())?)
                .map_err(|e| format!("恢复请求无效：{e}"))?;
        if restore.token.is_empty() || !restore.token.bytes().all(|c| c.is_ascii_digit()) {
            return Err("恢复请求路径无效".into());
        }
        let source = directory.join(format!("restore-{}.sqlite", restore.token));
        validate_database(&source).await?;
        let pending = directory.join("restore-pending.tmp");
        std::fs::copy(&source, &pending).map_err(|e| e.to_string())?;
        sync_file(&pending)?;
        let recovery = directory.join(format!("pre-restore-{}", restore.token));
        std::fs::create_dir_all(&recovery).map_err(|e| e.to_string())?;
        let preserved = recovery.join("complete");
        // This runs before SQL opens any connection. Keep the entire original
        // DB/WAL/SHM set, including corrupt bytes, outside backup rotation.
        // The marker makes a partially completed replacement safely retryable.
        if !preserved.exists() {
            for name in [
                "research-workbench.db",
                "research-workbench.db-wal",
                "research-workbench.db-shm",
            ] {
                let original = directory.join(name);
                if original.exists() {
                    let copy = recovery.join(name);
                    std::fs::copy(original, &copy).map_err(|e| e.to_string())?;
                    sync_file(&copy)?;
                }
            }
            std::fs::write(&preserved, b"preserved").map_err(|e| e.to_string())?;
            sync_file(&preserved)?;
        }
        for name in [
            "research-workbench.db",
            "research-workbench.db-wal",
            "research-workbench.db-shm",
        ] {
            let original = directory.join(name);
            if original.exists() {
                std::fs::remove_file(original).map_err(|e| e.to_string())?;
            }
        }
        std::fs::rename(pending, &destination).map_err(|e| e.to_string())?;
        validate_database(&destination).await?;
        std::fs::remove_file(request).map_err(|e| e.to_string())?;
        let _ = std::fs::remove_file(source);
    }
    if destination.exists()
        && std::fs::metadata(&destination)
            .map_err(|e| e.to_string())?
            .len()
            > 0
    {
        let mut db = connect(&destination, true).await?;
        let exists: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE name='schema_migrations'")
                .fetch_one(&mut db)
                .await
                .map_err(|e| e.to_string())?;
        if exists != 0 {
            let row =
                sqlx::query("SELECT COALESCE(MAX(version),0) AS version FROM schema_migrations")
                    .fetch_one(&mut db)
                    .await
                    .map_err(|e| e.to_string())?;
            let version: i64 = row.get("version");
            db.close().await.map_err(|e| e.to_string())?;
            if version < 2 {
                create_at(directory, "before-v2-migration").await?;
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn create_backup(
    app: AppHandle,
    state: State<'_, BackupState>,
    reason: String,
) -> Result<BackupInfo, String> {
    let _guard = state.0.lock().await;
    create_at(&data_directory(&app)?, &reason).await
}

#[tauri::command]
pub fn list_backups(app: AppHandle) -> Result<Vec<BackupInfo>, String> {
    list_at(&data_directory(&app)?)
}

#[tauri::command]
pub async fn restore_backup(
    app: AppHandle,
    state: State<'_, BackupState>,
    name: String,
) -> Result<(), String> {
    let _guard = state.0.lock().await;
    let directory = data_directory(&app)?;
    stage_restore(&directory, &name).await
}

#[tauri::command]
pub fn storage_info(app: AppHandle) -> Result<serde_json::Value, String> {
    let directory = data_directory(&app)?;
    let backups = list_at(&directory)?;
    let bytes: u64 = ["research-workbench.db", "research-workbench.db-wal"]
        .iter()
        .filter_map(|name| std::fs::metadata(directory.join(name)).ok())
        .map(|m| m.len())
        .sum();
    Ok(
        serde_json::json!({"directory": directory.to_string_lossy(), "databaseBytes": bytes,
        "backupBytes": backups.iter().map(|b| b.bytes).sum::<u64>(), "backups": backups}),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backup_is_consistent_includes_wal_and_survives_restart_restore() {
        tauri::async_runtime::block_on(async {
            let directory =
                std::env::temp_dir().join(format!("rw-backup-{}-{}", std::process::id(), now_ms()));
            std::fs::create_dir_all(&directory).unwrap();
            let source = directory.join("research-workbench.db");
            let mut db = SqliteConnection::connect_with(
                &SqliteConnectOptions::new()
                    .filename(&source)
                    .create_if_missing(true),
            )
            .await
            .unwrap();
            sqlx::query("PRAGMA journal_mode=WAL")
                .execute(&mut db)
                .await
                .unwrap();
            for table in ["records", "types", "workspaces", "settings"] {
                sqlx::query(&format!("CREATE TABLE {table} (id TEXT PRIMARY KEY)"))
                    .execute(&mut db)
                    .await
                    .unwrap();
            }
            sqlx::query("INSERT INTO records VALUES ('saved-note')")
                .execute(&mut db)
                .await
                .unwrap();
            let backup = create_at(&directory, "manual").await.unwrap();
            sqlx::query("DELETE FROM records")
                .execute(&mut db)
                .await
                .unwrap();
            db.close().await.unwrap();
            stage_restore(&directory, &backup.name).await.unwrap();
            prepare_database(&directory).await.unwrap();
            let mut reopened = connect(&source, true).await.unwrap();
            let id: String = sqlx::query_scalar("SELECT id FROM records")
                .fetch_one(&mut reopened)
                .await
                .unwrap();
            assert_eq!(id, "saved-note");
            reopened.close().await.unwrap();
            assert!(backup_path(&directory, "../outside.sqlite").is_err());
            std::fs::remove_dir_all(directory).unwrap();
        });
    }
    #[test]
    fn recovery_preserves_corrupt_files_and_staging_survives_rotation_and_retry() {
        tauri::async_runtime::block_on(async {
            let directory = std::env::temp_dir().join(format!(
                "rw-recovery-{}-{}",
                std::process::id(),
                now_ms()
            ));
            std::fs::create_dir_all(&directory).unwrap();
            let source = directory.join("research-workbench.db");
            let mut db = SqliteConnection::connect_with(
                &SqliteConnectOptions::new()
                    .filename(&source)
                    .create_if_missing(true),
            )
            .await
            .unwrap();
            for table in ["records", "types", "workspaces", "settings"] {
                sqlx::query(&format!("CREATE TABLE {table} (id TEXT PRIMARY KEY)"))
                    .execute(&mut db)
                    .await
                    .unwrap();
            }
            sqlx::query("INSERT INTO records VALUES ('recover-me')")
                .execute(&mut db)
                .await
                .unwrap();
            db.close().await.unwrap();
            let backup = create_at(&directory, "manual").await.unwrap();
            std::fs::write(&source, b"corrupt original database").unwrap();
            stage_restore(&directory, &backup.name).await.unwrap();
            assert!(stage_restore(&directory, &backup.name).await.is_err());
            // Simulate rotation of the selected source after staging.
            std::fs::remove_file(directory.join("backups").join(&backup.name)).unwrap();
            let request_bytes = std::fs::read(directory.join("restore-request.json")).unwrap();
            let request: RestoreRequest = serde_json::from_slice(&request_bytes).unwrap();
            let staging = directory.join(format!("restore-{}.sqlite", request.token));
            let staged_bytes = std::fs::read(&staging).unwrap();
            std::fs::write(directory.join("research-workbench.db-wal"), b"original wal").unwrap();
            std::fs::write(directory.join("research-workbench.db-shm"), b"original shm").unwrap();
            prepare_database(&directory).await.unwrap();
            let recovery = directory.join(format!("pre-restore-{}", request.token));
            assert_eq!(
                std::fs::read(recovery.join("research-workbench.db")).unwrap(),
                b"corrupt original database"
            );
            assert_eq!(
                std::fs::read(recovery.join("research-workbench.db-wal")).unwrap(),
                b"original wal"
            );
            assert_eq!(
                std::fs::read(recovery.join("research-workbench.db-shm")).unwrap(),
                b"original shm"
            );
            // Simulate a restart after installation but before request cleanup.
            std::fs::write(&staging, staged_bytes).unwrap();
            std::fs::write(directory.join("restore-request.json"), request_bytes).unwrap();
            prepare_database(&directory).await.unwrap();
            assert_eq!(
                std::fs::read(recovery.join("research-workbench.db")).unwrap(),
                b"corrupt original database"
            );
            let mut reopened = connect(&source, true).await.unwrap();
            let id: String = sqlx::query_scalar("SELECT id FROM records")
                .fetch_one(&mut reopened)
                .await
                .unwrap();
            assert_eq!(id, "recover-me");
            reopened.close().await.unwrap();
            std::fs::remove_dir_all(directory).unwrap();
        });
    }
}
