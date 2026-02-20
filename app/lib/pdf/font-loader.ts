let cachedFontBytes: Uint8Array | null = null;

async function readFontFromNodeFs(): Promise<Uint8Array> {
  const [{ readFile }, pathModule] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
  ]);
  const fontPath = pathModule.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf");
  const buffer = await readFile(fontPath);
  return new Uint8Array(buffer);
}

async function readFontFromPublicFetch(): Promise<Uint8Array> {
  const response = await fetch("/fonts/NotoSans-Regular.ttf");
  if (!response.ok) {
    throw new Error("Kunde inte ladda in Noto Sans-fonten.");
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function loadNordicFontBytes(): Promise<Uint8Array> {
  if (cachedFontBytes) return cachedFontBytes;

  const canUseBrowserFetch =
    typeof window !== "undefined" &&
    typeof window.location !== "undefined" &&
    window.location.protocol.startsWith("http");

  if (canUseBrowserFetch) {
    try {
      cachedFontBytes = await readFontFromPublicFetch();
      return cachedFontBytes;
    } catch {
      cachedFontBytes = await readFontFromNodeFs();
      return cachedFontBytes;
    }
  }

  cachedFontBytes = await readFontFromNodeFs();

  return cachedFontBytes;
}

export function clearFontByteCacheForTests() {
  cachedFontBytes = null;
}
