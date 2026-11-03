import http from 'node:http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { findTokens, restoreTokens } from './anonymizer.js';
import { OpenAICompletionClient } from './openaiService.js';
import { secureChat } from './secureChat.js';
import { createSecureChatRouter } from '../routes/secureChatGPT.js';

const ORIGINAL = 'Escribe un correo para Ana Perez, ana.perez@example.com, cel 3001234567';
const ANONYMIZED =
  'Escribe un correo para NAME_aaaabbbbcccc, EMAIL_111122223333, cel PHONE_abc123abc123';
const FOREIGN = 'NAME_ffffffffffff';

test('restoreTokens keeps tokens that were not part of the request', () => {
  const originals = new Map([
    ['NAME_aaaabbbbcccc', 'Ana Perez'],
    ['EMAIL_111122223333', 'ana.perez@example.com'],
    [FOREIGN, 'Otra Persona'],
  ]);
  const reply = `Listo NAME_aaaabbbbcccc (${FOREIGN}) en EMAIL_111122223333`;

  assert.equal(
    restoreTokens(reply, originals, new Set(findTokens(ANONYMIZED))),
    'Listo Ana Perez (NAME_ffffffffffff) en ana.perez@example.com',
  );
});

test('restoreTokens without an allow-list still restores every known token', () => {
  const originals = new Map([['PHONE_abc123abc123', '3001234567']]);

  assert.equal(
    restoreTokens('llamar PHONE_abc123abc123 o NAME_000000000000', originals),
    'llamar 3001234567 o NAME_000000000000',
  );
});

test('secureChat sends only the anonymized prompt and restores its tokens', async () => {
  let sent = '';

  const response = await secureChat(ORIGINAL, {
    anonymize: async (message) => {
      assert.equal(message, ORIGINAL);
      return ANONYMIZED;
    },
    complete: async (prompt) => {
      sent = prompt;
      return `Borrador para NAME_aaaabbbbcccc y ${FOREIGN}. Correo EMAIL_111122223333, cel PHONE_abc123abc123.`;
    },
    deanonymize: async (text, options) => {
      assert.equal(options.allowedTokens.has(FOREIGN), false);
      assert.equal(options.allowedTokens.has('NAME_aaaabbbbcccc'), true);
      const originals = new Map([
        ['NAME_aaaabbbbcccc', 'Ana Perez'],
        ['EMAIL_111122223333', 'ana.perez@example.com'],
        ['PHONE_abc123abc123', '3001234567'],
        [FOREIGN, 'Otra Persona'],
      ]);
      return restoreTokens(text, originals, options.allowedTokens);
    },
  });

  assert.equal(sent, ANONYMIZED);
  assert.equal(sent.includes('ana.perez@example.com'), false);
  assert.equal(sent.includes('Ana Perez'), false);
  assert.equal(
    response,
    'Borrador para Ana Perez y NAME_ffffffffffff. Correo ana.perez@example.com, cel 3001234567.',
  );
});

test('OpenAI client refuses to run without an API key', async () => {
  const client = new OpenAICompletionClient({ apiKey: '   ' });

  await assert.rejects(() => client.complete(ANONYMIZED), (error) => {
    assert.equal(error.code, 'OPENAI_NOT_CONFIGURED');
    assert.equal(String(error.message).includes(ANONYMIZED), false);
    return true;
  });
});

test('OpenAI client sends the anonymized prompt and hides upstream errors', async () => {
  const calls = [];
  const client = new OpenAICompletionClient({
    apiKey: 'test-key',
    model: 'gpt-4o-mini',
    client: {
      chat: {
        completions: {
          create: async (body) => {
            calls.push(body);
            const failure = new Error(`upstream leaked ${ANONYMIZED}`);
            throw failure;
          },
        },
      },
    },
  });

  await assert.rejects(() => client.complete(ANONYMIZED), (error) => {
    assert.equal(error.code, 'OPENAI_UPSTREAM');
    assert.equal(error.message, 'The model request failed');
    assert.equal(String(error.message).includes('ana.perez'), false);
    assert.equal(Object.hasOwn(error, 'cause'), false);
    return true;
  });

  assert.equal(calls[0].messages[1].content, ANONYMIZED);
  assert.equal(calls[0].messages[1].content.includes('example.com'), false);
  assert.match(calls[0].messages[0].content, /NAME_<hex>/);
});

test('OpenAI client returns the completion text', async () => {
  const client = new OpenAICompletionClient({
    client: {
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: `Hola NAME_aaaabbbbcccc` } }],
          }),
        },
      },
    },
  });

  assert.equal(await client.complete(ANONYMIZED), 'Hola NAME_aaaabbbbcccc');
});

test('OpenAI client rejects an empty completion', async () => {
  const client = new OpenAICompletionClient({
    client: {
      chat: {
        completions: {
          create: async () => ({ choices: [{ message: { content: '   ' } }] }),
        },
      },
    },
  });

  await assert.rejects(() => client.complete(ANONYMIZED), (error) => {
    assert.equal(error.code, 'OPENAI_UPSTREAM');
    return true;
  });
});

/**
 * @param {(port: number) => Promise<void>} run
 * @param {(prompt: string) => Promise<string>} secureChatImpl
 */
async function withServer(run, secureChatImpl) {
  const app = express();
  app.use(express.json());
  app.use(createSecureChatRouter({ secureChat: secureChatImpl }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());

  try {
    await run(port);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('POST /secureChatGPT validates the prompt and returns the restored reply', async () => {
  await withServer(
    async (port) => {
      const missing = await fetch(`http://127.0.0.1:${port}/secureChatGPT`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(missing.status, 400);

      const blank = await fetch(`http://127.0.0.1:${port}/secureChatGPT`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '   ' }),
      });
      assert.equal(blank.status, 400);

      const ok = await fetch(`http://127.0.0.1:${port}/secureChatGPT`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: ORIGINAL }),
      });
      assert.equal(ok.status, 200);
      assert.deepEqual(await ok.json(), { response: 'Borrador para Ana Perez' });
    },
    async (prompt) => {
      assert.equal(prompt, ORIGINAL);
      return 'Borrador para Ana Perez';
    },
  );
});

test('POST /secureChatGPT maps OpenAI failures to 503 and 502', async () => {
  await withServer(async (port) => {
    const notConfigured = await fetch(`http://127.0.0.1:${port}/secureChatGPT`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: ORIGINAL }),
    });
    assert.equal(notConfigured.status, 503);

    const upstream = await fetch(`http://127.0.0.1:${port}/secureChatGPT`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'falla upstream' }),
    });
    assert.equal(upstream.status, 502);
    const body = await upstream.json();
    assert.equal(JSON.stringify(body).includes('Ana Perez'), false);
  }, async (prompt) => {
    const error = new Error('The model request failed');
    error.code = prompt === ORIGINAL ? 'OPENAI_NOT_CONFIGURED' : 'OPENAI_UPSTREAM';
    throw error;
  });
});
