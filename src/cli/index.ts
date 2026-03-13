import * as readline from 'node:readline';
import { getAgentConfig } from '../agent/registry.js';
import { AgentWorker } from '../agent/worker.js';
import { publishInbound, subscribeOutbound } from '../protocol/bus.js';

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: chat-with-agent-cli <agent-id> [--cwd ./path] [--prompt "Initial text"]');
    process.exit(1);
  }

  const agentId = args[0];
  let cwd = process.cwd();
  let initialPrompt = '';

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--cwd' && args[i + 1]) {
      cwd = args[++i] as string;
    } else if (args[i] === '--prompt' && args[i + 1]) {
      initialPrompt = args[++i] as string;
    }
  }

  const config = getAgentConfig(agentId);
  const worker = new AgentWorker(config, cwd);

  // Setup CLI Interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\n> '
  });

  let expectingResponse = false;

  subscribeOutbound((msg) => {
    switch (msg.type) {
      case 'content':
        process.stdout.write(msg.content || '');
        break;
      case 'tool_call':
        process.stdout.write(`\n\n[Agent invoked tool: ${msg.toolName}]\n`);
        break;
      case 'status_update':
        console.log(`\n\n[STATUS: ${msg.state}] Reason: ${msg.reason}`);
        expectingResponse = false;
        rl.prompt();
        break;
      case 'error':
        console.error(`\n[Agent Error]: ${msg.content}\n`);
        expectingResponse = false;
        rl.prompt();
        break;
      case 'done':
        console.log('\n'); // Add breathing room after stream finishes
        expectingResponse = false;
        rl.prompt();
        break;
    }
  });

  // Start Agent Worker
  await worker.start();

  rl.on('line', (line) => {
    if (expectingResponse) {
      console.log('[Please wait, the agent is still typing...]');
      return;
    }

    const input = line.trim();
    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      rl.close();
      return;
    }

    if (input) {
      expectingResponse = true;
      publishInbound({ type: 'prompt', content: input });
    } else {
      rl.prompt();
    }
  });

  rl.on('close', () => {
    console.log('Chat session ended.');
    process.exit(0);
  });

  // Handle Initial Prompt if provided
  if (initialPrompt) {
    expectingResponse = true;
    publishInbound({ type: 'prompt', content: initialPrompt });
  } else {
    rl.prompt();
  }
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
