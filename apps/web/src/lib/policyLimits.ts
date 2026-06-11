import type { AgentConfig } from "./userState";

export type PolicySyncStatus = "not_published" | "in_sync" | "drifted" | "pending_publish" | "pending_revoke" | null | undefined;

export type PolicyLimitValues = {
  maxActionUsd: number;
  maxDailyUsd: number;
  maxAutomationUsd?: number | null;
};

export const policySyncLabel = (status: PolicySyncStatus) => {
  switch (status) {
    case "in_sync":
      return "In sync";
    case "pending_publish":
      return "Needs publish";
    case "not_published":
      return "Not published";
    case "drifted":
      return "Drifted";
    case "pending_revoke":
      return "Pending revoke";
    default:
      return "Unknown";
  }
};

export const shouldShowPublishPolicy = (status: PolicySyncStatus) =>
  status === "drifted" || status === "pending_publish" || status === "not_published";

export const validatePolicyLimits = ({ maxActionUsd, maxDailyUsd, maxAutomationUsd }: PolicyLimitValues) => {
  if (!Number.isFinite(maxActionUsd) || maxActionUsd <= 0) {
    return "Per Action must be a positive finite USD amount.";
  }
  if (!Number.isFinite(maxDailyUsd) || maxDailyUsd <= 0) {
    return "Daily Limit must be a positive finite USD amount.";
  }
  if (maxActionUsd > maxDailyUsd) {
    return "Per Action must be less than or equal to Daily Limit.";
  }
  if (typeof maxAutomationUsd === "number" && Number.isFinite(maxAutomationUsd) && maxDailyUsd > maxAutomationUsd) {
    return "Daily Limit must be less than or equal to Max Automation USD.";
  }
  return null;
};

export const buildPolicyLimitPatch = (config: Pick<AgentConfig, "max_action_usd" | "max_daily_usd">) => ({
  maxActionUsd: config.max_action_usd,
  maxDailyUsd: config.max_daily_usd,
});
