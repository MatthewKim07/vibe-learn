export type Role = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: Role;
  content: string;
}

export type Provider = 'openai' | 'anthropic' | 'gemini' | 'ollama';

export type HelpLevel = 'strict' | 'guided' | 'assist' | 'full';

export interface LLMRequest {
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
}

export interface LLMClient {
  readonly provider: Provider;
  complete(req: LLMRequest): Promise<string>;
}

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'LLMError';
  }
}
