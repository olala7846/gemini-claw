import { GeminiCliAgent } from '@google/gemini-cli-sdk';
import { ReportStatusTool } from './src/core/agent/statusTool.js';

async function run() {
  try {
    const agent = new GeminiCliAgent({
      cwd: process.cwd(),
      instructions: 'test',
      tools: [ReportStatusTool]
    });

    const session = agent.session();
    await session.initialize();
    console.log('Initialization successful.');
    console.log(JSON.stringify(agent, null, 2));
  } catch (err: any) {
    console.error('Initialization failed:', err.message);
  }
}

run();
