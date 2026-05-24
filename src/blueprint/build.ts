import type { OpenAPIV3 } from 'openapi-types';
import { camelCase, isValidIdentifier } from '../utils/casing';
import { type BlueprintContext, createContext } from './context';
import { dedupeNames, resolveOperationName, resolveResourceName } from './naming';
import { toTypeNode } from './schema';
import type {
    HttpMethod,
    OperationBlueprint,
    ParameterBlueprint,
    RequestBodyBlueprint,
    ResourceBlueprint,
    ResponseBlueprint,
    SdkBlueprint,
    SdkMetadata,
    TypeNode,
    Warning,
} from './types';

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export interface BlueprintResult {
    blueprint: SdkBlueprint;
    warnings: Warning[];
}

export function buildBlueprint(doc: OpenAPIV3.Document): BlueprintResult {
    const ctx = createContext();
    const meta = buildMeta(doc);
    const namedTypes = buildNamedTypes(doc, ctx);
    const resources = buildResources(doc, ctx);
    return { blueprint: { meta, resources, namedTypes }, warnings: ctx.warnings };
}

function buildMeta(doc: OpenAPIV3.Document): SdkMetadata {
    const bearerScheme = Object.values(doc.components?.securitySchemes ?? {}).some(
        (scheme) =>
            scheme && 'type' in scheme && scheme.type === 'http' && scheme.scheme === 'bearer',
    );
    return {
        title: doc.info.title,
        version: doc.info.version,
        description: doc.info.description,
        baseUrl: doc.servers?.[0]?.url,
        hasBearerAuth: bearerScheme,
    };
}

function buildNamedTypes(doc: OpenAPIV3.Document, ctx: BlueprintContext): Record<string, TypeNode> {
    const out: Record<string, TypeNode> = {};
    for (const [name, schema] of Object.entries(doc.components?.schemas ?? {})) {
        out[name] = toTypeNode(schema, ctx, `components.schemas.${name}`, 0);
    }
    return out;
}

function buildResources(doc: OpenAPIV3.Document, ctx: BlueprintContext): ResourceBlueprint[] {
    const groups = new Map<string, OperationBlueprint[]>();
    const requestBodies = doc.components?.requestBodies;

    for (const [path, pathItem] of Object.entries(doc.paths ?? {})) {
        if (!pathItem) continue;
        for (const method of HTTP_METHODS) {
            const op = getOperation(pathItem, method);
            if (!op) continue;

            const blueprintOp = buildOperation(method, path, op, ctx, requestBodies);
            if (!blueprintOp) continue;

            const groupName = resolveResourceName(op, path);
            const bucket = groups.get(groupName) ?? [];
            bucket.push(blueprintOp);
            groups.set(groupName, bucket);
        }
    }

    return Array.from(groups, ([name, operations]) => ({
        name,
        operations: dedupeNames(operations, name, ctx),
    }));
}

function getOperation(
    pathItem: OpenAPIV3.PathItemObject,
    method: HttpMethod,
): OpenAPIV3.OperationObject | undefined {
    switch (method) {
        case 'GET':
            return pathItem.get;
        case 'POST':
            return pathItem.post;
        case 'PUT':
            return pathItem.put;
        case 'PATCH':
            return pathItem.patch;
        case 'DELETE':
            return pathItem.delete;
    }
}

function buildOperation(
    method: HttpMethod,
    path: string,
    op: OpenAPIV3.OperationObject,
    ctx: BlueprintContext,
    requestBodies: RequestBodiesMap | undefined,
): OperationBlueprint | undefined {
    const location = `${method} ${path}`;

    const bodyResolution = buildRequestBody(op.requestBody, requestBodies, ctx, location);
    if (bodyResolution.kind === 'skip') {
        ctx.warn('skipped-operation', bodyResolution.reason, location);
        return undefined;
    }

    const name = resolveOperationName(method, path, op, ctx, location);

    const parameters = (op.parameters ?? []).filter(isParameterObject);
    const pathParams = parameters
        .filter((p) => p.in === 'path')
        .map((p) => toParameter(p, ctx, location));
    const queryParams = parameters
        .filter((p) => p.in === 'query')
        .map((p) => toParameter(p, ctx, location));
    const headerParams = parameters
        .filter((p) => p.in === 'header')
        .map((p) => toParameter(p, ctx, location));

    const responses = buildResponses(op.responses, ctx, location);

    return {
        name,
        method,
        path,
        summary: op.summary,
        description: op.description,
        pathParams,
        queryParams,
        headerParams,
        requestBody: bodyResolution.kind === 'ok' ? bodyResolution.body : undefined,
        responses,
    };
}

