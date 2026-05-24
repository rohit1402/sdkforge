export interface SdkBlueprint {
    meta: SdkMetadata;
    resources: ResourceBlueprint[];
    namedTypes: Record<string, TypeNode>;
}

export interface SdkMetadata {
    title: string;
    version: string;
    description?: string;
    baseUrl?: string;
    hasBearerAuth: boolean;
}

export interface ResourceBlueprint {
    name: string;
    operations: OperationBlueprint[];
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface OperationBlueprint {
    name: string;
    method: HttpMethod;
    path: string;
    summary?: string;
    description?: string;
    pathParams: ParameterBlueprint[];
    queryParams: ParameterBlueprint[];
    headerParams: ParameterBlueprint[];
    requestBody?: RequestBodyBlueprint;
    responses: ResponseBlueprint[];
}

export interface ParameterBlueprint {
    name: string;
    rawName: string;
    type: TypeNode;
    required: boolean;
    description?: string;
}

export interface RequestBodyBlueprint {
    contentType: 'application/json' | 'application/octet-stream';
    type: TypeNode;
    required: boolean;
}

export interface ResponseBlueprint {
    status: number | 'default';
    contentType?: 'application/json' | 'application/octet-stream';
    type?: TypeNode;
    description?: string;
}

export type TypeNode =
    | PrimitiveNode
    | ArrayNode
    | ObjectNode
    | RefNode
    | UnionNode
    | IntersectionNode
    | EnumNode
    | BlobNode
    | UnknownNode;

export interface PrimitiveNode {
    kind: 'primitive';
    name: 'string' | 'number' | 'integer' | 'boolean';
    nullable: boolean;
}

export interface ArrayNode {
    kind: 'array';
    items: TypeNode;
    nullable: boolean;
}

export interface ObjectNode {
    kind: 'object';
    properties: PropertyNode[];
    additionalProperties?: TypeNode;
    nullable: boolean;
}

export interface PropertyNode {
    name: string;
    type: TypeNode;
    required: boolean;
    description?: string;
}

export interface RefNode {
    kind: 'ref';
    name: string;
}

export interface UnionNode {
    kind: 'union';
    variants: TypeNode[];
    nullable: boolean;
}

export interface IntersectionNode {
    kind: 'intersection';
    parts: TypeNode[];
    nullable: boolean;
}

export interface EnumNode {
    kind: 'enum';
    base: 'string' | 'number';
    values: Array<string | number>;
    nullable: boolean;
}

export interface BlobNode {
    kind: 'blob';
    nullable: boolean;
}

export interface UnknownNode {
    kind: 'unknown';
    nullable: boolean;
}

export interface Warning {
    code: WarningCode;
    message: string;
    location?: string;
}

export type WarningCode =
    | 'unsupported-feature'
    | 'lossy-degradation'
    | 'skipped-operation'
    | 'name-collision'
    | 'fallback-naming';
