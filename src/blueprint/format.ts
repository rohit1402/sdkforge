import { isValidIdentifier } from '../utils/casing';
import type { OperationBlueprint, TypeNode } from './types';

export function formatTypeNode(type: TypeNode | undefined): string {
    if (!type) return 'void';
    const base = renderBase(type);
    return type.kind !== 'ref' && 'nullable' in type && type.nullable ? `${base} | null` : base;
}

function renderBase(type: TypeNode): string {
    switch (type.kind) {
        case 'primitive':
            return type.name === 'integer' ? 'number' : type.name;
        case 'array':
            return `${wrapIfUnion(formatTypeNode(type.items))}[]`;
        case 'object': {
            const hasProps = type.properties.length > 0;
            const ap = type.additionalProperties;
            if (!hasProps && !ap) return 'Record<string, unknown>';
            if (!hasProps && ap) return `Record<string, ${formatTypeNode(ap)}>`;
            const parts = type.properties.map(formatProperty);
            if (ap) parts.push(`[key: string]: ${formatTypeNode(ap)}`);
            return `{ ${parts.join('; ')} }`;
        }
        case 'ref':
            return type.name;
        case 'union':
            return type.variants.map(formatTypeNode).join(' | ');
        case 'intersection':
            return type.parts.map((p) => wrapIfUnion(formatTypeNode(p))).join(' & ');
        case 'enum':
            return type.values
                .map((v) => (type.base === 'string' ? `'${v}'` : String(v)))
                .join(' | ');
        case 'blob':
            return 'Blob';
        case 'unknown':
            return 'unknown';
        default:
            return 'unknown';
    }
}

function formatProperty(p: { name: string; type: TypeNode; required: boolean }): string {
    const name = isValidIdentifier(p.name) ? p.name : JSON.stringify(p.name);
    return `${name}${p.required ? '' : '?'}: ${formatTypeNode(p.type)}`;
}

function wrapIfUnion(rendered: string): string {
    return rendered.includes(' | ') ? `(${rendered})` : rendered;
}

export function formatOperationSignature(op: OperationBlueprint): string {
    const params: string[] = [];
    for (const p of op.pathParams) params.push(`${p.name}: ${formatTypeNode(p.type)}`);
    if (op.requestBody) params.push(`body: ${formatTypeNode(op.requestBody.type)}`);
    if (op.queryParams.length > 0) {
        const fields = op.queryParams
            .map((p) => `${p.name}${p.required ? '' : '?'}: ${formatTypeNode(p.type)}`)
            .join('; ');
        params.push(`query${op.queryParams.every((p) => !p.required) ? '?' : ''}: { ${fields} }`);
    }
    const ok = op.responses.find(
        (r) => typeof r.status === 'number' && r.status >= 200 && r.status < 300,
    );
    const returnType = ok?.type ? formatTypeNode(ok.type) : 'void';
    return `${op.name}(${params.join(', ')}): Promise<${returnType}>`;
}
