export function extractKeyId(plainKey: string): string | null {
  if (!plainKey || !plainKey.startsWith('VMX_')) {
    return null;
  }
  const parts = plainKey.split('_');
  if (parts.length < 3) {
    return null;
  }
  const [_, keyId] = parts;
  if (!/^[a-f0-9]{32}$/i.test(keyId)) {
    return null;
  }
  return keyId;
}
