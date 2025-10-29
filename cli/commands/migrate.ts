import { Command } from 'commander';
import { spawn } from 'child_process';
import path from 'path';

import { generateArtifacts } from '@generator/generateArtifacts.js';
import { createMigrationPlan } from '@generator/migrationPlan.js';
import { writeMigrationArtifacts } from '@generator/migrationWriter.js';

export function registerMigrateCommand(program: Command) {
  program
    .command('migrate')
    .description('Generate and apply migrations for the application schema')
    .argument('[config]', 'Path to config JSON', 'examples/demo-config.json')
    .option('-o, --output <dir>', 'Output directory', 'generated')
    .action(async (configPath: string, options: { output: string }) => {
      const outputDir = path.resolve(options.output);

      const result = await generateArtifacts(configPath, outputDir);
      const plan = createMigrationPlan(result.diff);

      if (!plan.hasChanges) {
        console.log('No entity changes detected. Migrations are up to date.');
        return;
      }

      const { folderName } = await writeMigrationArtifacts(plan, outputDir);

      console.log(`Created migration ${folderName}`);

      await runPrismaDeploy(result.schemaPath);

      console.log('Prisma migrations applied successfully.');
    });
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
