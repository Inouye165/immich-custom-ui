import type { ImmichAssetInfo } from '../immich/immichTypes';

export interface NormalizedAssetTimestamp {
  source: 'createdAt' | 'dateTimeOriginal' | 'fileCreatedAt' | 'localDateTime';
  original: string;
  exactInstant: string | null;
  localDate: string | null;
  localHour: number | null;
  localMinute: number | null;
}

export function normalizeAssetTimestamp(
  asset: Pick<ImmichAssetInfo, 'createdAt' | 'fileCreatedAt' | 'localDateTime' | 'exifInfo'>,
): NormalizedAssetTimestamp | null {
  const candidates: Array<[NormalizedAssetTimestamp['source'], string | null | undefined]> = [
    ['dateTimeOriginal', asset.exifInfo?.dateTimeOriginal],
    ['localDateTime', asset.localDateTime],
    ['fileCreatedAt', asset.fileCreatedAt],
    ['createdAt', asset.createdAt],
  ];

  for (const [source, value] of candidates) {
    if (!value) {
      continue;
    }

    const localParts = extractLocalParts(value);
    const parsedDate = new Date(value);
    const exactInstant = Number.isNaN(parsedDate.getTime())
      ? null
      : parsedDate.toISOString();

    if (!localParts && !exactInstant) {
      continue;
    }

    return {
      source,
      original: value,
      exactInstant,
      localDate: localParts?.date ?? exactInstant?.slice(0, 10) ?? null,
      localHour: localParts?.hour ?? null,
      localMinute: localParts?.minute ?? null,
    };
  }

  return null;
}

function extractLocalParts(value: string) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (!match) {
    return null;
  }

  return {
    date: match[1],
    hour: match[2] ? Number(match[2]) : null,
    minute: match[3] ? Number(match[3]) : null,
  };
}

export function formatInstantInTimeZone(isoInstant: string, timeZone: string) {
  const date = new Date(isoInstant);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (!values.year || !values.month || !values.day || !values.hour || !values.minute) {
    return null;
  }

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}