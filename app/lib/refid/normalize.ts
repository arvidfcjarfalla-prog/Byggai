import type { RefIdKind, RefIdParts } from "./types";

const REFID_PATTERN = /^(DOC|FIL)([0-9]{2}[0-9A-HJKMNPQRSTVWXYZ]{6,8})([0-9A-HJKMNPQRSTVWXYZ])$/;

function toKind(value: string): RefIdKind | null {
  if (value === "DOC" || value === "FIL") return value;
  return null;
}

export function parseRefId(input: string): RefIdParts | null {
  const compact = input.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");
  const matched = compact.match(REFID_PATTERN);
  if (!matched) return null;

  const kind = toKind(matched[1]);
  if (!kind) return null;

  return {
    kind,
    body: matched[2],
    checksum: matched[3],
  };
}

export function normalizeRefId(input: string): string {
  const parsed = parseRefId(input);
  if (!parsed) {
    return input.trim().toUpperCase();
  }
  return `${parsed.kind}-${parsed.body}-${parsed.checksum}`;
}
