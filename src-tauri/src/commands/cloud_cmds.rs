use crate::SnapzyResult;

use crate::cloud::{create_provider, CloudConfig};

/// Upload raw file bytes to a configured cloud provider.
///
/// Returns the publicly accessible URL of the uploaded file.
#[tauri::command]
pub async fn upload_file_cmd(
    config: CloudConfig,
    data: Vec<u8>,
    filename: String,
    content_type: String,
) -> SnapzyResult<String> {
    let provider = create_provider(config);
    provider.upload(&data, &filename, &content_type).await
}
