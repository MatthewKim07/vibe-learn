import { ChatMessage, AIClient, AIError, AIRequest, Provider } from './types';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string; type?: string };
}

export class OpenAIClient implements AIClient {
  public readonly provider: Provider = 'openai';

  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new AIError('OpenAI client requires an API key.');
    }
  }

  async complete(req: AIRequest): Promise<string> {
    const body = {
      model: req.model,
      messages: req.messages.map((m: ChatMessage) => ({
        role: m.role,
        content: m.content
      }))
    };

    let res: Response;
    try {
      res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body),
        signal: req.signal
      });
    } catch (err) {
      throw new AIError(toSafeMessage(err) || 'Network error contacting OpenAI.', err);
    }

    if (!res.ok) {
      const detail = await safeReadError(res);
      throw new AIError(
        `OpenAI request failed (${res.status}): ${detail}`,
        undefined,
        res.status
      );
    }

    let data: OpenAIResponse;
    try {
      data = (await res.json()) as OpenAIResponse;
    } catch (err) {
      throw new AIError('OpenAI returned non-JSON response.', err);
    }

    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.length === 0) {
      throw new AIError('OpenAI response did not contain content.');
    }
    return content;
  }
}

async function safeReadError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as OpenAIResponse;
    const msg = data.error?.message;
    if (msg) return msg;
  } catch {
    // ignore json parse errors, fall through
  }
  if (res.status === 401) return 'invalid or missing API key';
  if (res.status === 429) return 'rate limit or quota exceeded';
  return res.statusText || 'unknown error';
}

function toSafeMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return '';
}
