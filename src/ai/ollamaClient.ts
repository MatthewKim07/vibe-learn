import { resolveModel } from './modelMatch';
import { AIClient, AIError, AIRequest, ChatMessage, Provider } from './types';

const DEFAULT_HOST = 'http://localhost:11434';
const CHAT_PATH = '/api/chat';
const TAGS_PATH = '/api/tags';

interface OllamaResponse {
  message?: { role?: string; content?: string };
  error?: string;
  done?: boolean;
}

interface OllamaTagsResponse {
  models?: Array<{ name?: string }>;
}

export class OllamaClient implements AIClient {
  public readonly provider: Provider = 'ollama';

  constructor(private readonly host: string = DEFAULT_HOST) {}

  async listModels(signal?: AbortSignal): Promise<string[]> {
    const url = `${this.host.replace(/\/$/, '')}${TAGS_PATH}`;
    let res: Response;
    try {
      res = await fetch(url, { signal });
    } catch (err) {
      throw new AIError(buildConnectionError(err, this.host), err);
    }
    if (!res.ok) {
      throw new AIError(`Ollama tags request failed (${res.status}).`, undefined, res.status);
    }
    const data = (await res.json()) as OllamaTagsResponse;
    return (data.models ?? [])
      .map((m) => m.name)
      .filter((n): n is string => typeof n === 'string');
  }

  async complete(req: AIRequest): Promise<string> {
    const url = `${this.host.replace(/\/$/, '')}${CHAT_PATH}`;

    const available = await this.listModels(req.signal);
    const resolution = resolveModel(req.model, available);

    if (!resolution.match) {
      const detail = available.length === 0
        ? 'No models installed locally. Pull one with `ollama pull llama3.2`.'
        : resolution.suggestions.length > 0
          ? `Did you mean: ${resolution.suggestions.join(', ')}?`
          : `Installed: ${available.join(', ')}.`;
      throw new AIError(
        `Ollama model "${req.model}" not found locally. ${detail}`
      );
    }

    const body = {
      model: resolution.match,
      messages: req.messages.map((m: ChatMessage) => ({
        role: m.role,
        content: m.content
      })),
      stream: false
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: req.signal
      });
    } catch (err) {
      throw new AIError(buildConnectionError(err, this.host), err);
    }

    if (!res.ok) {
      const detail = await safeReadError(res);
      if (res.status === 404 && /model/i.test(detail)) {
        throw new AIError(
          `Ollama model "${req.model}" not found locally. Pull it first: \`ollama pull ${req.model}\`.`,
          undefined,
          res.status
        );
      }
      throw new AIError(
        `Ollama request failed (${res.status}): ${detail}`,
        undefined,
        res.status
      );
    }

    let data: OllamaResponse;
    try {
      data = (await res.json()) as OllamaResponse;
    } catch (err) {
      throw new AIError('Ollama returned non-JSON response.', err);
    }

    if (data.error) {
      throw new AIError(`Ollama error: ${data.error}`);
    }

    const content = data.message?.content;
    if (typeof content !== 'string' || content.length === 0) {
      throw new AIError('Ollama response did not contain content.');
    }
    return content;
  }
}

function buildConnectionError(err: unknown, host: string): string {
  const msg = err instanceof Error ? err.message : '';
  if (/ECONNREFUSED|fetch failed|Failed to fetch/i.test(msg)) {
    return [
      `Could not reach Ollama at ${host}.`,
      'Start it with `ollama serve` in a terminal,',
      'or install from https://ollama.com if you have not already.'
    ].join(' ');
  }
  return msg || `Network error contacting Ollama at ${host}.`;
}

async function safeReadError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as OllamaResponse;
    if (data.error) return data.error;
  } catch {
    // ignore json parse errors
  }
  return res.statusText || 'unknown error';
}
