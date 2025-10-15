import { Command } from 'commander';

import { buildPrismaSchema, buildUiManifest, validateConfig } from '@generator/schemaBuilder.js';
import { promises as fs } from 'fs';
import path from 'path';

export function registerGenerateCommand(program: Command) {
  program
    .command('generate')
    .description('Generate Prisma schema and UI manifest for a config file')
    .argument('[config]', 'Path to config JSON', 'examples/demo-config.json')
    .option('-o, --output <dir>', 'Output directory', 'generated')
    .action(async (configPath: string, options: { output: string }) => {
      const absoluteConfig = path.resolve(configPath);
      const raw = await fs.readFile(absoluteConfig, 'utf8');
      const config = validateConfig(JSON.parse(raw));
      const schema = buildPrismaSchema(config);
      const manifest = buildUiManifest(config);

      const outputDir = path.resolve(options.output);
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(path.join(outputDir, 'app.prisma'), schema, 'utf8');
      await fs.writeFile(path.join(outputDir, 'ui-manifest.json'), JSON.stringify(manifest, null, 2));
      console.log(`Generated outputs in ${outputDir}`);
    });
}
