import { Command } from 'commander';
import pkg from '../package.json' with { type: 'json' };

import { registerInitCommand } from './commands/init.js';
import { registerGenerateCommand } from './commands/generate.js';
import { registerStartCommand } from './commands/start.js';
import { registerMigrateCommand } from './commands/migrate.js';

const program = new Command();

program
  .name('amadin')
  .description('CLI tooling for the Amadin framework')
  .version(pkg.version);

registerInitCommand(program);
registerGenerateCommand(program);
registerStartCommand(program);
registerMigrateCommand(program);

program.parse(process.argv);
