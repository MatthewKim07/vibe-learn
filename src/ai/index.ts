import { OpenAIClient } from './openaiClient';
import { LLMClient, LLMError, Provider } from './types';

export interface CreateClientArgs {
  provider: Provider;
  apiKey?: string;
}

export function createClient(args: CreateClientArgs): LLMClient {
  switch (args.provider) {
    case 'openai':
      if (!args.apiKey) {
        throw new LLMError(
          'No OpenAI API key found. Run "VibeLearn: Set API Key" from the Command Palette.'
        );
      }
      return new OpenAIClient(args.apiKey);

    case 'anthropic':
    case 'gemini':
    case 'ollama':
      throw new LLMError(
        `Provider "${args.provider}" is not connected yet. Set vibelearn.provider to "openai" for now.`
      );

    default:
      throw new LLMError(`Unknown provider: ${args.provider as string}`);
  }
}

export * from './types';
