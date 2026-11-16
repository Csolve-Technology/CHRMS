import { downloadUploadedFile } from "./file-download";

export async function downloadAgreement(path: string) {
  return downloadUploadedFile(path);
}
