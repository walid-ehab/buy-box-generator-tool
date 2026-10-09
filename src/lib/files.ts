/** The workbook/CSV the analyst uploaded, kept so viewers can download the exact original. */
export interface OriginalFile {
  name: string;
  mime: string;
  /** bytes, when freshly uploaded or restored from a draft */
  data?: Uint8Array;
  /** base64, when it came from a generated page (decoded only when needed) */
  b64?: string;
}

export function bytesToB64(bytes: Uint8Array): string {
  let out = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(out);
}

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const originalBytes = (o: OriginalFile): Uint8Array => o.data ?? b64ToBytes(o.b64 ?? '');
export const originalB64 = (o: OriginalFile): string => o.b64 ?? bytesToB64(o.data ?? new Uint8Array());

export function downloadOriginal(o: OriginalFile) {
  const blob = new Blob([originalBytes(o) as BlobPart], { type: o.mime || 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = o.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
