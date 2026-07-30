import { apiFetch } from '@src/api/client';
import { globalConfigSchema } from '@src/schemas/configSchema';
import type {
  CompleteServerConfig,
  GlobalConfig,
  RawGlobalConfig,
  RawPathConfig,
} from '@src/types/config';

export async function getGlobalConfig(serverUrl?: string): Promise<GlobalConfig> {
  const raw = await apiFetch<unknown>('/v3/config/global/get', undefined, serverUrl);
  return globalConfigSchema.parse(raw) as GlobalConfig;
}

export async function getRawGlobalConfig(serverUrl?: string): Promise<RawGlobalConfig> {
  return apiFetch<RawGlobalConfig>('/v3/config/global/get', undefined, serverUrl);
}

export async function getPathDefaultsConfig(serverUrl?: string): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>('/v3/config/pathdefaults/get', undefined, serverUrl);
}

export function composeCompleteServerConfig(
  rawGlobalConfig: RawGlobalConfig,
  pathDefaults: Record<string, unknown>
): CompleteServerConfig {
  const globalConfig = { ...rawGlobalConfig };
  const paths = isRecord(rawGlobalConfig.paths)
    ? Object.fromEntries(
        Object.entries(rawGlobalConfig.paths).filter(
          (entry): entry is [string, Omit<RawPathConfig, 'name'>] => isRecord(entry[1])
        )
      )
    : {};
  delete globalConfig.paths;

  return {
    ...globalConfig,
    pathDefaults,
    paths,
  };
}

export async function getCompleteServerConfig(serverUrl?: string): Promise<CompleteServerConfig> {
  if (serverUrl === undefined) {
    const [rawGlobalConfig, pathDefaults] = await Promise.all([
      getRawGlobalConfig(),
      getPathDefaultsConfig(),
    ]);

    return composeCompleteServerConfig(rawGlobalConfig, pathDefaults);
  }

  const [rawGlobalConfig, pathDefaults] = await Promise.all([
    getRawGlobalConfig(serverUrl),
    getPathDefaultsConfig(serverUrl),
  ]);

  return composeCompleteServerConfig(rawGlobalConfig, pathDefaults);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
