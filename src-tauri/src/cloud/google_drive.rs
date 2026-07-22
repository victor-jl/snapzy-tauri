use async_trait::async_trait;
use serde::Deserialize;

use super::{CloudProvider, GoogleDriveConfig};
use crate::SnapzyError;

/// Response from the OAuth2 token endpoint.
#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    // token_type: String,   // Bearer
    // expires_in: u64,
}

/// Response from the Drive API file-creation endpoint.
#[derive(Deserialize)]
struct DriveFile {
    id: String,
    // name: String,
    web_view_link: Option<String>,
}

/// Google Drive upload provider using the Drive API v3.
pub struct GoogleDriveProvider {
    config: GoogleDriveConfig,
    client: reqwest::Client,
}

impl GoogleDriveProvider {
    pub fn new(config: GoogleDriveConfig) -> Self {
        Self {
            config,
            client: reqwest::Client::new(),
        }
    }

    /// Exchange the refresh token for an access token.
    async fn get_access_token(&self) -> Result<String, SnapzyError> {
        let resp = self
            .client
            .post("https://oauth2.googleapis.com/token")
            .form(&[
                ("client_id", self.config.client_id.as_str()),
                ("client_secret", self.config.client_secret.as_str()),
                ("refresh_token", self.config.refresh_token.as_str()),
                ("grant_type", "refresh_token"),
            ])
            .send()
            .await
            .map_err(|e| SnapzyError::General(format!("Google OAuth2 request failed: {e}")))?;

        let status = resp.status();
        let body = resp.text().await.map_err(|e| {
            SnapzyError::General(format!("Failed to read OAuth2 response body: {e}"))
        })?;

        if !status.is_success() {
            return Err(SnapzyError::General(format!(
                "Google OAuth2 token refresh failed (HTTP {status}): {body}"
            )));
        }

        let token: TokenResponse = serde_json::from_str(&body).map_err(|e| {
            SnapzyError::General(format!("Failed to parse OAuth2 token response: {e}"))
        })?;

        Ok(token.access_token)
    }
}

#[async_trait]
impl CloudProvider for GoogleDriveProvider {
    async fn upload(
        &self,
        data: &[u8],
        filename: &str,
        content_type: &str,
    ) -> Result<String, SnapzyError> {
        let access_token = self.get_access_token().await?;

        // Build the multipart upload body.
        // Part 1: metadata JSON.
        let metadata = serde_json::json!({
            "name": filename,
            "parents": [&self.config.folder_id],
        });

        // Construct the multipart boundary.
        let boundary = format!("snapzy_boundary_{}", uuid::Uuid::new_v4());
        let sep = format!("\r\n--{}\r\n", boundary);
        let closing = format!("\r\n--{}--\r\n", boundary);

        let mut body = Vec::new();
        // Metadata part.
        body.extend_from_slice(sep.as_bytes());
        body.extend_from_slice(b"Content-Type: application/json; charset=UTF-8\r\n\r\n");
        body.extend_from_slice(metadata.to_string().as_bytes());
        // Media part.
        body.extend_from_slice(sep.as_bytes());
        body.extend_from_slice(
            format!("Content-Type: {content_type}\r\n\r\n").as_bytes(),
        );
        body.extend_from_slice(data);
        body.extend_from_slice(closing.as_bytes());

        let resp = self
            .client
            .post("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink")
            .header("Authorization", format!("Bearer {access_token}"))
            .header(
                "Content-Type",
                format!("multipart/related; boundary={boundary}"),
            )
            .body(body)
            .send()
            .await
            .map_err(|e| {
                SnapzyError::General(format!("Google Drive upload request failed: {e}"))
            })?;

        let status = resp.status();
        let resp_body = resp.text().await.map_err(|e| {
            SnapzyError::General(format!("Failed to read Drive upload response: {e}"))
        })?;

        if !status.is_success() {
            return Err(SnapzyError::General(format!(
                "Google Drive upload failed (HTTP {status}): {resp_body}"
            )));
        }

        let file: DriveFile = serde_json::from_str(&resp_body).map_err(|e| {
            SnapzyError::General(format!("Failed to parse Drive file response: {e}"))
        })?;

        let public_url = file.web_view_link.unwrap_or_else(|| {
            format!(
                "https://drive.google.com/file/d/{}/view",
                file.id
            )
        });

        log::info!("Uploaded to Google Drive: {public_url} (file id: {})", file.id);
        Ok(public_url)
    }
}
