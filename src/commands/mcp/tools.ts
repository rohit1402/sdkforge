import type { OperationBlueprint, ResourceBlueprint, SdkBlueprint } from '../../blueprint/types';
import { toolName } from './helpers';
import { toJsonSchema, type JsonSchema } from './json-schema';

export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: JsonSchema;
}

/**
 * Walks the blueprint and emits one MCP tool definition per operation.
 * Each tool's inputSchema is a JSON Schema describing path/query/body params
 * as a flat object so an agent can invoke the tool with one argument map.
 */
export function buildToolDefinitions(blueprint: SdkBlueprint): ToolDefinition[] {
    const definitions: ToolDefinition[] = [];
    for (const resource of blueprint.resources) {
        for (const op of resource.operations) {
            definitions.push(buildToolDefinition(resource, op, blueprint));
        }
    }
    return definitions;
}

function buildToolDefinition(
    resource: ResourceBlueprint,
    op: OperationBlueprint,
    blueprint: SdkBlueprint,
): ToolDefinition {
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];

    for (const p of op.pathParams) {
        properties[p.name] = toJsonSchema(p.type, blueprint);
        required.push(p.name);
    }
    for (const p of op.queryParams) {
        properties[p.name] = toJsonSchema(p.type, blueprint);
        if (p.required) required.push(p.name);
    }
    if (op.requestBody && op.requestBody.contentType === 'application/json') {
        properties['body'] = toJsonSchema(op.requestBody.type, blueprint);
        if (op.requestBody.required) required.push('body');
    }

    const inputSchema: JsonSchema = { type: 'object', properties };
    if (required.length > 0) inputSchema.required = required;

    return {
        name: toolName(resource.name, op.name),
        description: op.summary ?? op.description ?? `${op.method} ${op.path}`,
        inputSchema,
    };
}
