import { promises as fs } from 'fs';
import path from 'path';
export function registerInitCommand(program) {
    program
        .command('init')
        .description('Initialise a new Amadin application configuration')
        .option('-o, --output <path>', 'Output directory', 'amadin-app')
        .action(async (options) => {
        const targetDir = path.resolve(options.output);
        await fs.mkdir(targetDir, { recursive: true });
        await fs.writeFile(path.join(targetDir, 'amadin.config.json'), JSON.stringify({
            appId: 'new-app',
            name: 'New Amadin application',
            entities: [],
            forms: []
        }, null, 2));
        console.log(`Created amadin.config.json in ${targetDir}`);
    });
}
