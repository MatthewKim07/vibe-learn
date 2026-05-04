import { AIClient, AIError, AIRequest, Provider } from './types';

export class NotImplementedClient implements AIClient {
  constructor(public readonly provider: Provider, private readonly note?: string) {}

  async complete(_req: AIRequest): Promise<string> {
    const base = `Provider "${this.provider}" is not implemented yet.`;
    const detail = this.note ? ` ${this.note}` : '';
    throw new AIError(`${base}${detail} Switch \`vibelearn.provider\` to "openai" for now.`);
  }
}
