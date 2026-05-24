import { Command } from 'commander';
import { basename, resolve } from 'node:path';
import kleur from 'kleur';
import makeLogger from '../../utils/logger';
import { parseSpec } from '../../parser';
import { buildBlueprint } from '../../blueprint/build';
import { generateTypeScript } from '../../generators/typescript';
import {
    printGeneratedFiles,
    printResourceTree,
    printWarnings,
    summarizeBlueprint,
} from '../display';
import { exitCodeFor, validateInputPath, validateOutputPath } from '../helper';

interface GenerateOptions {
    input: string;
    output: string;
    force: boolean;
    verbose: boolean;
    quiet: boolean;
    packageName?: string;
    packageVersion: string;
    packageAuthor: string;
    packageLicense: string;
}

export function registerGenerateCommand(program: Command): void {
    program
        .command('generate')
        .description('Generate a TypeScript SDK from an OpenAPI spec')
        .requiredOption('-i, --input <path>', 'Path to OpenAPI spec (YAML or JSON)')
        .requiredOption('-o, --output <path>', 'Output directory for the generated SDK')
        .option('-f, --force', 'Overwrite a non-empty output directory', false)
        .option('-v, --verbose', 'Enable verbose logging', false)
        .option('-q, --quiet', 'Suppress progress logging (errors only)', false)
        .option(
            '--package-name <name>',
            'Generated package name (defaults to output directory name)',
        )
        .option('--package-version <version>', 'Generated package version', '0.1.0')
        .option('--package-author <author>', 'Generated package author', '')
        .option('--package-license <license>', 'Generated package license', 'UNLICENSED')
        .action(async (opts: GenerateOptions) => {
            try {
                await runGenerate(opts);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                console.error(kleur.red(`✖ ${message}`));
                process.exit(exitCodeFor(err));
            }
        });
}

async function runGenerate(opts: GenerateOptions): Promise<void> {
    const inputPath = resolve(opts.input);
    const outputPath = resolve(opts.output);
    const log = makeLogger(opts);

    validateInputPath(inputPath);
    validateOutputPath(outputPath, opts.force);
    log.info(`Input:  ${inputPath}`);
    log.info(`Output: ${outputPath}`);

    const doc = await parseSpec(inputPath);
    log.info(`Validated OpenAPI ${doc.openapi}`);

    const { blueprint, warnings } = buildBlueprint(doc);
    log.info(`Built blueprint: ${summarizeBlueprint(blueprint)}`);

    if (opts.verbose) printResourceTree(blueprint);
    if (warnings.length > 0) printWarnings(warnings, log.warn);

    const generated = await generateTypeScript({
        blueprint,
        outputDir: outputPath,
        package: {
            name: opts.packageName ?? basename(outputPath),
            version: opts.packageVersion,
            author: opts.packageAuthor,
            license: opts.packageLicense,
        },
    });
    log.info(`Wrote ${generated.length} TypeScript SDK file${generated.length === 1 ? '' : 's'}`);
    if (opts.verbose) printGeneratedFiles(generated);
}
