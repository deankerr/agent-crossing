import { effectNative, strict } from "@effect/tsgo/oxlint-presets";
import * as Arr from "effect/Array";
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

const importsPointOneWay = (doors: readonly string[], message: string) =>
  ({
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            message,
            regex: `^(\\.\\./)+(${Arr.join(doors, "|")})/|^(\\.\\./)+api(\\.ts)?$`,
          },
        ],
      },
    ],
  }) satisfies Rules;

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
    {
      files: ["packages/host/src/world-object/**"],
      rules: importsPointOneWay(
        ["admin", "spectate"],
        "world-object reads only the world package; admin, spectate and api.ts read world-object, never the other way."
      ),
    },
    {
      files: ["packages/host/src/admin/**"],
      rules: importsPointOneWay(
        ["spectate"],
        "admin reads world-object only; spectate is a separate door, and api.ts reads admin, never the other way."
      ),
    },
    {
      files: ["packages/host/src/spectate/**"],
      rules: importsPointOneWay(
        ["admin"],
        "spectate reads world-object only; admin is a separate door, and api.ts reads spectate, never the other way."
      ),
    },
    {
      files: ["packages/world/**"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                message:
                  "The world package reads no other package; host and spectator read world, never the other way.",
                regex: "^@agent-crossing/(host|spectator)(/|$)",
              },
            ],
          },
        ],
      },
    },
  ],
  rules: {
    ...effectGenerators,
    ...effectDualApisNamedLikeArrayMethods,
    ...effectDeclarations,
    ...effectPromiseBoundaries,
  },
});
