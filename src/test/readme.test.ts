import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * W-03: the README is real Roodle docs, not the create-next-app boilerplate,
 * and it documents every env var the app code reads (names only).
 */
const root = resolve(import.meta.dirname, '../..');
const readme = readFileSync(join(root, 'README.md'), 'utf8');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}

function envVarsReadByApp(): string[] {
  const names = new Set<string>();
  for (const file of sourceFiles(join(root, 'src'))) {
    for (const m of readFileSync(file, 'utf8').matchAll(
      /process\.env\.([A-Z][A-Z0-9_]*)/g,
    )) {
      names.add(m[1]);
    }
  }
  names.delete('NODE_ENV'); // set by Next itself, not configured by hand
  return [...names].sort();
}

describe('README', () => {
  it('is not the create-next-app boilerplate', () => {
    expect(readme).not.toMatch(/create-next-app/i);
    expect(readme).not.toMatch(/bootstrapped with/i);
    expect(readme).toMatch(/^# Roodle/m);
  });

  it('documents every env var the app reads', () => {
    const vars = envVarsReadByApp();
    expect(vars).toEqual(
      expect.arrayContaining([
        'APP_URL',
        'AUTH_SECRET',
        'DATABASE_URL',
        'EMAIL_FROM',
        'PGLITE_PATH',
        'RESEND_API_KEY',
      ]),
    );
    for (const name of vars) expect(readme).toContain(`\`${name}\``);
  });

  it('documents every npm script', () => {
    const pkg = JSON.parse(
      readFileSync(join(root, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    for (const script of Object.keys(pkg.scripts)) {
      expect(readme).toContain(`npm run ${script}`);
    }
  });

  it('points at the migrations folder and the deploy decisions', () => {
    expect(readme).toContain('drizzle/');
    expect(readme).toMatch(/D7/);
    expect(readme).toMatch(/D9/);
  });
});
