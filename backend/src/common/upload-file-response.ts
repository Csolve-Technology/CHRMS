import { StreamableFile } from '@nestjs/common';
import { createReadStream } from 'fs';
import { extname } from 'path';

const MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.doc': 'application/msword',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
};

export function mimeForFilename(filename: string): string {
  return MIME_BY_EXT[extname(filename).toLowerCase()] ?? 'application/octet-stream';
}

/** Stream an uploaded file for download or inline preview. */
export function streamUploadedFile(
  absolutePath: string,
  filename: string,
  inline = false,
): StreamableFile {
  const type = mimeForFilename(filename);
  const disposition = inline
    ? `inline; filename="${filename}"`
    : `attachment; filename="${filename}"`;
  return new StreamableFile(createReadStream(absolutePath), {
    type,
    disposition,
  });
}
