import { NotImplementedClient } from './notImplementedClient';

export class OpenRouterClient extends NotImplementedClient {
  constructor(_apiKey?: string) {
    super('openrouter', 'OpenRouter integration is planned (uses an OpenAI-compatible endpoint).');
  }
}
