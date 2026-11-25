import { effectNative, strict } from "@effect/tsgo/oxlint-presets";
import * as Record from "effect/Record";
import { defineConfig } from "oxlint";
import type { OxlintConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import landmines from "ultracite/oxlint/landmines";
import react from "ultracite/oxlint/react";
import vitest from "ultracite/oxlint/vitest";

type Rules = NonNullable<OxlintConfig["rules"]>;

const effectNativeAsErrors = defineConfig({
  ...effectNative,
  rules: Record.map(effectNative.rules ?? {}, () => "error" as const),
});

const effectGenerators = {
  "func-names": ["error", "always", { generators: "never" }],
  "typescript/consistent-return": "off",
} satisfies Rules;

const effectDualApisNamedLikeArrayMethods = {
  "unicorn/no-array-for-each": "off",
  "unicorn/no-array-method-this-argument": "off",
  "unicorn/require-array-join-separator": "off",
} satisfies Rules;

const effectDeclarations = {
  "max-classes-per-file": "off",
  "no-redeclare": "off",
  "typescript/no-invalid-void-type": "off",
  "unicorn/throw-new-error": "off",
} satisfies Rules;

const effectPromiseBoundaries = {
  "typescript/promise-function-async": "off",
} satisfies Rules;

export default defineConfig({
  env: core.env,
  extends: [core, vitest, landmines, antiSlop, strict, effectNativeAsErrors],
  ignorePatterns: core.ignorePatterns,
  jsPlugins: [...landmines.jsPlugins],
  options: {
    reportUnusedDisableDirectives: "error",
    typeAware: true,
    typeCheck: true,
  },
  overrides: [
    {
      files: ["packages/spectator/**"],
      plugins: react.plugins,
      rules: react.rules,
    },
  ],
  rules: {
    ...effectGenerators,
    ...effectDualApisNamedLikeArrayMethods,
    ...effectDeclarations,
    ...effectPromiseBoundaries,
  },
});
