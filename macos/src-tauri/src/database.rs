use serde::Deserialize;
use serde_json::Value;
use sqlx::{sqlite::SqliteConnectOptions, Connection, SqliteConnection};
use std::str::FromStr;
use tauri::{AppHandle, Manager};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SqlStatement {
    sql: String,
    params: Vec<Value>,
}

pub fn database_url(app: &AppHandle) -> Result<String, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法定位应用数据目录：{error}"))?;
    std::fs::create_dir_all(&directory)
        .map_err(|error| format!("无法创建应用数据目录：{error}"))?;
    let path = directory.join("research-workbench.db");
    Ok(format!("sqlite:{}", path.to_string_lossy()))
}

#[tauri::command]
pub fn get_database_url(app: AppHandle) -> Result<String, String> {
    database_url(&app)
}

pub async fn execute_transaction_at(
    database_url: &str,
    statements: Vec<SqlStatement>,
) -> Result<(), String> {
    let options = SqliteConnectOptions::from_str(database_url)
        .map_err(|error| format!("无效的数据库路径：{error}"))?
        .create_if_missing(true)
        .foreign_keys(true);
    let mut connection = SqliteConnection::connect_with(&options)
        .await
        .map_err(|error| format!("无法连接数据库：{error}"))?;
    let mut transaction = connection
        .begin()
        .await
        .map_err(|error| format!("无法开始事务：{error}"))?;

    for statement in statements {
        let mut query = sqlx::query(&statement.sql);
        for value in statement.params {
            query = match value {
                Value::Null => query.bind(Option::<String>::None),
                Value::Bool(value) => query.bind(if value { 1_i64 } else { 0_i64 }),
                Value::Number(value) => {
                    if let Some(value) = value.as_i64() {
                        query.bind(value)
                    } else if let Some(value) = value.as_u64() {
                        let value = i64::try_from(value)
                            .map_err(|_| "SQL 整数参数超出 i64 范围".to_string())?;
                        query.bind(value)
                    } else {
                        query.bind(value.as_f64().unwrap_or_default())
                    }
                }
                Value::String(value) => query.bind(value),
                Value::Array(_) | Value::Object(_) => query.bind(value.to_string()),
            };
        }
        query
            .execute(&mut *transaction)
            .await
            .map_err(|error| format!("事务语句执行失败：{error}"))?;
    }

    transaction
        .commit()
        .await
        .map_err(|error| format!("无法提交事务：{error}"))
}

#[tauri::command]
pub async fn execute_transaction(
    app: AppHandle,
    statements: Vec<SqlStatement>,
) -> Result<(), String> {
    execute_transaction_at(&database_url(&app)?, statements).await
}

#[cfg(test)]
mod tests {
    use super::{execute_transaction_at, SqlStatement};
    use sqlx::{Connection, Row, SqliteConnection};
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn transaction_rolls_back_every_statement_after_failure() {
        tauri::async_runtime::block_on(async {
            let unique = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock")
                .as_nanos();
            let path = std::env::temp_dir().join(format!(
                "research-workbench-{}-{unique}.db",
                std::process::id()
            ));
            std::fs::File::create(&path).expect("create test database");
            let url = format!("sqlite:{}", path.to_string_lossy());
            let mut connection = SqliteConnection::connect(&url).await.expect("connect");
            sqlx::query("CREATE TABLE items (id TEXT PRIMARY KEY)")
                .execute(&mut connection)
                .await
                .expect("create table");
            drop(connection);

            let result = execute_transaction_at(
                &url,
                vec![
                    SqlStatement {
                        sql: "INSERT INTO items (id) VALUES (?)".into(),
                        params: vec![serde_json::json!("first")],
                    },
                    SqlStatement {
                        sql: "INSERT INTO missing_table (id) VALUES (?)".into(),
                        params: vec![serde_json::json!("second")],
                    },
                ],
            )
            .await;
            assert!(result.is_err());

            let mut connection = SqliteConnection::connect(&url).await.expect("reconnect");
            let count: i64 = sqlx::query("SELECT COUNT(*) AS count FROM items")
                .fetch_one(&mut connection)
                .await
                .expect("count")
                .get("count");
            assert_eq!(count, 0);
            drop(connection);
            std::fs::remove_file(path).expect("remove test database");
        });
    }
}
