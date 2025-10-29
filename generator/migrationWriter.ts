import { promises as fs } from 'fs';
import path from 'path';

import type { MigrationPlan } from './migrationPlan.js';

export interface WriteMigrationResult {
  folderName: string;
  migrationPath: string;
  readmePath: string;
}

export async function writeMigrationArtifacts(
  plan: MigrationPlan,
  outputDir: string
): Promise<WriteMigrationResult> {
  const migrationsDir = path.join(outputDir, 'migrations');
  await fs.mkdir(migrationsDir, { recursive: true });

  const timestamp = buildTimestamp();
  const folderName = `${timestamp}_${plan.slug}`;
  const migrationDir = path.join(migrationsDir, folderName);
  await fs.mkdir(migrationDir, { recursive: true });

  const migrationPath = path.join(migrationDir, 'migration.sql');
  const readmePath = path.join(migrationDir, 'README.md');

  const migrationSql = plan.sql.trim() ? `${plan.sql.trim()}\n` : '';
  await fs.writeFile(migrationPath, migrationSql, 'utf8');
  await fs.writeFile(readmePath, renderReadme(plan), 'utf8');

  return { folderName, migrationPath, readmePath };
}

function buildTimestamp(): string {
  const now = new Date();
  const pad = (value: number) => value.toString().padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join('');
}

function renderReadme(plan: MigrationPlan): string {
  const sections = [
    '# Migration summary',
    '',
    `- Created tables: ${plan.summary.createdTables.length ? plan.summary.createdTables.join(', ') : '-'}`,
    `- Altered tables: ${plan.summary.alteredTables.length ? plan.summary.alteredTables.join(', ') : '-'}`,
    `- Dropped tables: ${plan.summary.droppedTables.length ? plan.summary.droppedTables.join(', ') : '-'}`,
    '',
    '## SQL',
    '',
    '```sql',
    plan.sql,
    '```'
  ];
  return sections.join('\n');
}
