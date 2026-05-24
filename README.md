# sdkforge

A CLI that generates production-ready TypeScript SDKs from OpenAPI 3.x specs.

Give it a spec, get back a typed client, resource classes, and a fetch-based runtime — packaged as an installable npm module with zero runtime dependencies.

```bash
npx sdkforge generate --input openapi.yaml --output ./my-sdk
```

```ts
// Then in your app:
import { SDKClient } from './my-sdk/src';

const client = new SDKClient({ apiKey: process.env.API_KEY });

const pet = await client.pets.getPetById('123');
```

---

## What you get

A typed `client.<resource>.<method>()` surface that feels handwritten:

```ts
client.pets.listPets({ limit: 20 });
client.pets.createPet({ name: 'Mochi', tag: 'cat' });
client.pets.getPetById('p_abc');
client.pets.deletePetById('p_abc');
```

Every method has typed parameters, a typed return, doc comments from the OpenAPI `summary`, and an optional `CallOptions` parameter for `signal`, custom headers, etc.

```ts
const controller = new AbortController();
await client.pets.listPets({ limit: 10 }, { signal: controller.signal });
```

Errors are typed:

```ts
import { SDKError } from './my-sdk/src';

try {
    await client.pets.getPetById('missing');
} catch (err) {
    if (err instanceof SDKError) {
        console.error(`HTTP ${err.status}`, err.body);
    }
}
```

## Quick start

```bash
# Clone and install
git clone https://github.com/rohit1402/sdkforge.git
cd sdkforge
npm install

# Generate an SDK from the bundled Petstore example
npm run dev -- generate \
    --input ./examples/petstore.yaml \
    --output ./tmp/petstore-sdk \
    --force

# Verify the generated SDK compiles
cd ./tmp/petstore-sdk && npm install && npm run build
```

## CLI

```
sdkforge generate -i <input> -o <output> [flags]
```

| Flag                   | Description                                                |
| ---------------------- | ---------------------------------------------------------- |
| `-i, --input <path>`   | OpenAPI 3.x spec (YAML or JSON). **Required.**             |
| `-o, --output <path>`  | Output directory for the generated SDK. **Required.**      |
| `-f, --force`          | Overwrite a non-empty output directory.                    |
| `-v, --verbose`        | Print the parsed resource tree and per-file byte counts.   |
| `-q, --quiet`          | Suppress progress lines; print errors only.                |
| `--package-name`       | npm name in the generated `package.json`. Defaults to output dir name. |
| `--package-version`    | Version. Default `0.1.0`.                                  |
| `--package-author`     | Author string. Default empty.                              |
| `--package-license`    | License. Default `UNLICENSED`.                             |

Exit codes: `0` success, `1` invalid input/spec, `2` generation error, `3` IO error.

## Generated SDK layout

```
output/
├── src/
│   ├── index.ts       — re-exports
│   ├── client.ts      — SDKClient class with resource properties
│   ├── types.ts       — interface for each component schema
│   ├── runtime.ts     — fetch wrapper, SDKError, query serialization
│   └── resources/
│       └── pets.ts    — one class per resource
├── package.json       — ESM-only, Node ≥18, zero runtime deps
├── tsconfig.json      — strict, declaration: true, ES2022
└── README.md          — install + usage example
```

## How it works

A four-layer pipeline. Each layer has one job; layers communicate through typed boundaries.

```
OpenAPI spec
    │
    ▼  parser            — load YAML/JSON, validate against OpenAPI 3.x schema,
    │                      preserve $refs for downstream resolution
    │
    ▼  blueprint         — normalize into an internal Blueprint model:
    │                      resources, operations, parameters, named types
    │                      (decoupled from both OpenAPI and TypeScript)
    │
    ▼  TypeScript        — render Blueprint into TS source files via Handlebars
    │                      templates and discriminated-union type walkers
    │
    ▼  files on disk
```

The Blueprint is the project's load-bearing abstraction. Generators only see Blueprint types — they don't know about YAML or `$ref` resolution. Adding a Python or MCP target would mean writing a new generator against the same Blueprint.

## What's supported

| Feature                          | Behavior                          |
| -------------------------------- | --------------------------------- |
| Paths, methods, parameters       | Supported                         |
| Path / query / header params     | Supported                         |
| `application/json` bodies        | Supported                         |
| `application/octet-stream`       | Supported (`Blob` return type)    |
| `components.schemas` $refs       | Supported (preserved as type refs)|
| Bearer auth                      | Auto-injected `Authorization` header |
| `oneOf` / `anyOf`                | Warn + emit as TS union           |
| `allOf`                          | Emit as TS intersection           |
| `multipart/form-data` bodies     | Warn + skip operation             |
| XML / SSE / streaming responses  | Warn + skip operation             |
| OAuth flows / API-key auth       | Warn + generate client without auth |
| Webhooks / callbacks             | Warn + skip                       |
| Invalid OpenAPI / missing paths  | Hard error                        |

The full degradation matrix is enforced by the Blueprint layer — see `src/blueprint/`.

## Design choices

- **Zero runtime dependencies in generated SDKs.** Native `fetch` only. Output is forkable.
- **Runtime is copied, not imported.** Each generated SDK contains its own `runtime.ts`. No `@sdkforge/runtime` package to depend on.
- **Single `SDKError` class.** Status, statusText, parsed body, and raw `Response` exposed as fields. Per-status discriminated errors deferred to v2.
- **Schema names are preserved.** Anonymous inline schemas are inlined as object literals; named schemas (`components.schemas.Pet`) become exported interfaces.
- **Templates as TypeScript string constants.** Handlebars only as a final glue layer; complex rendering lives in `render/*.ts` modules.

## Development

```bash
npm install
npm run dev -- generate -i ./examples/petstore.yaml -o ./tmp/out -f -v
npm test          # 54 tests, ~1s
npm run typecheck
npm run format    # Prettier with semicolons, 4-space indent
```

Three example fixtures live in `examples/`:

- `petstore.yaml` - canonical sample. Tags, refs, bearer auth, enums, nullable fields.
- `users.yaml` - minimal spec without tags. Exercises path-segment fallback and operationId-less naming.
- `degraded.yaml` - exercises warn-and-degrade paths: `oneOf`, `allOf`, multipart body skip.

## Project structure

```
src/
├── parser/       — OpenAPI spec → validated document
├── blueprint/    — document → normalized Blueprint
│   ├── build.ts
│   ├── schema.ts
│   ├── naming.ts
│   └── format.ts
├── generators/typescript/
│   ├── render/   — Blueprint → rendered TS strings
│   ├── templates.ts
│   └── runtime-source.ts
├── commands/     — Commander.js wiring
└── utils/        — casing, singularization, logger
```

