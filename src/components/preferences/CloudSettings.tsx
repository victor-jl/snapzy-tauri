import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Cloud as CloudIcon,
  HardDrive,
  CloudLightning,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader,
  Copy,
  Link,
  ChevronDown,
} from "lucide-react";
import { useSettingsStore } from "../../stores/settingsStore";
import { invoke } from "@tauri-apps/api/core";
import styles from "./CloudSettings.module.css";

interface CloudSettingsProps {
  onChange: () => void;
}

interface ProviderConfig {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
}

const providers: ProviderConfig[] = [
  {
    id: "s3",
    name: "Amazon S3",
    icon: <HardDrive size={24} />,
    description: "Amazon Simple Storage Service",
  },
  {
    id: "r2",
    name: "Cloudflare R2",
    icon: <CloudLightning size={24} />,
    description: "S3-compatible object storage",
  },
  {
    id: "google_drive",
    name: "Google Drive",
    icon: <CloudIcon size={24} />,
    description: "Google cloud storage",
  },
];

const CloudSettings: React.FC<CloudSettingsProps> = ({ onChange }) => {
  const { t } = useTranslation();
  const config = useSettingsStore((s) => s.config);
  const updateSection = useSettingsStore((s) => s.updateSection);

  const cloud = config.cloud;
  const creds = cloud.credentials || {};

  const [provider, setProvider] = useState(cloud.provider || "none");
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [uploadHistoryOpen, setUploadHistoryOpen] = useState(false);

  // S3 fields
  const [s3Endpoint, setS3Endpoint] = useState((creds.s3_endpoint as string) || "");
  const [s3Region, setS3Region] = useState((creds.s3_region as string) || "");
  const [s3Bucket, setS3Bucket] = useState((creds.s3_bucket as string) || "");
  const [s3AccessKey, setS3AccessKey] = useState((creds.s3_access_key as string) || "");
  const [s3SecretKey, setS3SecretKey] = useState((creds.s3_secret_key as string) || "");

  // R2 fields
  const [r2AccountId, setR2AccountId] = useState((creds.r2_account_id as string) || "");
  const [r2AccessKey, setR2AccessKey] = useState((creds.r2_access_key as string) || "");
  const [r2SecretKey, setR2SecretKey] = useState((creds.r2_secret_key as string) || "");
  const [r2Bucket, setR2Bucket] = useState((creds.r2_bucket as string) || "");

  // Google Drive fields
  const [driveConnected, setDriveConnected] = useState((creds.drive_connected as boolean) || false);
  const [driveFolder, setDriveFolder] = useState((creds.drive_folder as string) || "");
  const [driveEmail, setDriveEmail] = useState((creds.drive_email as string) || "");

  const [uploadFormat, setUploadFormat] = useState(
    () => (cloud as Record<string, unknown>).upload_format as string || "original"
  );
  const [copyUrlAfterUpload, setCopyUrlAfterUpload] = useState(
    () => (cloud as Record<string, unknown>).copy_url_after_upload as boolean ?? true
  );

  const handleToggleEnabled = useCallback(
    (enabled: boolean) => {
      updateSection("cloud", { enabled });
      onChange();
    },
    [updateSection, onChange]
  );

  const handleProviderChange = useCallback(
    (prov: string) => {
      setProvider(prov);
      updateSection("cloud", { provider: prov });
      onChange();
    },
    [updateSection, onChange]
  );

  const toggleSecretVisibility = useCallback((field: string) => {
    setShowSecrets((prev) => ({ ...prev, [field]: !prev[field] }));
  }, []);

  const handleTestConnection = useCallback(async () => {
    setTestStatus("testing");
    try {
      const credsPayload: Record<string, unknown> = {};
      if (provider === "s3") {
        credsPayload.s3_endpoint = s3Endpoint;
        credsPayload.s3_region = s3Region;
        credsPayload.s3_bucket = s3Bucket;
        credsPayload.s3_access_key = s3AccessKey;
        credsPayload.s3_secret_key = s3SecretKey;
      } else if (provider === "r2") {
        credsPayload.r2_account_id = r2AccountId;
        credsPayload.r2_access_key = r2AccessKey;
        credsPayload.r2_secret_key = r2SecretKey;
        credsPayload.r2_bucket = r2Bucket;
      }

      const result = await invoke<boolean>("test_cloud_connection", {
        provider,
        credentials: credsPayload,
      });

      setTestStatus(result ? "success" : "error");
      // Persist credentials on success
      updateSection("cloud", { credentials: credsPayload });
      onChange();
    } catch {
      setTestStatus("error");
    }
  }, [
    provider,
    s3Endpoint, s3Region, s3Bucket, s3AccessKey, s3SecretKey,
    r2AccountId, r2AccessKey, r2SecretKey, r2Bucket,
    updateSection, onChange,
  ]);

  const handleDriveSignIn = useCallback(async () => {
    try {
      const result = await invoke<{ email: string; folder: string }>("google_drive_sign_in");
      setDriveConnected(true);
      setDriveEmail(result.email || "");
      setDriveFolder(result.folder || "");
      updateSection("cloud", {
        credentials: {
          ...creds,
          drive_connected: true,
          drive_email: result.email,
          drive_folder: result.folder,
        },
      });
      onChange();
    } catch {
      // Sign in failed
    }
  }, [creds, updateSection, onChange]);

  const handleSaveCredentials = useCallback(() => {
    const credsPayload: Record<string, unknown> = {};
    if (provider === "s3") {
      credsPayload.s3_endpoint = s3Endpoint;
      credsPayload.s3_region = s3Region;
      credsPayload.s3_bucket = s3Bucket;
      credsPayload.s3_access_key = s3AccessKey;
      credsPayload.s3_secret_key = s3SecretKey;
    } else if (provider === "r2") {
      credsPayload.r2_account_id = r2AccountId;
      credsPayload.r2_access_key = r2AccessKey;
      credsPayload.r2_secret_key = r2SecretKey;
      credsPayload.r2_bucket = r2Bucket;
    }
    updateSection("cloud", { credentials: credsPayload });
    onChange();
  }, [
    provider,
    s3Endpoint, s3Region, s3Bucket, s3AccessKey, s3SecretKey,
    r2AccountId, r2AccessKey, r2SecretKey, r2Bucket,
    updateSection, onChange,
  ]);

  const handleUploadFormatChange = useCallback(
    (format: string) => {
      setUploadFormat(format);
      updateSection("cloud", { upload_format: format } as Record<string, unknown>);
      onChange();
    },
    [updateSection, onChange]
  );

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>{t("preferences:cloud")}</h2>

      {/* Enable Cloud */}
      <div className={styles.group}>
        <label className={styles.toggle}>
          <div className={styles.toggleInfo}>
            <CloudIcon size={18} />
            <span>{t("preferences:cloudEnabled")}</span>
          </div>
          <input
            type="checkbox"
            className={styles.toggleSwitch}
            checked={cloud.enabled}
            onChange={(e) => handleToggleEnabled(e.target.checked)}
          />
        </label>
      </div>

      {cloud.enabled && (
        <>
          {/* Provider Selection */}
          <div className={styles.group}>
            <h3 className={styles.groupTitle}>{t("preferences:cloudProvider")}</h3>
            <div className={styles.providerGrid}>
              {providers.map((p) => (
                <button
                  key={p.id}
                  className={`${styles.providerCard} ${provider === p.id ? styles.providerCardActive : ""}`}
                  onClick={() => handleProviderChange(p.id)}
                >
                  <div className={styles.providerIcon}>{p.icon}</div>
                  <div className={styles.providerName}>{p.name}</div>
                  <div className={styles.providerDesc}>{p.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Connection Status */}
          <div className={styles.statusBar}>
            <span
              className={`${styles.statusDot} ${testStatus === "success" ? styles.statusConnected : styles.statusDisconnected}`}
            />
            <span className={styles.statusText}>
              {testStatus === "success"
                ? t("preferences:cloudSuccess")
                : testStatus === "error"
                  ? t("preferences:cloudFailed")
                  : t("preferences:cloudNotConfigured", "Not configured")}
            </span>
          </div>

          {/* S3 Configuration */}
          {provider === "s3" && (
            <div className={styles.group}>
              <h3 className={styles.groupTitle}>{t("preferences:cloudConfig")}</h3>
              <div className={styles.credentialGrid}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>{t("preferences:cloudEndpoint")}</label>
                  <input
                    type="text"
                    className={styles.textInput}
                    value={s3Endpoint}
                    onChange={(e) => setS3Endpoint(e.target.value)}
                    onBlur={handleSaveCredentials}
                    placeholder="https://s3.amazonaws.com"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>{t("preferences:cloudRegion")}</label>
                  <input
                    type="text"
                    className={styles.textInput}
                    value={s3Region}
                    onChange={(e) => setS3Region(e.target.value)}
                    onBlur={handleSaveCredentials}
                    placeholder="us-east-1"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>{t("preferences:cloudBucket")}</label>
                  <input
                    type="text"
                    className={styles.textInput}
                    value={s3Bucket}
                    onChange={(e) => setS3Bucket(e.target.value)}
                    onBlur={handleSaveCredentials}
                    placeholder="my-bucket"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>{t("preferences:cloudAccessKey")}</label>
                  <input
                    type="text"
                    className={styles.textInput}
                    value={s3AccessKey}
                    onChange={(e) => setS3AccessKey(e.target.value)}
                    onBlur={handleSaveCredentials}
                    placeholder="AKIA..."
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>{t("preferences:cloudSecretKey")}</label>
                  <div className={styles.secretRow}>
                    <input
                      type={showSecrets.s3Secret ? "text" : "password"}
                      className={styles.textInput}
                      value={s3SecretKey}
                      onChange={(e) => setS3SecretKey(e.target.value)}
                      onBlur={handleSaveCredentials}
                      placeholder="••••••••"
                    />
                    <button
                      className={styles.secretToggle}
                      onClick={() => toggleSecretVisibility("s3Secret")}
                    >
                      {showSecrets.s3Secret ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* R2 Configuration */}
          {provider === "r2" && (
            <div className={styles.group}>
              <h3 className={styles.groupTitle}>{t("preferences:cloudConfig")}</h3>
              <div className={styles.credentialGrid}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>{t("preferences:cloudR2AccountId", "Account ID")}</label>
                  <input
                    type="text"
                    className={styles.textInput}
                    value={r2AccountId}
                    onChange={(e) => setR2AccountId(e.target.value)}
                    onBlur={handleSaveCredentials}
                    placeholder="abc123..."
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>{t("preferences:cloudAccessKey")}</label>
                  <input
                    type="text"
                    className={styles.textInput}
                    value={r2AccessKey}
                    onChange={(e) => setR2AccessKey(e.target.value)}
                    onBlur={handleSaveCredentials}
                    placeholder="..."
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>{t("preferences:cloudSecretKey")}</label>
                  <div className={styles.secretRow}>
                    <input
                      type={showSecrets.r2Secret ? "text" : "password"}
                      className={styles.textInput}
                      value={r2SecretKey}
                      onChange={(e) => setR2SecretKey(e.target.value)}
                      onBlur={handleSaveCredentials}
                      placeholder="••••••••"
                    />
                    <button
                      className={styles.secretToggle}
                      onClick={() => toggleSecretVisibility("r2Secret")}
                    >
                      {showSecrets.r2Secret ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>{t("preferences:cloudBucket")}</label>
                  <input
                    type="text"
                    className={styles.textInput}
                    value={r2Bucket}
                    onChange={(e) => setR2Bucket(e.target.value)}
                    onBlur={handleSaveCredentials}
                    placeholder="my-bucket"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Google Drive */}
          {provider === "google_drive" && (
            <div className={styles.group}>
              <h3 className={styles.groupTitle}>Google Drive</h3>
              {driveConnected ? (
                <div className={styles.driveConnected}>
                  <div className={styles.driveInfo}>
                    <CloudIcon size={20} />
                    <div>
                      <div className={styles.driveEmail}>{driveEmail}</div>
                      <div className={styles.driveFolder}>{driveFolder}</div>
                    </div>
                  </div>
                  <button
                    className={styles.secondaryBtn}
                    onClick={handleDriveSignIn}
                  >
                    {t("common:reconnect", "Reconnect")}
                  </button>
                </div>
              ) : (
                <button className={styles.primaryBtn} onClick={handleDriveSignIn}>
                  <CloudIcon size={16} />
                  {t("preferences:cloudSignIn", "Sign in with Google")}
                </button>
              )}
            </div>
          )}

          {/* Test Connection */}
          {provider !== "google_drive" && (
            <div className={styles.group}>
              <button
                className={styles.testBtn}
                onClick={handleTestConnection}
                disabled={testStatus === "testing"}
              >
                {testStatus === "testing" ? (
                  <Loader size={14} className={styles.spin} />
                ) : testStatus === "success" ? (
                  <CheckCircle size={14} />
                ) : testStatus === "error" ? (
                  <XCircle size={14} />
                ) : null}
                {testStatus === "testing"
                  ? t("preferences:cloudTesting")
                  : t("preferences:cloudTest")}
              </button>
            </div>
          )}

          {/* Upload Settings */}
          <div className={styles.group}>
            <h3 className={styles.groupTitle}>{t("preferences:uploadSettings", "Upload Settings")}</h3>

            <div className={styles.radioInline}>
              <label className={styles.radio}>
                <input
                  type="radio"
                  name="uploadFormat"
                  checked={uploadFormat === "original"}
                  onChange={() => handleUploadFormatChange("original")}
                />
                <span>{t("preferences:uploadOriginal", "Original")}</span>
              </label>
              <label className={styles.radio}>
                <input
                  type="radio"
                  name="uploadFormat"
                  checked={uploadFormat === "optimized"}
                  onChange={() => handleUploadFormatChange("optimized")}
                />
                <span>{t("preferences:uploadOptimized", "Optimized")}</span>
              </label>
            </div>

            <label className={styles.toggle}>
              <div className={styles.toggleInfo}>
                <Copy size={16} />
                <span>{t("preferences:copyUrlAfterUpload", "Copy URL After Upload")}</span>
              </div>
              <input
                type="checkbox"
                className={styles.toggleSwitch}
                checked={copyUrlAfterUpload}
                onChange={(e) => {
                  setCopyUrlAfterUpload(e.target.checked);
                  updateSection("cloud", { copy_url_after_upload: e.target.checked } as Record<string, unknown>);
                  onChange();
                }}
              />
            </label>
          </div>

          {/* Upload History */}
          <div className={styles.group}>
            <button
              className={styles.collapseHeader}
              onClick={() => setUploadHistoryOpen(!uploadHistoryOpen)}
            >
              <ChevronDown
                size={14}
                className={`${styles.collapseIcon} ${uploadHistoryOpen ? styles.collapseIconOpen : ""}`}
              />
              <span>{t("preferences:uploadHistory", "Upload History")}</span>
            </button>
            {uploadHistoryOpen && (
              <div className={styles.historyLog}>
                <div className={styles.historyItem}>
                  <CloudIcon size={14} />
                  <span className={styles.historyName}>screenshot_2026-07-22.png</span>
                  <span className={styles.historyTime}>2 hours ago</span>
                  <Link size={12} />
                </div>
                <div className={styles.historyItem}>
                  <CloudIcon size={14} />
                  <span className={styles.historyName}>recording_2026-07-21.mp4</span>
                  <span className={styles.historyTime}>Yesterday</span>
                  <Link size={12} />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default React.memo(CloudSettings);
