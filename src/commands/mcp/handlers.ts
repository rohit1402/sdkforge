import type { OperationBlueprint, SdkBlueprint } from '../../blueprint/types';
import { toolName } from './helpers';
import { request, type ClientConfig } from '../../runtime/request';

export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

/**
 * Build a name→handler map. Each handler is a closure that knows its
 * operation's HTTP method, path template, and which args go where.
 */
export function buildToolHandlers(
    blueprint: SdkBlueprint,
    config: ClientConfig,
): Record<string, ToolHandler> {
    const map: Record<string, ToolHandler> = {};
    for (const resource of blueprint.resources) {
        for (const op of resource.operations) {
            map[toolName(resource.name, op.name)] = makeHandler(op, config);
        }
    }
    return map;
}

function makeHandler(op: OperationBlueprint, config: ClientConfig): ToolHandler {
    return async (args) => {
        const path = substitutePathParams(op, args);
        const opts: { query?: Record<string, unknown>; body?: unknown } = {};
        if (op.queryParams.length > 0) {
            const q: Record<string, unknown> = {};
            for (const p of op.queryParams) {
                if (args[p.name] !== undefined) q[p.name] = args[p.name];
            }
            if (Object.keys(q).length > 0) opts.query = q;
        }
        if (op.requestBody) {
            opts.body = args['body'];
        }
        return request(config, op.method, path, opts);
    };
}

function substitutePathParams(op: OperationBlueprint, args: Record<string, unknown>): string {
    let result = op.path;
    for (const p of op.pathParams) {
        const value = args[p.name];
        if (value === undefined) {
            throw new Error(`Missing required path parameter: ${p.name}`);
        }
        result = result.replace(`{${p.rawName}}`, String(value));
    }
    return result;
}
