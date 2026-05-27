import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import fs from 'node:fs/promises';
import WebSocket from 'ws';

const SITE_URL = process.env.NEURALRATE_WEB_URL || 'https://neuralrate.pages.dev/';
const CHROME_BIN = process.env.CHROME_BIN || 'google-chrome';
const PORT = 9222;
const PROFILE_DIR = `/tmp/neuralrate-chrome-profile-${Date.now()}`;

const waitFor = async (fn, { timeoutMs = 20000, intervalMs = 250, label = 'condition' } = {}) => {
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < timeoutMs) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }

  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
};

const startChrome = () =>
  spawn(
    CHROME_BIN,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-dev-shm-usage',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
      '--window-size=1440,1600',
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

const connectToTarget = async () => {
  const version = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    if (!response.ok) return null;
    return response.json();
  }, { label: 'Chrome remote debugging port' });

  const pages = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const target = pages.find((entry) => entry.type === 'page') ?? pages[0];
  if (!target?.webSocketDebuggerUrl) {
    throw new Error('Could not resolve a DevTools target.');
  }

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });

  let nextId = 1;
  const pending = new Map();
  const consoleMessages = [];
  const pageErrors = [];

  socket.on('message', (raw) => {
    const message = JSON.parse(raw.toString());
    if (message.id) {
      const handler = pending.get(message.id);
      if (handler) {
        pending.delete(message.id);
        if (message.error) {
          handler.reject(new Error(message.error.message || 'CDP command failed'));
        } else {
          handler.resolve(message.result);
        }
      }
      return;
    }

    if (message.method === 'Runtime.consoleAPICalled') {
      const values = message.params?.args?.map((arg) => arg.value ?? arg.description ?? '').join(' ');
      if (values) consoleMessages.push({ type: message.params.type, text: values });
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params?.exceptionDetails;
      if (details) {
        pageErrors.push({
          text: details.text || 'Exception thrown',
          url: details.url || '',
          lineNumber: details.lineNumber ?? null,
          columnNumber: details.columnNumber ?? null,
        });
      }
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }), (error) => {
        if (error) {
          pending.delete(id);
          reject(error);
        }
      });
    });

  return { version, socket, send, consoleMessages, pageErrors };
};

const evalByValue = async (send, expression) => {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  return result.result?.value;
};

const clickText = async (send, text) =>
  evalByValue(
    send,
    `(() => {
      const target = [...document.querySelectorAll('button,a,[role="button"]')]
        .find((el) => (el.textContent || '').trim().includes(${JSON.stringify(text)}));
      if (!target) return false;
      target.click();
      return true;
    })()`,
  );

const clickPoolSymbol = async (send, symbol) =>
  evalByValue(
    send,
    `(() => {
      const xpath = "//h4[normalize-space()='" + ${JSON.stringify(symbol)} + "']";
      const header = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      if (!header) return false;
      const row = header.closest('div[style*="grid-template-columns"]') || header.parentElement;
      if (!row) return false;
      if (typeof row.click === 'function') {
        row.click();
      } else {
        row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }
      return true;
    })()`,
  );

const getBodyText = async (send) => evalByValue(send, `(() => document.body ? document.body.innerText : '')()`);

const getSelectedPool = async (send) =>
  evalByValue(
    send,
    `(() => {
      const el = document.querySelector('div[style*="background: rgba(223, 246, 81, 0.04)"] h4');
      return el ? el.textContent.trim() : null;
    })()`,
  );

const getRiskScore = async (send) =>
  evalByValue(
    send,
    `(() => {
      const section = [...document.querySelectorAll('section')].find((el) => (el.innerText || '').includes('Risk Assessment'));
      if (!section) return null;
      const big = section.querySelector('div[style*="font-size: 3rem"]');
      return big ? big.textContent.trim() : null;
    })()`,
  );

const getSectionText = async (send, heading) =>
  evalByValue(
    send,
    `(() => {
      const section = [...document.querySelectorAll('section')].find((el) => (el.innerText || '').includes(${JSON.stringify(heading)}));
      return section ? section.innerText : null;
    })()`,
  );

const captureScreenshot = async (send, path) => {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await fs.writeFile(path, Buffer.from(result.data, 'base64'));
};

