import fs from "node:fs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — legacy build ships its own types loosely
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface PdfPage {
  page: number;
  text: string;
}

/** Extract text per page. Whitespace is normalised to single spaces. */
export async function extractPages(file: string): Promise<PdfPage[]> {
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const pages: PdfPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it: { str?: string }) => it.str ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push({ page: i, text });
  }
  return pages;
}

/** Full document text as one string. */
export async function extractText(file: string): Promise<string> {
  const pages = await extractPages(file);
  return pages.map((p) => p.text).join("\n");
}
