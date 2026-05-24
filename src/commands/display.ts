import kleur from 'kleur';
import { formatOperationSignature, formatTypeNode } from '../blueprint/format';
import type { SdkBlueprint, Warning } from '../blueprint/types';
import type { GeneratedFile } from '../generators/typescript';

export function summarizeBlueprint(blueprint: SdkBlueprint): string {
    const operationCount = blueprint.resources.reduce((sum, r) => sum + r.operations.length, 0);
    return `No. of resources: ${blueprint.resources.length}, No. of operations: ${operationCount}`;
}

export function printResourceTree(blueprint: SdkBlueprint): void {
    const namedCount = Object.keys(blueprint.namedTypes).length;
    if (namedCount > 0) {
        console.log(kleur.cyan(`  types (${namedCount}):`));
        for (const [name, type] of Object.entries(blueprint.namedTypes)) {
            console.log(`    ${kleur.dim('type')} ${name} = ${formatTypeNode(type)}`);
        }
    }
    for (const resource of blueprint.resources) {
        console.log(kleur.cyan(`  ${resource.name}/`));
        for (const op of resource.operations) {
            console.log(`    ${kleur.dim(op.method.padEnd(6))} ${formatOperationSignature(op)}`);
        }
    }
}

export function printWarnings(warnings: Warning[], warn: (m: string) => void): void {
    for (const w of warnings) {
        const loc = w.location ? kleur.dim(` (${w.location})`) : '';
        warn(`[${w.code}] ${w.message}${loc}`);
    }
}

export function printGeneratedFiles(files: GeneratedFile[]): void {
    for (const f of files) console.log(kleur.dim(`    ${f.path} (${f.bytes} bytes)`));
}
