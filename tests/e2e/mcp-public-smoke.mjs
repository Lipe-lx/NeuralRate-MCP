import { setTimeout as delay } from 'node:timers/promises';
import fs from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const MCP_URL = process.env.NEURALRATE_MCP_URL || 'https://neuralrate-worker.neuralrate.workers.dev/mcp';

const summarizeContent = (result) => {
  if (!result) return null;

  const text = Array.isArray(result.content)
    ? result.content
        .map((item) => (item && typeof item === 'object' ? item.text ?? JSON.stringify(item) : String(item)))
        .join('\n')
    : '';

  return {
    isError: Boolean(result.isError),
    text: text.slice(0, 2000),
    structuredContent: result.structuredContent ?? null,
  };
};

const main = async () => {
  const client = new Client(
    { name: 'neuralrate-mcp-smoke', version: '1.0.0' },
    { capabilities: {} },
  );
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));

  const summary = {
    endpoint: MCP_URL,
    connected: false,
    serverVersion: null,
    tools: [],
    unexpectedTools: [],
    toolCalls: {},
    errors: [],
  };

  try {
    await client.connect(transport);
    summary.connected = true;
    summary.serverVersion = client.getServerVersion() ?? null;

    const listed = await client.listTools();
    summary.tools = listed.tools.map((tool) => ({
      name: tool.name,
      title: tool.title ?? null,
      hasInputSchema: Boolean(tool.inputSchema),
    }));

    const toolNames = new Set(listed.tools.map((tool) => tool.name));
    const requiredTools = [
      'yield_scan',
      'tbill_spread',
      'nansen_context',
      'risk_assess',
      'optimal_allocation',
    ];
    const scopedOnlyTools = [
      'get_decisions',
      'get_user_state',
      'list_jobs',
      'update_agent_policy',
      'execute_strategy',
    ];
    const unexpectedTools = listed.tools
      .map((tool) => tool.name)
      .filter((toolName) => !requiredTools.includes(toolName));
    summary.unexpectedTools = unexpectedTools;
    if (unexpectedTools.length > 0) {
      throw new Error(`Public MCP catalog exposed unexpected tools: ${unexpectedTools.join(', ')}`);
    }

    for (const toolName of requiredTools) {
      if (!toolNames.has(toolName)) {
        throw new Error(`Public tool missing from catalog: ${toolName}`);
      }
    }

    for (const toolName of scopedOnlyTools) {
      if (toolNames.has(toolName)) {
        throw new Error(`Public MCP catalog exposed scoped-only tool: ${toolName}`);
      }
    }

    const yieldScan = await client.callTool({
      name: 'yield_scan',
      arguments: { minTvlUsd: 1000000, chainFilter: 'Mantle' },
    });
    summary.toolCalls.yield_scan = summarizeContent(yieldScan);

    const pools = yieldScan?.structuredContent?.pools;
    const firstPool = Array.isArray(pools) && pools.length > 0 ? pools[0] : null;
    const apy = firstPool?.apy ?? 5.0;

    const tbillSpread = await client.callTool({
      name: 'tbill_spread',
      arguments: { apy },
    });
    summary.toolCalls.tbill_spread = summarizeContent(tbillSpread);

    const riskAssess = await client.callTool({
      name: 'risk_assess',
      arguments: {
        protocolTvlUsd: firstPool?.tvlUsd ?? 1000000,
        apy,
        apyBase: firstPool?.apyBase ?? 0,
        apyReward: firstPool?.apyReward ?? 0,
        volumeUsd1d: firstPool?.volumeUsd1d ?? 0,
        volumeUsd7d: firstPool?.volumeUsd7d ?? 0,
        apyMean30d: firstPool?.apyMean30d ?? apy,
        ilRisk: firstPool?.ilRisk ?? 'no',
        stablecoin: firstPool?.stablecoin ?? false,
        sigma: firstPool?.sigma ?? 0,
        nansenSmartMoneyNetFlow: 0,
      },
    });
    summary.toolCalls.risk_assess = summarizeContent(riskAssess);

    const allocation = await client.callTool({
      name: 'optimal_allocation',
      arguments: {
        amountUsd: 2500,
        riskProfile: 'medium',
        objective: 'income',
        automationMode: 'recommend-only',
        restrictionPreset: 'blue-chip-defi',
      },
    });
    summary.toolCalls.optimal_allocation = summarizeContent(allocation);

    try {
      const guardedMutation = await client.callTool({
        name: 'update_agent_policy',
        arguments: {
          sessionToken: 'invalid-session-token',
          policyVersion: 'smoke-test',
          riskProfile: 'medium',
        },
      });
      summary.toolCalls.update_agent_policy = summarizeContent(guardedMutation);
    } catch (error) {
      summary.toolCalls.update_agent_policy = {
        isError: true,
        text: error instanceof Error ? error.message : String(error),
        structuredContent: null,
      };
    }

    await fs.writeFile('/tmp/neuralrate-mcp-smoke-results.json', JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    summary.errors.push(error instanceof Error ? error.message : String(error));
    await fs.writeFile('/tmp/neuralrate-mcp-smoke-results.json', JSON.stringify(summary, null, 2));
    console.error(JSON.stringify(summary, null, 2));
    throw error;
  } finally {
    await transport.close().catch(() => undefined);
    await delay(100);
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
