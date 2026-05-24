import type { OpenAPIV3 } from 'openapi-types';
import { camelCase, isValidIdentifier, pascalCase } from '../utils/casing';
import { singularize } from '../utils/singularize';
import type { BlueprintContext } from './context';
import type { HttpMethod, OperationBlueprint } from './types';

const VERB_BY_METHOD: Record<HttpMethod, string> = {
    GET: 'get',
    POST: 'create',
    PUT: 'update',
    PATCH: 'update',
    DELETE: 'delete',
};

export function resolveResourceName(op: OpenAPIV3.OperationObject, path: string): string {
    const tag = op.tags?.[0];
    if (tag) return camelCase(tag);
    const firstStatic = path.split('/').find((seg) => seg && !seg.startsWith('{'));
    if (firstStatic) return camelCase(firstStatic);
    return 'root';
}

export function resolveOperationName(
    method: HttpMethod,
    path: string,
    op: OpenAPIV3.OperationObject,
    ctx: BlueprintContext,
    location: string,
): string {
    if (op.operationId) {
        const camel = camelCase(op.operationId);
        if (isValidIdentifier(camel)) return camel;
        ctx.warn(
            'fallback-naming',
            `operationId "${op.operationId}" is not a valid identifier`,
            location,
        );
    } else {
        ctx.warn('fallback-naming', `No operationId; deriving name from method+path`, location);
    }
    return deriveOperationName(method, path);
}

function deriveOperationName(method: HttpMethod, path: string): string {
    const tokens = path.split('/').filter(Boolean);
    const parts: string[] = [VERB_BY_METHOD[method]];

    for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i]!;
        if (tok.startsWith('{') && tok.endsWith('}')) {
            const param = tok.slice(1, -1);
            parts.push('By' + pascalCase(param));
        } else {
            const nextIsParam = tokens[i + 1]?.startsWith('{') === true;
            const word = nextIsParam ? singularize(tok) : tok;
            parts.push(pascalCase(word));
        }
    }

    return camelCase(parts.join(' '));
}

export function dedupeNames(
    operations: OperationBlueprint[],
    resourceName: string,
    ctx: BlueprintContext,
): OperationBlueprint[] {
    const used = new Set<string>();
    return operations.map((op) => {
        let candidate = op.name;
        let counter = 2;
        while (used.has(candidate)) {
            candidate = `${op.name}${counter++}`;
        }
        if (candidate !== op.name) {
            ctx.warn(
                'name-collision',
                `Renamed ${op.name} -> ${candidate} in resource "${resourceName}"`,
            );
        }
        used.add(candidate);
        return { ...op, name: candidate };
    });
}
