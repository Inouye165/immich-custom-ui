export interface ArchiveFeaturedImage {
  caption: string;
  id: string;
  offsetX: number;
  offsetY: number;
  scale: number;
  thumbnailUrl: string;
  title: string;
}

export interface ArchivePreferences {
  featuredImages: ArchiveFeaturedImage[];
  name: string;
}