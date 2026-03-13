import { GeminiCliAgent } from '@google/gemini-cli-sdk';
import { subscribeInbound, publishOutbound } from '../protocol/bus.js';
import type { AgentConfig } from './registry.js';
import type { GeminiCliSession } from '@google/gemini-cli-sdk';

export class AgentWorker {
  private agent: GeminiCliAgent;
  private session: GeminiCliSession | null = null;
  private config: AgentConfig;
  private cwd: string;

  constructor(config: AgentConfig, cwd: string) {
    this.config = config;
    this.cwd = cwd;

    // TODO: Support dynamic skills loading based on config.skills if needed
    // For now we map the core SDK interface
    this.agent = new GeminiCliAgent({
      cwd: this.cwd,
      instructions: this.config.systemPrompt,
      model: this.config.models?.primary,
      skills: this.config.skills?.map(s => ({ type: 'dir', path: s }))
    });
  }

  async start() {
    this.session = this.agent.session();
    await this.session.initialize();

    // Listen to Pub/Sub events from the CLI
    subscribeInbound(async (msg) => {
      if (msg.type === 'prompt') {
        await this.handlePrompt(msg.content);
      } else if (msg.type === 'system_override') {
        // Advanced: We could dynamically override instructions via context here, but keeping it simple for now
        console.warn('Dynamic system overrides not fully implemented in PoC');
      }
    });

    publishOutbound({ type: 'content', content: `[System] ${this.config.id} initialized in ${this.cwd}\n\n` });
  }

  private async handlePrompt(prompt: string) {
    if (!this.session) return;
    
    try {
      const stream = this.session.sendStream(prompt);
      
      // @ts-ignore - Types from generic interface
      for await (const event of stream) {
        if (event.type === 'content' || event.type === 'text') {
          const text = event.value || event.text;
          if (text) {
            publishOutbound({ type: 'content', content: text });
          }
        } else if (event.type === 'tool_call_request') {
          publishOutbound({ 
            type: 'tool_call', 
            toolName: event.value?.name,
            toolArgs: event.value?.args
          });
        }
      }
      publishOutbound({ type: 'done' });
    } catch (err: any) {
      publishOutbound({ type: 'error', content: err.message || 'Unknown error occurred' });
    }
  }
}
