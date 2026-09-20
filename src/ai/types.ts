export type Role = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: Role;
  content: string;
}

export type Provider = 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'ollama';

export type HelpLevel = 'strict' | 'guided' | 'assist' | 'full';

export interface AIRequest {
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
}

export interface AIUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AIResponse {
  content: string;
  usage?: AIUsage;
}

export interface AIClient {
  readonly provider: Provider;
  complete(req: AIRequest): Promise<AIResponse>;
}

export class AIError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'AIError';
  }
}

