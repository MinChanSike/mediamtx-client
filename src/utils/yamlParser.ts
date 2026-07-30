/**
 * Minimal safe YAML-to-JSON parser stub.
 * Phase 1: returns the raw string. Full implementation in Phase 2.
 * TODO: integrate js-yaml or similar in Phase 2.
 */
export function parseYamlToJson(yamlString: string): unknown {
  // Stub: attempt JSON parse first (mediamtx API returns JSON), else return raw string
  try {
    return JSON.parse(yamlString);
  } catch {
    return yamlString;
  }
}
