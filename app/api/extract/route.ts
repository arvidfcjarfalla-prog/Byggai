import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { NextResponse } from "next/server";

type RawAction = {
  title?: string;
  category?: string;
  status?: "Planerad" | "Eftersatt" | "Genomförd";
  plannedYear?: number;
  estimatedPriceSek?: number;
  emissionsKgCo2e?: number;
  details?: string;
  rawRow?: string;
  sourceSheet?: string;
  sourceRow?: number;
  extraDetails?: Array<{
    label?: string;
    value?: string;
  }>;
};

function normalizeStatus(
  value: string | undefined
): "Planerad" | "Eftersatt" | "Genomförd" {
  if (!value) return "Planerad";
  const v = value.toLowerCase();
  if (v.includes("efters")) return "Eftersatt";
  if (v.includes("genom")) return "Genomförd";
  return "Planerad";
}

function extractJsonBlock(input: string): string | null {
  const start = input.indexOf("{");
  const end = input.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return input.slice(start, end + 1);
}

function isLikelyText(content: string): boolean {
  if (!content || content.trim().length < 40) return false;
  const printable = content.match(/[\p{L}\p{N}\s.,;:()\-_/]/gu)?.length ?? 0;
  return printable / content.length > 0.65;
}

async function toText(file: File): Promise<string> {
  const ext = path.extname(file.name).toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (
    file.type.startsWith("text/") ||
    [".txt", ".csv", ".md", ".json"].includes(ext)
  ) {
    return buffer.toString("utf-8");
  }

  if ([".doc", ".docx", ".rtf", ".odt"].includes(ext)) {
    const tempPath = path.join(
      os.tmpdir(),
      `byggplattformen-${randomUUID()}${ext}`
    );
    await fs.writeFile(tempPath, buffer);
    try {
      const { execFile } = await import("child_process");
      const text = await new Promise<string>((resolve, reject) => {
        execFile(
          "textutil",
          ["-convert", "txt", "-stdout", tempPath],
          { maxBuffer: 10 * 1024 * 1024 },
          (error, stdout) => {
            if (error) {
              reject(error);
              return;
            }
            resolve(stdout);
          }
        );
      });
      return text;
    } finally {
      await fs.unlink(tempPath).catch(() => undefined);
    }
  }

  if ([".xlsx", ".xls", ".xlsm"].includes(ext)) {
    const xlsx = await import("xlsx");
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const lines: string[] = [];

    for (const sheetName of workbook.SheetNames.slice(0, 8)) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      lines.push(`--- Ark: ${sheetName} ---`);
      const rows = xlsx.utils.sheet_to_json<(string | number | boolean | null)[]>(
        sheet,
        { header: 1, raw: false }
      );
      for (const row of rows.slice(0, 500)) {
        const rowText = row
          .map((cell) => (cell == null ? "" : String(cell).trim()))
          .filter(Boolean)
          .join(" | ");
        if (rowText) lines.push(rowText);
      }
    }

    return lines.join("\n");
  }

  if (ext === ".pdf") {
    // PDF OCR/text extraction can be added next. For now, require text-based formats.
    throw new Error(
      "PDF-extraktion är ännu inte aktiverad i servern. Använd DOCX/TXT tills OCR är på plats."
    );
  }

  return buffer.toString("utf-8");
}

