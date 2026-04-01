import type { ImmichSmartSearchPayload } from '../immich/immichTypes';
import type { ValidSearchRequest } from './searchSchemas';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 60;

export function buildSmartSearchPayload(
  request: ValidSearchRequest,
): ImmichSmartSearchPayload {
  return {
    query: request.query,
    page: DEFAULT_PAGE,
    size: DEFAULT_PAGE_SIZE,
    ...(request.startDate ? { takenAfter: toStartOfLocalDay(request.startDate) } : {}),
    ...(request.endDate ? { takenBefore: toEndOfLocalDay(request.endDate) } : {}),
  };
}

function toStartOfLocalDay(date: string): string {
  return `${date}T00:00:00.000`;
}

function toEndOfLocalDay(date: string): string {
  return `${date}T23:59:59.999`;
}
