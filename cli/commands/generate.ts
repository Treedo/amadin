import { Command } from 'commander';

import { generateArtifacts } from '@generator/generateArtifacts.js';
import path from 'path';

export function registerGenerateCommand(program: Command) {
  program
    .command('generate')
    .description('Generate Prisma schema and UI manifest for a config file')
    .argument('[config]', 'Path to config JSON', 'examples/demo-config.json')
    .option('-o, --output <dir>', 'Output directory', 'generated')
    .action(async (configPath: string, options: { output: string }) => {
      const outputDir = path.resolve(options.output);
      const result = await generateArtifacts(configPath, outputDir);

      console.log(`Generated outputs in ${outputDir}`);
      console.log(
        `Diff summary: +${result.report.summary.added.length} / ~${result.report.summary.updated.length} / -${result.report.summary.removed.length}`
      );
    });
}
