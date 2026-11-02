export const OBJECT_STORAGE_PORT = Symbol('OBJECT_STORAGE_PORT');

export interface ObjectStoragePort {
  createUploadUrl(input: {
    key: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<string>;
  createDownloadUrl(input: {
    key: string;
    mimeType: string;
    fileName: string;
  }): Promise<string>;
  headObject(
    key: string,
  ): Promise<{ sizeBytes: number; mimeType: string } | null>;
}
