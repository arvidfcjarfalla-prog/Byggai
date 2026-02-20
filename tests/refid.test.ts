import { beforeEach, describe, expect, it } from "vitest";
import { generateRefId } from "../app/lib/refid/generator";
import { normalizeRefId } from "../app/lib/refid/normalize";
import { validateRefId } from "../app/lib/refid/validate";
import { allocateRefId } from "../app/lib/refid/registry";

describe("refid", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("normalizes and validates RefID", () => {
    const refId = generateRefId({ kind: "DOC", date: new Date("2026-02-19T10:00:00.000Z") });
    const noisy = refId.toLowerCase().replaceAll("-", " ");

    expect(normalizeRefId(noisy)).toBe(refId);
    expect(validateRefId(refId)).toBe(true);

    const wrongLastChar = refId.slice(0, -1) + (refId.endsWith("0") ? "1" : "0");
    expect(validateRefId(wrongLastChar)).toBe(false);
  });

  it("retries on collision when allocating RefID", () => {
    const firstCandidate = generateRefId({ kind: "FIL", date: new Date("2026-02-19T10:00:00.000Z") });
    let secondCandidate = generateRefId({ kind: "FIL", date: new Date("2026-02-19T10:00:00.000Z") });
    while (secondCandidate === firstCandidate) {
      secondCandidate = generateRefId({ kind: "FIL" });
    }

    const first = allocateRefId({
      kind: "FIL",
      id: "file-1",
      projectId: "req-1",
      candidateFactory: () => firstCandidate,
    });
    expect(first).toBe(firstCandidate);

    let calls = 0;
    const second = allocateRefId({
      kind: "FIL",
      id: "file-2",
      projectId: "req-1",
      maxAttempts: 3,
      candidateFactory: () => {
        calls += 1;
        return calls === 1 ? firstCandidate : secondCandidate;
      },
    });

    expect(second).toBe(secondCandidate);
    expect(calls).toBe(2);
  });
});