function getOutputText(responseJson: unknown): string {
  if (!responseJson || typeof responseJson !== "object") return "";
  const record = responseJson as Record<string, unknown>;

  if (typeof record.output_text === "string") {
    return record.output_text;
  }

  const output = Array.isArray(record.output) ? record.output : [];
  const textParts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? ((item as Record<string, unknown>).content as unknown[])
      : [];
    for (const c of content) {
      if (!c || typeof c !== "object") continue;
      const text = (c as Record<string, unknown>).text;
      if (typeof text === "string") textParts.push(text);
    }
  }
  return textParts.join("\n");
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY saknas i miljön." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Ingen fil mottagen i request." },
        { status: 400 }
      );
    }

    const text = await toText(file);
    if (!isLikelyText(text)) {
      return NextResponse.json(
        { error: "Kunde inte läsa tillräckligt textinnehåll från filen." },
        { status: 422 }
      );
    }

    const prompt = `Du extraherar åtgärder ur en underhållsplan för BRF.
Returnera ENDAST JSON i formatet:
{
  "actions": [
    {
      "title": "string",
      "category": "string",
      "status": "Planerad | Eftersatt | Genomförd",
      "plannedYear": 2026,
      "estimatedPriceSek": 250000,
      "emissionsKgCo2e": 800,
      "details": "kort sammanfattning av kompletterande information",
      "extraDetails": [{"label":"fältnamn","value":"fältdetalj"}]
    }
  ]
}
Regler:
- Minst 3 och max 30 actions.
- Om data saknas, gör rimliga uppskattningar.
- plannedYear mellan 2025 och 2035.
- estimatedPriceSek som heltal i SEK.
- emissionsKgCo2e som nummer.
- Skriv på svenska.`;

    const aiResp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          { role: "system", content: prompt },
          {
            role: "user",
            content: `Filnamn: ${file.name}\n\nInnehåll:\n${text.slice(0, 120_000)}`,
          },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      return NextResponse.json(
        { error: `OpenAI-anrop misslyckades: ${aiResp.status} ${errText}` },
        { status: 502 }
      );
    }

    const aiJson = await aiResp.json();
    const outputText = getOutputText(aiJson);
    const jsonBlock = extractJsonBlock(outputText);
    if (!jsonBlock) {
      return NextResponse.json(
        { error: "Kunde inte tolka JSON från AI-svaret." },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(jsonBlock) as { actions?: RawAction[] };
    const rawActions = Array.isArray(parsed.actions) ? parsed.actions : [];
    if (rawActions.length === 0) {
      return NextResponse.json(
        { error: "AI-svaret innehöll inga åtgärder." },
        { status: 422 }
      );
    }

    const actions = rawActions.slice(0, 30).map((action, index) => {
      const title =
        (action.title && action.title.trim()) || `Åtgärd ${index + 1}`;
      const category =
        (action.category && action.category.trim()) || "Övrigt underhåll";
      const plannedYear =
        typeof action.plannedYear === "number" &&
        action.plannedYear >= 2025 &&
        action.plannedYear <= 2035
          ? Math.round(action.plannedYear)
          : 2026 + Math.floor(index / 4);
      const estimatedPriceSek =
        typeof action.estimatedPriceSek === "number" && action.estimatedPriceSek > 0
          ? Math.round(action.estimatedPriceSek)
          : 120000 + index * 75000;
      const emissionsKgCo2e =
        typeof action.emissionsKgCo2e === "number" && action.emissionsKgCo2e >= 0
          ? Number(action.emissionsKgCo2e.toFixed(1))
          : Number((250 + index * 120).toFixed(1));

      return {
        id: `ai-${Date.now()}-${index}`,
        title,
        category,
        status: normalizeStatus(action.status),
        plannedYear,
        estimatedPriceSek,
        emissionsKgCo2e,
        source: "ai",
        details:
          typeof action.details === "string" && action.details.trim()
            ? action.details.trim().slice(0, 600)
            : undefined,
        rawRow:
          typeof action.rawRow === "string" && action.rawRow.trim()
            ? action.rawRow.trim().slice(0, 600)
            : undefined,
        sourceSheet:
          typeof action.sourceSheet === "string" && action.sourceSheet.trim()
            ? action.sourceSheet.trim().slice(0, 80)
            : undefined,
        sourceRow:
          typeof action.sourceRow === "number" && action.sourceRow > 0
            ? Math.round(action.sourceRow)
            : undefined,
        extraDetails: Array.isArray(action.extraDetails)
          ? action.extraDetails
              .filter((detail) => detail && typeof detail === "object")
              .map((detail) => ({
                label:
                  typeof detail.label === "string" && detail.label.trim()
                    ? detail.label.trim().slice(0, 80)
                    : "Detalj",
                value:
                  typeof detail.value === "string" && detail.value.trim()
                    ? detail.value.trim().slice(0, 220)
                    : "",
              }))
              .filter((detail) => detail.value.length > 0)
              .slice(0, 12)
          : undefined,
      };
    });

    return NextResponse.json({ actions, source: "ai" });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Okänt fel vid extraktion.",
      },
      { status: 500 }
    );
  }
}
