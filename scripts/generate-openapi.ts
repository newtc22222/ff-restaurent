import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ts from 'typescript';
import openapiTS, { astToString } from 'openapi-typescript';
import prettier from 'prettier';

const root = resolve(import.meta.dirname, '..');
const openApiPath = resolve(root, 'apps/api/openapi.json');
const generatedTypesPath = resolve(
  root,
  'apps/web/src/api/generated/api-types.ts',
);

const sharedTypes = {
  ChefRole: 'ChefRoleValue',
  SystemRole: 'SystemRoleValue',
  EntryStatus: 'EntryStatusValue',
  PaymentStatus: 'PaymentStatusValue',
  AdjustmentType: 'AdjustmentTypeValue',
  AdjustmentAllocation: 'AdjustmentAllocationValue',
  RestaurantPlatform: 'RestaurantPlatformValue',
  CollectionSystemType: 'CollectionSystemTypeValue',
} as const;

const sortObject = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortObject(entry)]),
  );
};

const composeExtendedSharedEnums = (
  value: unknown,
  componentEnums: Array<{
    sharedType: string;
    values: string[];
  }>,
  mappings: Array<{
    sharedType: string;
    values: string[];
    extras: string[];
  }>,
) => {
  if (Array.isArray(value)) {
    for (const entry of value) {
      composeExtendedSharedEnums(entry, componentEnums, mappings);
    }
    return;
  }
  if (!value || typeof value !== 'object') return;

  const schema = value as Record<string, unknown>;
  if (
    Array.isArray(schema.enum) &&
    schema.enum.every((item) => typeof item === 'string')
  ) {
    const values = schema.enum as string[];
    for (const component of componentEnums) {
      const extras = values.filter((item) => !component.values.includes(item));
      if (
        extras.length > 0 &&
        component.values.every((item) => values.includes(item))
      ) {
        schema['x-shared-type'] = component.sharedType;
        schema['x-shared-literals'] = extras;
        if (
          !mappings.some(
            (mapping) =>
              mapping.sharedType === component.sharedType &&
              mapping.extras.join() === extras.join(),
          )
        ) {
          mappings.push({
            sharedType: component.sharedType,
            values,
            extras,
          });
        }
        break;
      }
    }
  }
  for (const entry of Object.values(schema)) {
    composeExtendedSharedEnums(entry, componentEnums, mappings);
  }
};

const buildArtifacts = async () => {
  process.env.DATABASE_URL ??=
    'postgresql://openapi:openapi@localhost:5432/openapi?schema=public';
  const { buildApp } = await import('../apps/api/src/app.js');
  const app = await buildApp();
  await app.ready();

  const document = app.swagger() as {
    components?: {
      schemas?: Record<string, Record<string, unknown>>;
    };
  };
  for (const [component, sharedType] of Object.entries(sharedTypes)) {
    const schema = document.components?.schemas?.[component];
    if (!schema) throw new Error(`Missing OpenAPI component: ${component}`);
    schema['x-shared-type'] = sharedType;
  }
  const extendedEnumMappings: Array<{
    sharedType: string;
    values: string[];
    extras: string[];
  }> = [];
  composeExtendedSharedEnums(
    document,
    Object.entries(sharedTypes).map(([component, sharedType]) => {
      const schema = document.components?.schemas?.[component];
      const values = schema?.enum;
      if (
        !Array.isArray(values) ||
        !values.every((item) => typeof item === 'string')
      ) {
        throw new Error(`Shared enum component is invalid: ${component}`);
      }
      return { sharedType, values: values as string[] };
    }),
    extendedEnumMappings,
  );

  const stableDocument = sortObject(document);
  const prettierConfig =
    (await prettier.resolveConfig(generatedTypesPath)) ?? {};
  const openApi = await prettier.format(JSON.stringify(stableDocument), {
    ...prettierConfig,
    parser: 'json',
    filepath: openApiPath,
  });
  const ast = await openapiTS(stableDocument as never, {
    alphabetize: true,
    inject: `import type {
  AdjustmentAllocationValue,
  AdjustmentTypeValue,
  ChefRoleValue,
  CollectionSystemTypeValue,
  EntryStatusValue,
  PaymentStatusValue,
  RestaurantPlatformValue,
  SystemRoleValue,
} from '@ff-restaurent/shared';`,
    transform(schemaObject) {
      const sharedType = schemaObject['x-shared-type'];
      if (typeof sharedType !== 'string') return undefined;
      const sharedReference = ts.factory.createTypeReferenceNode(sharedType);
      const literals = schemaObject['x-shared-literals'];
      if (!Array.isArray(literals)) return sharedReference;
      return ts.factory.createUnionTypeNode([
        sharedReference,
        ...literals.map((literal) =>
          ts.factory.createLiteralTypeNode(
            ts.factory.createStringLiteral(literal),
          ),
        ),
      ]);
    },
  });
  let generatedSource = astToString(ast);
  for (const mapping of extendedEnumMappings) {
    const emittedUnion = mapping.values
      .map((value) => JSON.stringify(value))
      .join(' | ');
    const composedUnion = [
      mapping.sharedType,
      ...mapping.extras.map((value) => JSON.stringify(value)),
    ].join(' | ');
    generatedSource = generatedSource.replaceAll(emittedUnion, composedUnion);
  }
  const generatedTypes = await prettier.format(generatedSource, {
    ...prettierConfig,
    parser: 'typescript',
    filepath: generatedTypesPath,
  });
  await app.close();

  return { openApi, generatedTypes };
};

const assertCurrent = async (path: string, expected: string) => {
  const current = await readFile(path, 'utf8').catch(() => '');
  if (current !== expected) {
    throw new Error(
      `${path.replace(`${root}\\`, '')} is stale; run npm run openapi:generate`,
    );
  }
};

const main = async () => {
  const artifacts = await buildArtifacts();
  if (process.argv.includes('--check')) {
    await assertCurrent(openApiPath, artifacts.openApi);
    await assertCurrent(generatedTypesPath, artifacts.generatedTypes);
    return;
  }
  await writeFile(openApiPath, artifacts.openApi);
  await writeFile(generatedTypesPath, artifacts.generatedTypes);
};

await main();
