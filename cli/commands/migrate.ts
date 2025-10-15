import { Command } from 'commander';

export function registerMigrateCommand(program: Command) {
  program
    .command('migrate')
    .description('Run Prisma migrations for the core schema')
    .action(async () => {
      console.log('Placeholder: run `npx prisma migrate deploy --schema=core/core.prisma`');
    });
}
