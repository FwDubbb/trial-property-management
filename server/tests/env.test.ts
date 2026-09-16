import assert from 'node:assert/strict';
import { test } from 'node:test';

// Configuration tests are independent of a developer's local database credentials.
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
const { parseEnv } = await import('../src/config/env.js');
const valid = { DATABASE_URL: 'postgresql://test:test@localhost/test' };

test('environment defaults and explicit port are parsed', () => {
  assert.equal(parseEnv(valid).port, 4000);
  assert.equal(parseEnv({ ...valid, PORT: '4200' }).port, 4200);
});

test('invalid ports and environments fail early', () => {
  for (const PORT of ['0', '65536', 'abc', '1.5', '']) {
    assert.throws(() => parseEnv({ ...valid, PORT }), /PORT/);
  }
  assert.throws(() => parseEnv({ ...valid, NODE_ENV: 'typo' }), /NODE_ENV/);
});

test('database URL is required and invalid credentials are never echoed', () => {
  assert.throws(() => parseEnv({}), /DATABASE_URL is required/);
  for (const DATABASE_URL of [
    'https://user:secret@localhost/test',
    'secret',
    'postgresql://localhost/',
  ]) {
    assert.throws(
      () => parseEnv({ DATABASE_URL }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /DATABASE_URL/);
        assert.doesNotMatch(error.message, /secret/);
        return true;
      },
    );
  }
});
