import { name, description, version } from '../package.json';
import { Command } from 'commander';
import { registerGenerateCommand } from './commands/generate';
import { registerMcpCommand } from './commands/mcp';

const program = new Command();

program.name(name).description(description).version(version);

registerGenerateCommand(program);
registerMcpCommand(program);

program.parseAsync(process.argv).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
