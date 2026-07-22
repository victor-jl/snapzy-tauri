pub mod s3;
pub mod r2;
pub mod google_drive;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::SnapzyError;

/// Trait for cloud storage providers.
/// Each provider uploads raw bytes and returns the public URL of the uploaded file.
#[async_trait]
pub trait CloudProvider: Send + Sync {
    /// Upload data to the cloud provider.
    /// Returns the publicly accessible URL of the uploaded file.
    async fn upload(
        &self,
        data: &[u8],
        filename: &str,
        content_type: &str,
    ) -> Result<String, SnapzyError>;
}

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

/// Amazon S3 configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct S3Config {
    pub endpoint: String,
    pub region: String,
    pub bucket: String,
    pub access_key: String,
    pub secret_key: String,
    /// Optional: custom public URL prefix (e.g. for CDN).
    pub public_url_prefix: Option<String>,
}

/// Cloudflare R2 configuration (S3-compatible).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct R2Config {
    pub account_id: String,
    pub access_key_id: String,
    pub secret_access_key: String,
    pub bucket: String,
    /// Optional: custom public URL prefix / custom domain for the bucket.
    pub public_url_prefix: Option<String>,
}

/// Google Drive upload configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleDriveConfig {
    pub client_id: String,
    pub client_secret: String,
    pub refresh_token: String,
    /// ID of the parent folder in Drive (optional; root if omitted).
    pub folder_id: String,
}

/// Cloud provider configuration – pick exactly one variant.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CloudConfig {
    S3(S3Config),
    R2(R2Config),
    GoogleDrive(GoogleDriveConfig),
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/// Create a boxed `CloudProvider` from a `CloudConfig`.
pub fn create_provider(config: CloudConfig) -> Box<dyn CloudProvider + Send> {
    match config {
        CloudConfig::S3(cfg) => Box::new(s3::S3Provider::new(cfg)),
        CloudConfig::R2(cfg) => Box::new(r2::R2Provider::new(cfg)),
        CloudConfig::GoogleDrive(cfg) => Box::new(google_drive::GoogleDriveProvider::new(cfg)),
    }
}