function isParameterObject(
    p: OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject,
): p is OpenAPIV3.ParameterObject {
    return !('$ref' in p);
}

function toParameter(
    p: OpenAPIV3.ParameterObject,
    ctx: BlueprintContext,
    location: string,
): ParameterBlueprint {
    const camel = camelCase(p.name);
    return {
        name: isValidIdentifier(camel) ? camel : `_${camel}`,
        rawName: p.name,
        type: toTypeNode(p.schema, ctx, `${location} param ${p.name}`, 0),
        required: p.required ?? false,
        description: p.description,
    };
}

type BodyResolution =
    | { kind: 'ok'; body: RequestBodyBlueprint }
    | { kind: 'none' }
    | { kind: 'skip'; reason: string };

type RequestBodiesMap = Record<string, OpenAPIV3.RequestBodyObject | OpenAPIV3.ReferenceObject>;

function buildRequestBody(
    body: OpenAPIV3.RequestBodyObject | OpenAPIV3.ReferenceObject | undefined,
    requestBodies: RequestBodiesMap | undefined,
    ctx: BlueprintContext,
    location: string,
): BodyResolution {
    if (!body) return { kind: 'none' };

    let concrete: OpenAPIV3.RequestBodyObject;
    if ('$ref' in body) {
        const resolved = resolveRequestBodyRef(body.$ref, requestBodies);
        if (resolved.kind === 'error') {
            return { kind: 'skip', reason: resolved.reason };
        }
        concrete = resolved.body;
    } else {
        concrete = body;
    }

    const json = concrete.content?.['application/json'];
    if (json) {
        return {
            kind: 'ok',
            body: {
                contentType: 'application/json',
                type: toTypeNode(json.schema, ctx, `${location} requestBody`, 0),
                required: concrete.required ?? false,
            },
        };
    }

    const binary = concrete.content?.['application/octet-stream'];
    if (binary) {
        return {
            kind: 'ok',
            body: {
                contentType: 'application/octet-stream',
                type: { kind: 'blob', nullable: false },
                required: concrete.required ?? false,
            },
        };
    }

    const types = Object.keys(concrete.content ?? {});
    if (types.length === 0) return { kind: 'none' };
    return {
        kind: 'skip',
        reason: `unsupported request body content types: ${types.join(', ')}`,
    };
}

function resolveRequestBodyRef(
    ref: string,
    map: RequestBodiesMap | undefined,
): { kind: 'ok'; body: OpenAPIV3.RequestBodyObject } | { kind: 'error'; reason: string } {
    const match = ref.match(/^#\/components\/requestBodies\/([^/]+)$/);
    if (!match) {
        return {
            kind: 'error',
            reason: `request body $ref must point to #/components/requestBodies/...: ${ref}`,
        };
    }
    const name = match[1]!;
    const target = map?.[name];
    if (!target) {
        return { kind: 'error', reason: `request body $ref not found: ${ref}` };
    }
    if ('$ref' in target) {
        return {
            kind: 'error',
            reason: `chained request body $refs not supported: ${ref} -> ${target.$ref}`,
        };
    }
    return { kind: 'ok', body: target };
}

function buildResponses(
    responses: OpenAPIV3.ResponsesObject | undefined,
    ctx: BlueprintContext,
    location: string,
): ResponseBlueprint[] {
    if (!responses) return [];
    const out: ResponseBlueprint[] = [];

    for (const [status, response] of Object.entries(responses)) {
        if (!response || '$ref' in response) continue;
        const statusKey: number | 'default' = status === 'default' ? 'default' : Number(status);

        const jsonContent = response.content?.['application/json'];
        const binaryContent = response.content?.['application/octet-stream'];

        if (jsonContent) {
            out.push({
                status: statusKey,
                contentType: 'application/json',
                type: toTypeNode(jsonContent.schema, ctx, `${location} response ${status}`, 0),
                description: response.description,
            });
        } else if (binaryContent) {
            out.push({
                status: statusKey,
                contentType: 'application/octet-stream',
                type: { kind: 'blob', nullable: false },
                description: response.description,
            });
        } else {
            out.push({ status: statusKey, description: response.description });
        }
    }

    return out;
}