const main = async () => {
  const chrome = startChrome();
  const stderr = [];
  chrome.stderr.on('data', (chunk) => stderr.push(chunk.toString()));

  try {
    const { send, consoleMessages, pageErrors } = await connectToTarget();
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Log.enable');
    await send('Network.enable');

    await send('Page.navigate', { url: SITE_URL });

    await waitFor(async () => {
      const readyState = await evalByValue(send, `document.readyState`);
      return readyState === 'complete';
    }, { label: 'page load complete', timeoutMs: 40000 });

    await waitFor(async () => {
      const text = await getBodyText(send);
      return text.includes('Yield Scanner') && text.includes('AGENT ACCESS') && text.includes('CONNECT WALLET');
    }, { label: 'public landing page', timeoutMs: 40000 });

    const initial = {
      selectedPool: await getSelectedPool(send),
      riskScore: await getRiskScore(send),
      agentText: await getSectionText(send, 'Nansen Radar'),
    };
    await captureScreenshot(send, '/tmp/neuralrate-landing.png');

    const agentButtonClicked = await clickText(send, 'AGENT ACCESS');
    if (!agentButtonClicked) throw new Error('Could not click AGENT ACCESS button.');
    await waitFor(async () => (await getBodyText(send)).includes('Agent Connection'), { label: 'MCP modal open' });
    const agentModalText = await getBodyText(send);
    await captureScreenshot(send, '/tmp/neuralrate-agent-modal.png');

    const closeClicked = await evalByValue(
      send,
      `(() => {
        const button = document.querySelector('button[style*="position: absolute"][style*="top: 1rem"][style*="right: 1rem"]');
        if (!button) return false;
        button.click();
        return true;
      })()`,
    );
    if (!closeClicked) throw new Error('Could not close MCP modal.');
    await waitFor(async () => !(await getBodyText(send)).includes('Agent Connection'), { label: 'MCP modal close' });

    const selectedBefore = await getSelectedPool(send);
    const scoreBefore = await getRiskScore(send);
    const targetPoolSymbol = selectedBefore === 'USDC' ? 'GHO' : 'USDC';
    const switchedPool = await clickPoolSymbol(send, targetPoolSymbol);
    if (!switchedPool) throw new Error('Could not select an alternate yield pool.');

    await waitFor(async () => {
      const next = await getSelectedPool(send);
      return next && next !== selectedBefore;
    }, { label: 'pool selection change' });
    const selectedAfter = await getSelectedPool(send);
    await waitFor(async () => {
      const nextScore = await getRiskScore(send);
      return nextScore && nextScore !== scoreBefore;
    }, { label: 'risk score refresh', timeoutMs: 30000 });
    const scoreAfter = await getRiskScore(send);
    await captureScreenshot(send, '/tmp/neuralrate-pool-selected.png');

    const nansenToggleClicked = await evalByValue(
      send,
      `(() => {
        const button = [...document.querySelectorAll('button')].find((el) => el.title === 'Enable Nansen API');
        if (!button) return false;
        button.click();
        return true;
      })()`,
    );
    if (!nansenToggleClicked) throw new Error('Could not toggle Nansen Radar.');

    const nansenSettled = await waitFor(async () => {
      const sectionText = await getSectionText(send, 'Nansen Radar');
      return Boolean(sectionText && (sectionText.includes('Nansen API unavailable') || sectionText.includes('Configure your API key')));
    }, { label: 'Nansen Radar final state', timeoutMs: 15000 })
      .then(() => true)
      .catch(() => false);
    const nansenText = await getSectionText(send, 'Nansen Radar');
    await captureScreenshot(send, '/tmp/neuralrate-nansen.png');

    const switchedToVault = await clickText(send, 'Agent Vault');
    if (!switchedToVault) throw new Error('Could not switch to Agent Vault tab.');
    await waitFor(async () => (await getBodyText(send)).includes('Vault'), { label: 'vault tab' });
    const vaultText = await getBodyText(send);
    await captureScreenshot(send, '/tmp/neuralrate-vault-tab.png');

    const result = {
      initial,
      afterPoolSwitch: {
        selectedPool: selectedAfter,
        riskScoreBefore: scoreBefore,
        riskScoreAfter: scoreAfter,
      },
      agentModalText,
      vaultText,
      nansenText,
      nansenSettled,
      consoleMessages,
      pageErrors,
      chromeStderrTail: stderr.slice(-10),
      screenshots: [
        '/tmp/neuralrate-landing.png',
        '/tmp/neuralrate-agent-modal.png',
        '/tmp/neuralrate-vault-tab.png',
        '/tmp/neuralrate-pool-selected.png',
        '/tmp/neuralrate-nansen.png',
      ],
    };

    await fs.writeFile('/tmp/neuralrate-e2e-results.json', JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    chrome.kill('SIGTERM');
    await delay(500);
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
