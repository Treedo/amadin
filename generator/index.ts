import { promises as fs } from 'fs';
import path from 'path';

import { buildPrismaSchema, buildUiManifest, validateConfig } from './schemaBuilder.js';

async function main() {
  const configPath = process.argv[2] ?? path.resolve('examples/demo-config.json');
  const outputDir = process.argv[3] ?? path.resolve('generated');
  const schemaPath = path.join(outputDir, 'app.prisma');
  const manifestPath = path.join(outputDir, 'ui-manifest.json');

  const fileContent = await fs.readFile(configPath, 'utf8');
  const rawConfig = JSON.parse(fileContent);
  const config = validateConfig(rawConfig);

  const prismaSchema = buildPrismaSchema(config);
  const uiManifest = buildUiManifest(config);

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(schemaPath, prismaSchema, 'utf8');
  await fs.writeFile(manifestPath, JSON.stringify(uiManifest, null, 2), 'utf8');

  console.log(`Generated Prisma schema at ${schemaPath}`);
  console.log(`Generated UI manifest at ${manifestPath}`);
}

main().catch((error) => {
  console.error('Generator failed', error);
  process.exit(1);
});
