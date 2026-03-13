import { GeminiCliAgent } from '@google/gemini-cli-sdk';

async function main() {
  const agent = new GeminiCliAgent({
    cwd: process.cwd(),
    debug: false,
    instructions: 'You are a highly efficient routing orchestrator snippet. Keep your answers to exactly one sentence.',
  });

  const session = agent.session();
  await session.initialize();

  const prompt = 'Hello! Please state your purpose.';
  const stream = session.sendStream(prompt);

  let fullResponse = '';
  // @ts-ignore
  for await (const event of stream) {
    if (event.type === 'content' || event.type === 'text' || event.type === 'text_delta') {
      const text = event.value || event.text;
      if (text) {
        process.stdout.write(text);
        fullResponse += text;
      }
    }
  }

  if (fullResponse.trim().length > 0) {
    console.log('\nSUCCESS:', fullResponse);
    process.exit(0);
  } else {
    console.error('\nFAILED: No text received.');
    process.exit(1);
  }
}

main().catch(console.error);
