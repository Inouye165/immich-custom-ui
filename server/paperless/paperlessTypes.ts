/** Raw Paperless-ngx API response types. */

export interface PaperlessDocument {
  id: number;
  title: string;
  created: string;
  added: string;
  correspondent: number | null;
  document_type: number | null;
  archive_serial_number: number | null;
  content?: string;
}

export interface PaperlessSearchResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: PaperlessDocument[];
}
