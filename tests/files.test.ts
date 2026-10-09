import { describe, expect, it } from 'vitest';
import { b64ToBytes, bytesToB64, originalB64, originalBytes } from '../src/lib/files';

describe('original file encoding', () => {
  it('round-trips arbitrary bytes, including large buffers', () => {
    const big = new Uint8Array(5 * 1024 * 1024).map((_, i) => (i * 31 + 7) & 255);
    const back = b64ToBytes(bytesToB64(big));
    expect(back.length).toBe(big.length);
    expect(back.every((v, i) => v === big[i])).toBe(true);
  });
  it('works from either representation', () => {
    const data = new Uint8Array([0, 1, 2, 250, 255]);
    const a = { name: 'x.xlsx', mime: 'm', data };
    const b = { name: 'x.xlsx', mime: 'm', b64: originalB64(a) };
    expect(Array.from(originalBytes(b))).toEqual(Array.from(data));
    expect(originalB64(b)).toBe(originalB64(a));
  });
});
