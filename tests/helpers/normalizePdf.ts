import { PDFDocument } from 'pdf-lib';

// pdf-lib stamps the current time into the metadata, so pin both dates and
// disable object streams to get byte-stable output for comparisons.
export async function normalizePdf(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  doc.setCreationDate(new Date(0));
  doc.setModificationDate(new Date(0));
  return doc.save({ useObjectStreams: false });
}
