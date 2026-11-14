import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Tauri SQL capability', () => {
  it('allows the repository to load, read, and write SQLite data', () => {
    const capabilityPath = resolve(process.cwd(), 'src-tauri/capabilities/default.json');
    const capability = JSON.parse(readFileSync(capabilityPath, 'utf8')) as {
      permissions: string[];
    };

    expect(capability.permissions).toEqual(
      expect.arrayContaining(['sql:default', 'sql:allow-load', 'sql:allow-execute']),
    );
  });
});
