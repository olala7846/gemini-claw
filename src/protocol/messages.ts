/**
 * Represents a message sent from the User/CLI to the Agent.
 */
export interface InboundMessage {
  type: 'prompt' | 'system_override';
  content: string;
}

/**
 * Represents a message sent from the Agent back to the User/CLI.
 */
export interface OutboundMessage {
  type: 'content' | 'tool_call' | 'tool_result' | 'error' | 'done';
  content?: string;
  toolName?: string;
  toolArgs?: any;
}
