import { PDFParse } from 'pdf-parse';
import { putBytes } from './storage';

export async function generatePdfCover(
  bookId: string,
  filename: string,
  buffer: Buffer
): Promise<string | null> {
  if (!filename.toLowerCase().endsWith('.pdf')) {
    return null;
  }

  const parser = new PDFParse({
    data: new Uint8Array(buffer),
  });

  try {
    const result = await parser.getScreenshot({
      partial: [1],
      desiredWidth: 600,
      imageBuffer: true,
      imageDataUrl: false,
    });

    const firstPage = result.pages[0];

    if (!firstPage?.data) {
      throw new Error('Could not render the first PDF page.');
    }

    const coverPath = `books/${bookId}/cover-original.png`;

    await putBytes(
      coverPath,
      Buffer.from(firstPage.data)
    );

    return coverPath;
  } finally {
    await parser.destroy();
  }
}