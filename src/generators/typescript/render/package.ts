import type { OperationBlueprint, SdkBlueprint } from '../../../blueprint/types';

export interface PackageOptions {
    name: string;
    version: string;
    author: string;
    license: string;
}

export interface RenderedPackageMeta {
    name: string;
    version: string;
    description: string;
    author: string;
    license: string;
    baseUrl: string;
    exampleResource: string;
    exampleMethod: string;
    exampleArgs: string;
    exampleArgsComma: string;
    exampleCall: string;
}

export function renderPackageMeta(
    blueprint: SdkBlueprint,
    pkg: PackageOptions,
): RenderedPackageMeta {
    const firstResource = blueprint.resources[0];
    const firstOp = firstResource?.operations[0];

    let exampleResource = '';
    let exampleMethod = '';
    let exampleArgs = '';
    let exampleArgsComma = '';
    let exampleCall = '';

    if (firstResource && firstOp) {
        exampleResource = firstResource.name;
        exampleMethod = firstOp.name;
        exampleArgs = renderExampleArgs(firstOp);
        exampleArgsComma = exampleArgs ? ', ' : '';
        exampleCall = `const result = await client.${exampleResource}.${exampleMethod}(${exampleArgs});`;
    }

    return {
        name: pkg.name,
        version: pkg.version,
        description: blueprint.meta.description ?? `TypeScript SDK for ${blueprint.meta.title}`,
        author: pkg.author,
        license: pkg.license,
        baseUrl: blueprint.meta.baseUrl ?? '',
        exampleResource,
        exampleMethod,
        exampleArgs,
        exampleArgsComma,
        exampleCall,
    };
}

function renderExampleArgs(op: OperationBlueprint): string {
    const args: string[] = [];
    for (const p of op.pathParams) args.push(`'<${p.name}>'`);
    if (op.requestBody) args.push('{ /* see types */ }');
    return args.join(', ');
}
