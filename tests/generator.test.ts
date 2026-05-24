import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildBlueprint } from '../src/blueprint/build';
import { generateTypeScript } from '../src/generators/typescript';
import { parseSpec } from '../src/parser';

const EXAMPLES = resolve(__dirname, '..', 'examples');

async function runPipeline(specFile: string) {
    const outputDir = await mkdtemp(join(tmpdir(), 'sdkforge-test-'));
    const doc = await parseSpec(resolve(EXAMPLES, specFile));
    const { blueprint } = buildBlueprint(doc);
    await generateTypeScript({
        blueprint,
        outputDir,
        package: { name: 'test-sdk', version: '0.0.0', author: '', license: 'UNLICENSED' },
    });
    return outputDir;
}

describe('generateTypeScript — petstore', () => {
    let outputDir: string;

    beforeAll(async () => {
        outputDir = await runPipeline('petstore.yaml');
    });

    afterAll(async () => {
        await rm(outputDir, { recursive: true, force: true });
    });

    it('emits types.ts with each named schema as an interface', async () => {
        const content = await readFile(join(outputDir, 'src', 'types.ts'), 'utf8');
        expect(content).toContain('export interface Pet {');
        expect(content).toContain('export interface NewPet {');
        expect(content).toContain('export interface Order {');
        expect(content).toContain('id: string;');
        expect(content).toContain('tag?: string | null;');
    });

    it('renders pure-dictionary additionalProperties as Record<string, T>', async () => {
        const content = await readFile(join(outputDir, 'src', 'types.ts'), 'utf8');
        expect(content).toContain('export type Metadata = Record<string, string>;');
    });

    it('emits a resource file per resource with method signatures', async () => {
        const content = await readFile(join(outputDir, 'src', 'resources', 'pets.ts'), 'utf8');
        expect(content).toContain('export class PetsResource {');
        expect(content).toContain('listPets(');
        expect(content).toContain('getPetById(petId: string,');
        expect(content).toContain('options?: CallOptions');
        expect(content).toContain("import { request, type CallOptions } from '../runtime';");
    });

    it('does not emit a leading comma for methods with no params', async () => {
        const content = await readFile(join(outputDir, 'src', 'resources', 'pets.ts'), 'utf8');
        // listPets has only an optional query — first param is `query?: ...`
        // No method in petstore has zero params, but the signature must never start with `,`
        expect(content).not.toMatch(/\(\s*,\s*options/);
    });

    it('emits client.ts with resource properties and baseURL', async () => {
        const content = await readFile(join(outputDir, 'src', 'client.ts'), 'utf8');
        expect(content).toContain('export class SDKClient {');
        expect(content).toContain('readonly pets: PetsResource;');
        expect(content).toContain('readonly store: StoreResource;');
        expect(content).toContain("baseURL: 'https://petstore.example.com/v1'");
    });

    it('emits runtime.ts verbatim from the runtime source', async () => {
        const content = await readFile(join(outputDir, 'src', 'runtime.ts'), 'utf8');
        expect(content).toContain('export class SDKError extends Error');
        expect(content).toContain('export async function request<T>');
        expect(content).toContain('export type CallOptions = Omit<RequestOptions');
    });

    it('emits a package.json with the supplied metadata', async () => {
        const content = await readFile(join(outputDir, 'package.json'), 'utf8');
        const pkg = JSON.parse(content);
        expect(pkg.name).toBe('test-sdk');
        expect(pkg.version).toBe('0.0.0');
        expect(pkg.type).toBe('module');
        expect(pkg.engines.node).toBe('>=18');
    });

    it('emits a README.md with usage and error-handling sections', async () => {
        const content = await readFile(join(outputDir, 'README.md'), 'utf8');
        expect(content).toContain('# test-sdk');
        expect(content).toContain('## Usage');
        expect(content).toContain('## Error handling');
        expect(content).toContain('## Cancellation');
        expect(content).toContain('await client.pets.listPets');
    });
});
