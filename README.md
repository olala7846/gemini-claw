# Harness Gemini 


Harness the power of Gemini CLI


## Ideas

### Phase 1 (Control Gemini CLI)
- Being able to trigger Gemini CLI programmatically (not thtrough terminal)
- Being able to send message and receive message from Gemini CLI
- Being able to programmtically give initial prompts (instruction) and overwrite system prompts to Gemini CLI (system prompt environment variable already exists)

### Phase 2 (Routing)
- Route Gemini CLI Inbound and outbound messages to a queue (RabbitMQ) or Pub/Sub channel for routing (potentiall route the message to chat bot or other UX)
- Being able to trigger gemini cli with predefined prompts
- Being able to Schedule command to Gemini CLI (specific time or periodically through cron)
- Being able to orchestrate different works depends on each other (Workflow)