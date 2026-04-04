import { type VectorConfig, getVectorConfig } from '../config';

export type { VectorConfig };

export { getVectorConfig };

export function isVectorEnabled(): boolean {
  return getVectorConfig() !== null;
}
