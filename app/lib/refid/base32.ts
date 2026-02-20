const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const TOLERANT_MAP: Record<string, string> = {
  I: "1",
  L: "1",
  O: "0",
  U: "V",
};

const VALUE_MAP = new Map<string, number>();
ALPHABET.split("").forEach((char, index) => {
  VALUE_MAP.set(char, index);
});

function normalizeBase32Input(input: string): string {
  return input
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]/g, "")
    .split("")
    .map((char) => TOLERANT_MAP[char] ?? char)
    .join("");
}

export function valueToBase32Char(value: number): string {
  return ALPHABET[value & 31] ?? "0";
}

export function base32CharToValue(char: string): number | undefined {
  const normalized = normalizeBase32Input(char);
  if (!normalized) return undefined;
  return VALUE_MAP.get(normalized[0]);
}

export function encodeBase32(bytes: Uint8Array, outputLength?: number): string {
  let buffer = 0;
  let bits = 0;
  let output = "";

  for (let i = 0; i < bytes.length; i++) {
    buffer = (buffer << 8) | bytes[i];
    bits += 8;

    while (bits >= 5) {
      bits -= 5;
      output += valueToBase32Char((buffer >>> bits) & 31);
    }
  }

  if (bits > 0) {
    output += valueToBase32Char((buffer << (5 - bits)) & 31);
  }

  if (outputLength && output.length > outputLength) {
    return output.slice(0, outputLength);
  }

  if (outputLength && output.length < outputLength) {
    return `${output}${"0".repeat(outputLength - output.length)}`;
  }

  return output;
}

export function decodeBase32(input: string): Uint8Array {
  const normalized = normalizeBase32Input(input);
  if (!normalized) return new Uint8Array(0);

  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < normalized.length; i++) {
    const value = base32CharToValue(normalized[i]);
    if (value === undefined) continue;

    buffer = (buffer << 5) | value;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >>> bits) & 0xff);
    }
  }

  return new Uint8Array(bytes);
}

export const CROCKFORD_BASE32_ALPHABET = ALPHABET;
