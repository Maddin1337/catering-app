/// <reference types="node" />
import fs from 'node:fs';
import path from 'node:path';

import team from '@/lib/i18n/de/team.json';

// Jeder feste Textschlüssel im Angebotsbereich muss in team.json stehen (sonst zeigt die App den
// Schlüssel selbst an). Mehrzahl-Schlüssel zählen über ihre Endung _one/_other.
const root = path.join(__dirname, '..');
const files = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : files(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });

const lookup = (key: string): unknown =>
  key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], team);

describe('Texte im Angebotsbereich', () => {
  it('findet jeden verwendeten Schlüssel', () => {
    const missing: string[] = [];
    for (const f of files(root)) {
      const src = fs.readFileSync(f, 'utf8');
      for (const [, key] of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)'/g)) {
        if (lookup(key!) === undefined && lookup(`${key}_other`) === undefined)
          missing.push(`${path.basename(f)}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
