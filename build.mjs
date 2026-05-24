import { build } from 'esbuild';
import { chmod } from 'node:fs/promises';

await build({
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index.js',
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    banner: { js: '#!/usr/bin/env node' },
    packages: 'external',
    sourcemap: true,
    logLevel: 'info',
});

await chmod('dist/index.js', 0o755);
