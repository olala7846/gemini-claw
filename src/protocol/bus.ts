import { EventEmitter } from 'events';
import type { InboundMessage, OutboundMessage } from './messages.js';

export const agentBus = new EventEmitter();

export const Topic = {
  INBOUND: 'agent.inbound',
  OUTBOUND: 'agent.outbound'
} as const;

export function publishInbound(message: InboundMessage) {
  agentBus.emit(Topic.INBOUND, message);
}

export function publishOutbound(message: OutboundMessage) {
  agentBus.emit(Topic.OUTBOUND, message);
}

export function subscribeInbound(handler: (msg: InboundMessage) => void) {
  agentBus.on(Topic.INBOUND, handler);
}

export function subscribeOutbound(handler: (msg: OutboundMessage) => void) {
  agentBus.on(Topic.OUTBOUND, handler);
}
