import { subscribeInbound, publishInbound } from '../protocol/bus.js';
import type { InboundMessage } from '../protocol/messages.js';
import { setTimeout } from 'node:timers/promises';

export type WorkerRequest = {
  sessionId: string;
  personaId: string;
  mode: 'interactive' | 'headless';
};

export class GatewayRouter {
  private activeSessions = new Set<string>();
  private defaultAgentId: string;
  private workerRequestHandler: ((req: WorkerRequest) => Promise<void>) | null = null;

  constructor(defaultAgentId: string) {
    this.defaultAgentId = defaultAgentId;

    subscribeInbound(async (msg: InboundMessage) => {
      await this.handleInbound(msg);
    });
  }

  public onWorkerRequested(handler: (req: WorkerRequest) => Promise<void>) {
    this.workerRequestHandler = handler;
  }

  private async handleInbound(msg: InboundMessage) {
    const { sessionId, channel } = msg.meta;
    let isNewSession = false;

    if (!this.activeSessions.has(sessionId)) {
      isNewSession = true;
      let personaId = this.defaultAgentId;
      if (msg.type === 'session_start' && msg.persona) {
        personaId = msg.persona;
      }

      const mode = channel === 'cli' || channel === 'telegram' ? 'interactive' : 'headless';

      if (this.workerRequestHandler) {
        try {
          await this.workerRequestHandler({ sessionId, personaId, mode });
          this.activeSessions.add(sessionId);
          // Silent logging internally to not disrupt CLI too much
        } catch (err: any) {
          console.error(`\n[Gateway Error] Failed to start agent worker: ${err.message}\n`);
          return;
        }
      }
    }

    if (isNewSession && msg.type !== 'session_start') {
      // Re-emit the original prompt/resume_task so the newly subscribed worker receives it.
      await setTimeout(0); // macroscopic yield
      publishInbound(msg);
    }
  }
}
