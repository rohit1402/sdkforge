import Handlebars from 'handlebars';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SdkBlueprint } from '../../blueprint/types';
import {
    renderClient,
    renderPackageMeta,
    renderResource,
    renderTypes,
    type PackageOptions,
} from './render';
import {
    CLIENT_TEMPLATE,
    INDEX_TEMPLATE,
    PACKAGE_JSON_TEMPLATE,
    README_TEMPLATE,
    RESOURCE_TEMPLATE,
    TSCONFIG_TEMPLATE,
    TYPES_TEMPLATE,
} from './templates';
import { RUNTIME_SOURCE } from './runtime-source';

export interface GenerateTypeScriptOptions {
    blueprint: SdkBlueprint;
    outputDir: string;
    package: PackageOptions;
}

export interface GeneratedFile {
    path: string;
    bytes: number;
}

const compile = (template: string) => Handlebars.compile(template, { noEscape: true });

export async function generateTypeScript(
    opts: GenerateTypeScriptOptions,
): Promise<GeneratedFile[]> {
    const written: GeneratedFile[] = [];
    const srcDir = join(opts.outputDir, 'src');
    const resourcesDir = join(srcDir, 'resources');
    await mkdir(resourcesDir, { recursive: true });

    written.push(
        await writeOut(
            join(srcDir, 'types.ts'),
            compile(TYPES_TEMPLATE)(renderTypes(opts.blueprint)),
        ),
    );

    for (const resource of opts.blueprint.resources) {
        const data = renderResource(resource, opts.blueprint);
        const content = compile(RESOURCE_TEMPLATE)(data);
        written.push(await writeOut(join(resourcesDir, `${resource.name}.ts`), content));
    }

    written.push(
        await writeOut(
            join(srcDir, 'client.ts'),
            compile(CLIENT_TEMPLATE)(renderClient(opts.blueprint)),
        ),
    );
    written.push(await writeOut(join(srcDir, 'index.ts'), compile(INDEX_TEMPLATE)({})));
    written.push(await writeOut(join(srcDir, 'runtime.ts'), RUNTIME_SOURCE));

    const packageMeta = renderPackageMeta(opts.blueprint, opts.package);
    written.push(
        await writeOut(
            join(opts.outputDir, 'package.json'),
            compile(PACKAGE_JSON_TEMPLATE)(packageMeta),
        ),
    );
    written.push(
        await writeOut(join(opts.outputDir, 'tsconfig.json'), compile(TSCONFIG_TEMPLATE)({})),
    );
    written.push(
        await writeOut(join(opts.outputDir, 'README.md'), compile(README_TEMPLATE)(packageMeta)),
    );

    return written;
}

async function writeOut(path: string, content: string): Promise<GeneratedFile> {
    await writeFile(path, content, 'utf8');
    return { path, bytes: Buffer.byteLength(content, 'utf8') };
}
