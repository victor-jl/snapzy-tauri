use async_trait::async_trait;
use aws_sdk_s3::config::{Credentials, Region};
use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::Client;

use super::{CloudProvider, S3Config};
use crate::SnapzyError;

/// Amazon S3 upload provider using `aws-sdk-s3`.
pub struct S3Provider {
    client: Client,
    config: S3Config,
}

impl S3Provider {
    pub fn new(config: S3Config) -> Self {
        let credentials = Credentials::new(
            &config.access_key,
            &config.secret_key,
            None,
            None,
            "snapzy-s3",
        );

        let sdk_config = aws_sdk_s3::Config::builder()
            .region(Region::new(config.region.clone()))
            .endpoint_url(&config.endpoint)
            .credentials_provider(credentials)
            .behavior_version(aws_sdk_s3::config::BehaviorVersion::latest())
            .build();

        let client = Client::from_conf(sdk_config);

        Self { client, config }
    }
}

#[async_trait]
impl CloudProvider for S3Provider {
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
                SnapzyError::General(format!("S3 upload failed: {e}"))
            })?;

        // Build the public URL.
        let url = self
            .config
            .public_url_prefix
            .as_deref()
            .unwrap_or(&self.config.endpoint)
            .trim_end_matches('/');

        let public_url = format!("{}/{}/{}", url, self.config.bucket, filename);

        log::info!("Uploaded to S3: {public_url}");
        Ok(public_url)
    }
}
