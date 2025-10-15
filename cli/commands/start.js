import { spawn } from 'child_process';
export function registerStartCommand(program) {
    program
        .command('start')
        .description('Start the Amadin development server')
        .option('--client', 'Also launch the client dev server')
        .action(async (options) => {
        const processes = [
            spawn('npx', ['tsx', 'server/index.ts'], { stdio: 'inherit', shell: true })
        ];
        if (options.client) {
            processes.push(spawn('npm', ['run', 'dev:client'], { stdio: 'inherit', shell: true }));
        }
        processes.forEach((child) => {
            child.on('exit', (code) => {
                if (code !== 0) {
                    console.error(`Process exited with code ${code}`);
                }
            });
        });
    });
}
