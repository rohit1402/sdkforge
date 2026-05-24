import { Command } from 'commander';
import { resolve } from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { buildBlueprint } from '../../blueprint/build';
import { parseSpec } from '../../parser';
import { SDKError } from '../../runtime/request';
import { validateInputPath } from '../helper';
import { buildToolHandlers } from './handlers';
import { buildToolDefinitions } from './tools';

interface McpOptions {
    name: string;
    version: string;
}

export function registerMcpCommand(program: Command): void {
    program
        .command('mcp <spec>')
        .description('Run sdkforge as an MCP server, exposing each OpenAPI operation as a tool')
        .option('--name <name>', 'MCP server name advertised to the client', 'sdkforge')
        .option('--version <version>', 'MCP server version advertised to the client', '0.1.0')
        .action(async (specArg: string, opts: McpOptions) => {
            try {
                await runMcp(resolve(specArg), opts);
            } catch (err) {
                // stdout is reserved for the MCP protocol; log to stderr.
                const message = err instanceof Error ? err.message : String(err);
                process.stderr.write(`sdkforge mcp: ${message}\n`);
                process.exit(1);
            }
        });
}

async function runMcp(specPath: string, opts: McpOptions): Promise<void> {
    validateInputPath(specPath);

    const doc = await parseSpec(specPath);
    const { blueprint } = buildBlueprint(doc);

    const config = {
        apiKey: process.env['API_KEY'],
        baseURL: process.env['API_BASE_URL'] ?? blueprint.meta.baseUrl,
    };

    const tools = buildToolDefinitions(blueprint);
    const handlers = buildToolHandlers(blueprint, config);

    const server = new Server(
        { name: opts.name, version: opts.version },
        { capabilities: { tools: {} } },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

    server.setRequestHandler(CallToolRequestSchema, async (req) => {
        const name = req.params.name;
        const args = (req.params.arguments ?? {}) as Record<string, unknown>;
        const handler = handlers[name];
        if (!handler) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            };
        }
        try {
            const result = await handler(args);
            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            };
        } catch (err) {
            const message =
                err instanceof SDKError
                    ? `HTTP ${err.status} ${err.statusText}: ${JSON.stringify(err.body)}`
                    : err instanceof Error
                      ? err.message
                      : String(err);
            return { isError: true, content: [{ type: 'text', text: message }] };
        }
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
}
