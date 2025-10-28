import { promises as fs } from 'fs';
import path from 'path';

import { generateArtifacts } from './generateArtifacts.js';

async function main() {
  const configPath = process.argv[2] ?? path.resolve('examples/demo-config.json');
  const outputDir = process.argv[3] ?? path.resolve('generated');
  await fs.mkdir(outputDir, { recursive: true });
  const result = await generateArtifacts(configPath, outputDir);

  console.log(`Generated Prisma schema at ${result.schemaPath}`);
  console.log(`Generated UI manifest at ${result.manifestPath}`);
  console.log(`Wrote entity state snapshot at ${result.statePath}`);
  console.log(`Wrote migration diff report at ${result.reportPath}`);
  console.log(
    `Diff summary: +${result.report.summary.added.length} / ~${result.report.summary.updated.length} / -${result.report.summary.removed.length}`
  );
}

main().catch((error) => {
  console.error('Generator failed', error);
  process.exit(1);
});
