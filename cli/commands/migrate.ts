import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

import { generateArtifacts } from '@generator/generateArtifacts.js';
import { createMigrationPlan } from '@generator/migrationPlan.js';

export function registerMigrateCommand(program: Command) {
  program
    .command('migrate')
    .description('Generate and apply migrations for the application schema')
    .argument('[config]', 'Path to config JSON', 'examples/demo-config.json')
    .option('-o, --output <dir>', 'Output directory', 'generated')
    .action(async (configPath: string, options: { output: string }) => {
      const outputDir = path.resolve(options.output);
      await fs.mkdir(outputDir, { recursive: true });

      const result = await generateArtifacts(configPath, outputDir);
  const plan = createMigrationPlan(result.diff);

      if (!plan.hasChanges) {
        console.log('No entity changes detected. Migrations are up to date.');
        return;
      }

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

      console.log(`Created migration ${folderName}`);

      await runPrismaDeploy(result.schemaPath);

      console.log('Prisma migrations applied successfully.');
    });
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

function renderReadme(plan: ReturnType<typeof createMigrationPlan>): string {
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

function runPrismaDeploy(schemaPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['prisma', 'migrate', 'deploy', `--schema=${schemaPath}`], {
      stdio: 'inherit'
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Prisma migrate deploy exited with code ${code}`));
      }
    });
    child.on('error', (error) => reject(error));
  });
}
