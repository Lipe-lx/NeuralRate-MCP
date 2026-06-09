import * as fs from "fs";
import * as path from "path";

function main() {
  const dbPath = path.join(__dirname, "../../scripts/user-db-state.json");
  const data = JSON.parse(fs.readFileSync(dbPath, "utf8"));

  const matches: any[] = [];

  function search(obj: any) {
    if (!obj || typeof obj !== "object") return;
    if (obj.failure_reason && obj.failure_reason.includes("0xacfdb444")) {
      matches.push(obj);
    }
    for (const key of Object.keys(obj)) {
      search(obj[key]);
    }
  }

  search(data);

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    console.log(`\n--- Match ${i} ---`);
    if (match.payload_json) {
      const payload = JSON.parse(match.payload_json);
      console.log("Policy Checks:");
      console.log(JSON.stringify(payload.policyChecks, null, 2));
      console.log("Execution Summary:", payload.executionSummary);
      console.log("Failure Reason in DB:", match.failure_reason);
    }
  }
}

main();
