import { formatTypeNode } from '../../../blueprint/format';
import type {
    OperationBlueprint,
    ParameterBlueprint,
    ResourceBlueprint,
    SdkBlueprint,
    TypeNode,
} from '../../../blueprint/types';
import { resourceClassName } from './helpers';

export interface RenderedResource {
    fileName: string;
    className: string;
    name: string;
    importedTypes: string[];
    methods: Array<{ name: string; body: string }>;
}

export function renderResource(
    resource: ResourceBlueprint,
    blueprint: SdkBlueprint,
): RenderedResource {
    return {
        fileName: resource.name,
        className: resourceClassName(resource.name),
        name: resource.name,
        importedTypes: collectReferencedTypeNames(resource, blueprint).sort(),
        methods: resource.operations.map((op) => ({
            name: op.name,
            body: renderOperationBody(op),
        })),
    };
}

function renderOperationBody(op: OperationBlueprint): string {
    const params = renderMethodParams(op);
    const returnType = renderReturnType(op);
    const pathExpr = renderPathExpression(op.path, op.pathParams);
    const requestArgs = renderRequestArgs(op);
    const docComment = op.summary ? `    /** ${op.summary} */\n` : '';
    const signature = params ? `${params}, options?: CallOptions` : 'options?: CallOptions';

    return `${docComment}    ${op.name}(${signature}): Promise<${returnType}> {
        return request<${returnType}>(this.client.config, '${op.method}', ${pathExpr}${requestArgs});
    }`;
}

function renderMethodParams(op: OperationBlueprint): string {
    const params: string[] = [];
    for (const p of op.pathParams) params.push(`${p.name}: ${formatTypeNode(p.type)}`);
    if (op.requestBody) params.push(`body: ${formatTypeNode(op.requestBody.type)}`);
    if (op.queryParams.length > 0) params.push(renderQueryParam(op));
    return params.join(', ');
}

function renderQueryParam(op: OperationBlueprint): string {
    const fields = op.queryParams
        .map((p) => `${p.name}${p.required ? '' : '?'}: ${formatTypeNode(p.type)}`)
        .join('; ');
    const optional = op.queryParams.every((p) => !p.required);
    return `query${optional ? '?' : ''}: { ${fields} }`;
}

function renderReturnType(op: OperationBlueprint): string {
    const okResp = op.responses.find(
        (r) => typeof r.status === 'number' && r.status >= 200 && r.status < 300,
    );
    return okResp?.type ? formatTypeNode(okResp.type) : 'void';
}

function renderRequestArgs(op: OperationBlueprint): string {
    const opts: string[] = ['...options'];
    if (op.queryParams.length > 0) opts.push('query');
    if (op.requestBody) opts.push('body');
    return `, { ${opts.join(', ')} }`;
}

function renderPathExpression(path: string, pathParams: ParameterBlueprint[]): string {
    let result = path;
    for (const p of pathParams) {
        result = result.replace(`{${p.rawName}}`, '${' + p.name + '}');
    }
    return '`' + result + '`';
}

function collectReferencedTypeNames(
    resource: ResourceBlueprint,
    blueprint: SdkBlueprint,
): string[] {
    const refs = new Set<string>();
    for (const op of resource.operations) {
        for (const p of [...op.pathParams, ...op.queryParams, ...op.headerParams]) {
            collectRefs(p.type, refs);
        }
        if (op.requestBody) collectRefs(op.requestBody.type, refs);
        for (const r of op.responses) if (r.type) collectRefs(r.type, refs);
    }
    return Array.from(refs).filter((name) => name in blueprint.namedTypes);
}

function collectRefs(type: TypeNode | undefined, refs: Set<string>): void {
    if (!type) return;
    switch (type.kind) {
        case 'ref':
            refs.add(type.name);
            break;
        case 'array':
            collectRefs(type.items, refs);
            break;
        case 'object':
            for (const p of type.properties) collectRefs(p.type, refs);
            break;
        case 'union':
            for (const v of type.variants) collectRefs(v, refs);
            break;
        case 'intersection':
            for (const p of type.parts) collectRefs(p, refs);
            break;
    }
}
