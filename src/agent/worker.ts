import { GeminiCliAgent } from '@google/gemini-cli-sdk';
import { subscribeInbound, publishOutbound } from '../protocol/bus.js';
import type { AgentConfig } from './registry.js';
import type { GeminiCliSession } from '@google/gemini-cli-sdk';
import { ReportStatusTool } from './statusTool.js';

export class AgentWorker {
  private agent: GeminiCliAgent;
  private session: GeminiCliSession | null = null;
  private config: AgentConfig;
  private cwd: string;

  constructor(config: AgentConfig, cwd: string) {
    this.config = config;
    this.cwd = cwd;

    // We append a strict instruction to always use the tool
    const augmentedPrompt = `${this.config.systemPrompt}\n\nCRITICAL SYSTEM INSTRUCTION: When you have finished your task, or if you are permanently blocked, you MUST call the \`report_status\` tool. Do not just print "blocked" or "completed" in text—you must invoke the tool with the appropriate state and reason.`;

    this.agent = new GeminiCliAgent({
      cwd: this.cwd,
      instructions: augmentedPrompt,
      model: this.config.models?.primary,
      skills: this.config.skills?.map(s => ({ type: 'dir', path: s })),
      // Inject our internal status reporting tool
      tools: [ReportStatusTool]
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
        if (event.type === 'content') {
          const text = event.value;
          if (text) {
            publishOutbound({ type: 'content', content: text });
          }
        } else if (event.type === 'tool_call_request') {
          const toolName = event.value?.name;
          const toolArgs = event.value?.args;

          if (toolName === 'report_status') {
            // It's our injected status tool! We intercept it here.
            publishOutbound({
              type: 'status_update',
              state: toolArgs?.state as 'BLOCKED' | 'COMPLETED',
              reason: toolArgs?.reason as string
            });
            // We do not want to continue spinning in the agent loop if it declared it's fully done or blocked.
            return;
          }

          publishOutbound({ 
            type: 'tool_call', 
            toolName,
            toolArgs
          });
        }
      }
      publishOutbound({ type: 'done' });
    } catch (err: any) {
      publishOutbound({ type: 'error', content: err.message || 'Unknown error occurred' });
    }
  }
}

