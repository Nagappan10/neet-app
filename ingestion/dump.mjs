import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "node:fs";
const [file, start, end] = [process.argv[2], +(process.argv[3]||1), +(process.argv[4]||3)];
const data = new Uint8Array(fs.readFileSync(file));
const doc = await getDocument({ data, useSystemFonts: true }).promise;
for (let i = start; i <= Math.min(end, doc.numPages); i++) {
  const page = await doc.getPage(i);
  const tc = await page.getTextContent();
  const txt = tc.items.map((it) => it.str).join(" ").replace(/\s+/g, " ");
  console.log(`\n===== PAGE ${i} =====\n${txt}`);
}
