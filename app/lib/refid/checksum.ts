import { base32CharToValue, valueToBase32Char } from "./base32";

function checksumValueForChar(char: string): number {
  const mapped = base32CharToValue(char);
  if (mapped !== undefined) return mapped;
  return char.charCodeAt(0) % 32;
}

export function computeRefIdChecksum(payload: string): string {
  const normalized = payload.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");
  let checksum = 0;

  for (let i = 0; i < normalized.length; i++) {
    const value = checksumValueForChar(normalized[i]);
    checksum = (checksum * 3 + value + i) % 32;
  }

  return valueToBase32Char(checksum);
}
