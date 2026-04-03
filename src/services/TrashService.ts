export interface TrashResult {
  trashedIds: string[];
}

export interface TrashService {
  trashAssets(ids: string[]): Promise<TrashResult>;
}
