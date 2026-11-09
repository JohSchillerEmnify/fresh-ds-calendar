/** Google's 400 answers name the field and say what is wrong; both reach the log, addresses and ids never do. */
import { describe, expect, it } from 'vitest';
import { describeGoogleError } from '../src/lib/diag.js';

const err400 = (e: object) => ({ response: { status: 400, data: { error: { code: 400, errors: [{ reason: 'invalid', ...e }] } } } });

describe('describeGoogleError: field and message of a refused request', () => {
  it('keeps the field Google objected to and its plain message', () => {
    expect(describeGoogleError(err400({ location: 'backgroundColor', message: 'Invalid Value' })))
      .toMatchObject({ status: 400, reason: 'invalid', field: 'backgroundColor', message: 'Invalid Value' });
  });

  it('drops a message that carries an address or an id', () => {
    expect(describeGoogleError(err400({ message: 'Not found: jo@example.org' })).message).toBeUndefined();
    expect(describeGoogleError(err400({ message: 'Bad id c_8f3k2l9q0w7e6r5t4y3u2i1o0p' })).message).toBeUndefined();
  });
});
