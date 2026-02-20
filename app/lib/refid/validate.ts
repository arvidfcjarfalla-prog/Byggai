import { computeRefIdChecksum } from "./checksum";
import { normalizeRefId, parseRefId } from "./normalize";

export function validateRefId(input: string): boolean {
  const parsed = parseRefId(input);
  if (!parsed) return false;
  const expected = computeRefIdChecksum(`${parsed.kind}${parsed.body}`);
  return parsed.checksum === expected;
}

export function assertValidRefId(input: string): string {
  const normalized = normalizeRefId(input);
  if (!validateRefId(normalized)) {
    throw new Error(`Ogiltigt RefID: ${input}`);
  }
  return normalized;
}
