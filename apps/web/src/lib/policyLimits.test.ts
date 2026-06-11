import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPolicyLimitPatch,
  policySyncLabel,
  shouldShowPublishPolicy,
  validatePolicyLimits,
} from "./policyLimits";

test("policy limit patch maps saved config limits to API field names", () => {
  assert.deepEqual(
    buildPolicyLimitPatch({
      max_action_usd: 750,
      max_daily_usd: 2200,
    }),
    {
      maxActionUsd: 750,
      maxDailyUsd: 2200,
    }
  );
});

test("policy sync labels expose product states", () => {
  assert.equal(policySyncLabel("in_sync"), "In sync");
  assert.equal(policySyncLabel("pending_publish"), "Needs publish");
  assert.equal(policySyncLabel("not_published"), "Not published");
  assert.equal(policySyncLabel("drifted"), "Drifted");
});

test("publish policy is visible only when draft needs an owner-signed publish", () => {
  assert.equal(shouldShowPublishPolicy("drifted"), true);
  assert.equal(shouldShowPublishPolicy("pending_publish"), true);
  assert.equal(shouldShowPublishPolicy("not_published"), true);
  assert.equal(shouldShowPublishPolicy("in_sync"), false);
});

test("policy limit validation blocks invalid limits", () => {
  assert.match(
    validatePolicyLimits({ maxActionUsd: 0, maxDailyUsd: 1000, maxAutomationUsd: 2000 }) ?? "",
    /Per Action/
  );
  assert.match(
    validatePolicyLimits({ maxActionUsd: 1000, maxDailyUsd: 500, maxAutomationUsd: 2000 }) ?? "",
    /less than or equal to Daily Limit/
  );
  assert.match(
    validatePolicyLimits({ maxActionUsd: 500, maxDailyUsd: 3000, maxAutomationUsd: 2000 }) ?? "",
    /Max Automation/
  );
  assert.equal(validatePolicyLimits({ maxActionUsd: 500, maxDailyUsd: 1000, maxAutomationUsd: 2000 }), null);
});
