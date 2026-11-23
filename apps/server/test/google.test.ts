import { describe, expect, it } from 'vitest';
import { verifyGoogleToken } from '../src/google.ts';

const b64url = (b: ArrayBuffer | Uint8Array | string) =>
  Buffer.from(typeof b === 'string' ? b : b instanceof Uint8Array ? b : new Uint8Array(b)).toString('base64url');

async function setup() {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as { n: string; e: string };
  const keys = [{ kid: 'k1', kty: 'RSA', n: jwk.n, e: jwk.e }];
  const sign = async (payload: Record<string, unknown>, header: Record<string, unknown> = { alg: 'RS256', kid: 'k1', typ: 'JWT' }, key = pair.privateKey) => {
    const body = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(body));
    return `${body}.${b64url(sig)}`;
  };
  return { keys, sign };
}

const NOW = 1_800_000_000;
const good = { iss: 'https://accounts.google.com', aud: 'client-123', sub: '1098', email: 'rodic@example.com', email_verified: true, iat: NOW - 10, exp: NOW + 3600 };

describe('Google ID tokens', () => {
  it('accepts a valid one', async () => {
    const { keys, sign } = await setup();
    expect(await verifyGoogleToken(await sign(good), 'client-123', keys, NOW)).toEqual({ sub: '1098', email: 'rodic@example.com' });
  });

  it('refuses one for another app, from another issuer, expired, or not yet valid', async () => {
    const { keys, sign } = await setup();
    expect(await verifyGoogleToken(await sign(good), 'someone-else', keys, NOW)).toBeNull();
    expect(await verifyGoogleToken(await sign({ ...good, iss: 'https://evil.example' }), 'client-123', keys, NOW)).toBeNull();
    expect(await verifyGoogleToken(await sign({ ...good, exp: NOW - 3600 }), 'client-123', keys, NOW)).toBeNull();
    expect(await verifyGoogleToken(await sign({ ...good, iat: NOW + 3600 }), 'client-123', keys, NOW)).toBeNull();
  });

  it('refuses a forged or tampered one', async () => {
    const { keys, sign } = await setup();
    const other = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
    expect(await verifyGoogleToken(await sign(good, undefined, other.privateKey), 'client-123', keys, NOW)).toBeNull();
    const [h, , s] = (await sign(good)).split('.');
    const tampered = `${h}.${b64url(JSON.stringify({ ...good, sub: 'someone' }))}.${s}`;
    expect(await verifyGoogleToken(tampered, 'client-123', keys, NOW)).toBeNull();
    expect(await verifyGoogleToken(await sign(good, { alg: 'none', kid: 'k1' }), 'client-123', keys, NOW)).toBeNull();
    expect(await verifyGoogleToken(await sign(good, { alg: 'RS256', kid: 'unknown' }), 'client-123', keys, NOW)).toBeNull();
    expect(await verifyGoogleToken('not.a.token', 'client-123', keys, NOW)).toBeNull();
  });

  it('leaves out an unverified email', async () => {
    const { keys, sign } = await setup();
    expect(await verifyGoogleToken(await sign({ ...good, email_verified: false }), 'client-123', keys, NOW)).toEqual({ sub: '1098', email: '' });
  });
});
