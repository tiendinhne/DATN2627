export interface WbElement {
  id: string;
  version: number;
  versionNonce: number;
  isDeleted?: boolean;
  [key: string]: unknown;
}

export const MAX_ELEMENTS_PER_BOARD = 5000;
