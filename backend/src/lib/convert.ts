import { promisify } from "util";  //x trasformare funzioni callback-based in promise-based
import JSZip from "jszip";  //x leggere e manipolare file ZIP (usato per correggere i file Word corrotti con backslash nei nomi degli entry)

//prende un file Word (.docx o .doc) in Buffer e lo converte in PDF usando LibreOffice, con una fase intermedia di “fix ZIP” per Word corrotti o strani.

let _convert:  //global var, che inizialmente è null poi diventa la funzione di conversione LibreOffice (cosi non la devi ricaricare sempre)
  | ((buf: Buffer, ext: string, filter: undefined) => Promise<Buffer>)
  | null = null;

async function getConvert() {
  if (!_convert) {  //se è null allora execute this
    const libre = await import("libreoffice-convert");  //import dinamico dentro condition, UTILIZZO LIBREOFFICE converter (installabile su pc/server, best x local-hosting)
    _convert = promisify(libre.default.convert.bind(libre.default));  //set
  }
  return _convert;
}

/**
 * Some older Windows/Word archives store .docx entries with backslash
 * separators (e.g. `word\document.xml`). Mammoth and LibreOffice both look
 * up entries by exact string and miss those files, producing empty output
 * or conversion failures. Rewrite any such entries to the canonical
 * forward-slash form before handing the buffer off.
 */
export async function normalizeDocxZipPaths(buffer: Buffer): Promise<Buffer> {
  let zip: JSZip;
  try {  //se il file non è zip valido allora ritorna il buffer originale
    zip = await JSZip.loadAsync(buffer);
  } catch {
    return buffer;
  }
  const renames: [string, string][] = [];   //lista di [vecchioNome, nuovoNome]
  zip.forEach((relativePath) => {  //scorre tutti i file dentro il docx
    if (relativePath.includes("\\")) {  //se trova backslash
      renames.push([relativePath, relativePath.replace(/\\/g, "/")]);
    }  
  });  //e.g. word\document.xml -> word/document.xml
  if (renames.length === 0) return buffer;
  for (const [oldPath, newPath] of renames) {  //per ogni file da correggere...
    const entry = zip.file(oldPath);   //prende file originale
    if (!entry) continue;
    const content = await entry.async("nodebuffer");  //legge contenuto file dentro zip
    zip.remove(oldPath);  //elimina versione sbagliata
    zip.file(newPath, content);  //reinserisce con path corretto
  }
  return zip.generateAsync({ type: "nodebuffer" });  //ricrea .docx corretto
}

/**
 * Convert a DOCX/DOC buffer to PDF using LibreOffice.
 * Throws if LibreOffice is not installed or conversion fails.
 */
export async function docxToPdf(buffer: Buffer): Promise<Buffer> {
  const convert = await getConvert();
  const normalized = await normalizeDocxZipPaths(buffer);
  return convert(normalized, ".pdf", undefined);  //DOCX -> PDF
}

export function convertedPdfKey(userId: string, docId: string): string {
  return `converted-pdfs/${userId}/${docId}.pdf`;
}  //genera path file per storage (S3, R2, ecc.), e.g.converted-pdfs/123/user123.pdf


