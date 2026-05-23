ALTER TABLE user_profiles ADD COLUMN privy_user_id TEXT;
ALTER TABLE user_profiles ADD COLUMN provider_user_ref TEXT;
ALTER TABLE user_profiles ADD COLUMN wallet_provider TEXT DEFAULT 'privy';

ALTER TABLE user_vaults ADD COLUMN safe_deployment_status TEXT DEFAULT 'pending';
ALTER TABLE user_vaults ADD COLUMN safe_salt_nonce TEXT;
ALTER TABLE user_vaults ADD COLUMN provider_vault_ref TEXT;
ALTER TABLE user_vaults ADD COLUMN safe_vault_address TEXT;

ALTER TABLE vault_permissions ADD COLUMN provider_permission_ref TEXT;
ALTER TABLE vault_permissions ADD COLUMN turnkey_signer_ref TEXT;

ALTER TABLE automation_sessions ADD COLUMN provider_session_ref TEXT;
ALTER TABLE automation_sessions ADD COLUMN provider_permission_ref TEXT;
ALTER TABLE automation_sessions ADD COLUMN consent_message TEXT;
ALTER TABLE automation_sessions ADD COLUMN consent_signature TEXT;
ALTER TABLE automation_sessions ADD COLUMN turnkey_signer_ref TEXT;

ALTER TABLE automation_jobs ADD COLUMN provider_job_ref TEXT;
ALTER TABLE benchmark_jobs ADD COLUMN provider_job_ref TEXT;
