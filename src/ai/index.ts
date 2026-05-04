import { AnthropicClient } from './anthropicClient';
import { GeminiClient } from './geminiClient';
import { OllamaClient } from './ollamaClient';
import { OpenAIClient } from './openaiClient';
import { OpenRouterClient } from './openrouterClient';
import { AIClient, AIError, Provider } from './types';

export interface CreateClientArgs {
  provider: Provider;
  apiKey?: string;
}

export function createClient(args: CreateClientArgs): AIClient {
  switch (args.provider) {
    case 'openai':
      if (!args.apiKey) {
        throw new AIError(
          'No OpenAI API key found. Run "VibeLearn: Set API Key" from the Command Palette.'
        );
      }
      return new OpenAIClient(args.apiKey);

    case 'anthropic':
      return new AnthropicClient(args.apiKey);

    case 'gemini':
      return new GeminiClient(args.apiKey);

    case 'openrouter':
      return new OpenRouterClient(args.apiKey);

    case 'ollama':
      return new OllamaClient();

    default: {
      const exhaustive: never = args.provider;
      throw new AIError(`Unknown provider: ${exhaustive as string}`);
    }
  }
}

export * from './types';
