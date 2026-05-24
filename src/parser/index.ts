import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPIV3 } from 'openapi-types';

export class ParseError extends Error {
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = 'ParseError';
    }
}

export async function parseSpec(path: string): Promise<OpenAPIV3.Document> {
    await runSchemaValidation(path);
    const doc = await loadPreservingRefs(path);
    assertOpenAPIv3(doc);
    return doc;
}

async function runSchemaValidation(path: string): Promise<void> {
    try {
        await SwaggerParser.validate(path);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new ParseError(`Invalid OpenAPI specification\n${message}`, { cause: err });
    }
}

async function loadPreservingRefs(path: string): Promise<unknown> {
    try {
        return await SwaggerParser.parse(path);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new ParseError(`Could not parse spec at ${path}\n${message}`, { cause: err });
    }
}

function assertOpenAPIv3(doc: unknown): asserts doc is OpenAPIV3.Document {
    if (!doc || typeof doc !== 'object') {
        throw new ParseError('Parsed spec is not an object');
    }
    const version = (doc as { openapi?: unknown }).openapi;
    if (typeof version !== 'string' || !version.startsWith('3.')) {
        throw new ParseError(
            `Unsupported OpenAPI version: ${version ?? '(missing)'}\nOnly OpenAPI 3.x is supported.`,
        );
    }
    if (!(doc as { paths?: unknown }).paths) {
        throw new ParseError('Invalid OpenAPI specification\nMissing "paths" field');
    }
}
