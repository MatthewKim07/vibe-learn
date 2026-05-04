import { NotImplementedClient } from './notImplementedClient';

export class OllamaClient extends NotImplementedClient {
  constructor() {
    super('ollama', 'Ollama integration is planned (local HTTP at http://localhost:11434).');
  }
}
