import { encodeBase32 } from "./base32";
import { computeRefIdChecksum } from "./checksum";
import type { GenerateRefIdInput } from "./types";

function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    return crypto.getRandomValues(bytes);
  }

  for (let i = 0; i < size; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

function workspaceTag(workspaceId: string | undefined): string {
  if (!workspaceId || workspaceId.trim().length === 0) return "";
  const source = workspaceId.trim().toUpperCase();
  const bytes = new TextEncoder().encode(source);
  return encodeBase32(bytes, 2);
}

export function generateRefId(input: GenerateRefIdInput): string {
  const date = input.date ?? new Date();
  const year = String(date.getFullYear()).slice(-2);

  const randomPart = encodeBase32(randomBytes(5), 8);
  const tag = workspaceTag(input.workspaceId);
  const body = `${year}${tag}${randomPart}`.slice(0, 10);
  const checksum = computeRefIdChecksum(`${input.kind}${body}`);

  return `${input.kind}-${body}-${checksum}`;
}
