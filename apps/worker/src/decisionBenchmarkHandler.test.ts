import test from "node:test";
import assert from "node:assert/strict";
import { McpToolHandlers } from "./mcp/tools";

type DecisionRow = {
  decision_id: string;
  benchmark_status: string | null;
  tx_hash: string | null;
  onchain_decision_id: string | null;
  requested_by?: string | null;
};

class FakeStatement {
  private bindings: unknown[] = [];

  constructor(
    private sql: string,
    private decisions: Map<string, DecisionRow>
  ) {}

  bind(...values: unknown[]) {
    this.bindings = values;
    return this;
  }

  async first<T>() {
    const decisionId = String(this.bindings[0] ?? "");
    return (this.decisions.get(decisionId) ?? null) as T | null;
  }

  async run() {
    if (this.sql.includes("UPDATE decisions")) {
      const decisionId = String(this.bindings[this.bindings.length - 1] ?? "");
      const row = this.decisions.get(decisionId);
      if (!row) {
        return { success: true, meta: { changes: 0 } };
      }

      const assignments = this.sql
        .slice(this.sql.indexOf("SET") + 3, this.sql.indexOf("WHERE"))
        .split(",")
        .map((assignment) => assignment.trim().split(" = ")[0])
        .filter(Boolean);

      assignments.forEach((column, index) => {
        (row as Record<string, unknown>)[column] = this.bindings[index] as string | null;
      });
      this.decisions.set(decisionId, row);
      return { success: true, meta: { changes: 1 } };
    }

    return { success: true, meta: { changes: 0 } };
  }
}

class FakeD1Database {
  constructor(private decisions: Map<string, DecisionRow>) {}

  prepare(sql: string) {
    return new FakeStatement(sql, this.decisions);
  }
}

const makeHandlers = (decisions: Map<string, DecisionRow>) =>
  new McpToolHandlers({} as any, {} as any, {} as any, new FakeD1Database(decisions) as unknown as D1Database);

const parseContent = (result: Awaited<ReturnType<McpToolHandlers["handleUpdateDecisionBenchmark"]>>) =>
  JSON.parse(result.content[0].text);

test("decision benchmark update preserves onchain status when proof exists", async () => {
  const decisions = new Map<string, DecisionRow>([
    [
      "decision_1",
      {
        decision_id: "decision_1",
        benchmark_status: "onchain",
        tx_hash: "0xabc",
        onchain_decision_id: "4",
      },
    ],
  ]);
  const handlers = makeHandlers(decisions);

  const result = await handlers.handleUpdateDecisionBenchmark({
    decisionId: "decision_1",
    benchmarkStatus: "local",
    requestedBy: "0xowner",
  });

  assert.equal(parseContent(result).preservedOnchainProof, true);
  assert.equal(parseContent(result).benchmarkStatus, "onchain");
  assert.equal(decisions.get("decision_1")?.benchmark_status, "onchain");
  assert.equal(decisions.get("decision_1")?.requested_by, "0xowner");
});

test("decision benchmark update allows local status when no proof exists", async () => {
  const decisions = new Map<string, DecisionRow>([
    [
      "decision_2",
      {
        decision_id: "decision_2",
        benchmark_status: "pending",
        tx_hash: null,
        onchain_decision_id: null,
      },
    ],
  ]);
  const handlers = makeHandlers(decisions);

  const result = await handlers.handleUpdateDecisionBenchmark({
    decisionId: "decision_2",
    benchmarkStatus: "local",
  });

  assert.equal(parseContent(result).preservedOnchainProof, false);
  assert.equal(parseContent(result).benchmarkStatus, "local");
  assert.equal(decisions.get("decision_2")?.benchmark_status, "local");
});
