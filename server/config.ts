import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  IMMICH_BASE_URL: z.string().url().optional(),
  IMMICH_API_KEY: z.string().min(1).optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
});

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export interface ServerConfig {
  immichBaseUrl: string;
  immichApiKey: string;
  port: number;
}

export function getPort(): number {
  return envSchema.parse(process.env).PORT;
}

export function getServerConfig(): ServerConfig {
  const parsed = envSchema.parse(process.env);

  if (!parsed.IMMICH_BASE_URL || !parsed.IMMICH_API_KEY) {
    throw new ConfigurationError(
      'Server is not configured for Immich search. Set IMMICH_BASE_URL and IMMICH_API_KEY.',
    );
  }

  return {
    immichBaseUrl: parsed.IMMICH_BASE_URL.replace(/\/$/, ''),
    immichApiKey: parsed.IMMICH_API_KEY,
    port: parsed.PORT,
  };
}
