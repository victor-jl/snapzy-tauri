use async_trait::async_trait;
use aws_sdk_s3::config::{Credentials, Region};
use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::Client;

use super::{CloudProvider, R2Config};
use crate::SnapzyError;

/// Cloudflare R2 upload provider.
///
/// R2 exposes an S3-compatible API, so we reuse `aws-sdk-s3` pointed at the
/// R2 endpoint (`https://<account_id>.r2.cloudflarestorage.com`).
pub struct R2Provider {
    client: Client,
    config: R2Config,
}

impl R2Provider {
    pub fn new(config: R2Config) -> Self {
        let endpoint = format!(
            "https://{}.r2.cloudflarestorage.com",
            config.account_id
        );

        let credentials = Credentials::new(
            &config.access_key_id,
            &config.secret_access_key,
            None,
            None,
            "snapzy-r2",
        );

        let sdk_config = aws_sdk_s3::Config::builder()
            .region(Region::new("auto"))
            .endpoint_url(&endpoint)
            .credentials_provider(credentials)
            .behavior_version(aws_sdk_s3::config::BehaviorVersion::latest())
            .build();

        let client = Client::from_conf(sdk_config);

        Self { client, config }
    }
}

#[async_trait]
impl CloudProvider for R2Provider {
    async fn upload(
        &self,
        data: &[u8],
        filename: &str,
        content_type: &str,
    ) -> Result<String, SnapzyError> {
        let body = ByteStream::from(data.to_vec());

        self.client
            .put_object()
            .bucket(&self.config.bucket)
            .key(filename)
            .body(body)
            .content_type(content_type)
            .send()
            .await
            .map_err(|e| {
                SnapzyError::General(format!("R2 upload failed: {e}"))
            })?;

        // Build the public URL.
        // If a custom public URL is set, use it; otherwise default to R2's
        // dev.r2.dev URL (only works if the bucket has public access enabled).
        let url = match &self.config.public_url_prefix {
            Some(prefix) => {
                format!(
                    "{}/{}/{}",
                    prefix.trim_end_matches('/'),
                    self.config.bucket,
                    filename
                )
            }
            None => {
                format!(
                    "https://pub-{}.r2.dev/{}/{}",
                    self.config.account_id,
                    self.config.bucket,
                    filename
                )
            }
        };

        log::info!("Uploaded to R2: {url}");
        Ok(url)
    }
}
