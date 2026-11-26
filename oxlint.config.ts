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

const noInternals = {
  message:
    "Only the modules a package lists in its exports are public; internal/ is for the package itself.",
  regex: "^@agent-crossing/[^/]+/internal/",
};

const importsPointOneWay = (doors: readonly string[], message: string) =>
  ({
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          noInternals,
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
      files: ["packages/web/**"],
      plugins: react.plugins,
      rules: react.rules,
    },
    {
      files: ["packages/server/**", "packages/web/**"],
      rules: {
        "no-restricted-imports": ["error", { patterns: [noInternals] }],
      },
    },
    {
      files: ["packages/web/**"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              noInternals,
              {
                message:
                  "web reads only the stream's frames from the server package, @agent-crossing/server/StreamFrame.",
                group: [
                  "@agent-crossing/server",
                  "@agent-crossing/server/*",
                  "!@agent-crossing/server/StreamFrame",
                ],
              },
            ],
          },
        ],
      },
    },
    {
      files: ["packages/server/src/StreamFrame.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                message:
                  "StreamFrame is read by web, so it imports nothing from Alchemy, Rivet or Cloudflare.",
                regex: "alchemy|rivet|cloudflare",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["packages/server/src/world-object/**"],
      rules: importsPointOneWay(
        ["mcp", "stream"],
        "world-object reads only the world and views packages; mcp, stream and api.ts read world-object, never the other way."
      ),
    },
    {
      files: ["packages/server/src/mcp/**"],
      rules: importsPointOneWay(
        ["stream"],
        "mcp reads world-object only; stream is a separate door, and api.ts reads mcp, never the other way."
      ),
    },
    {
      files: ["packages/server/src/stream/**"],
      rules: importsPointOneWay(
        ["mcp"],
        "stream reads world-object only; mcp is a separate door, and api.ts reads stream, never the other way."
      ),
    },
    {
      files: [
        "packages/definitions/src/*.ts",
        "packages/server/src/StreamFrame.ts",
        "packages/views/src/*.ts",
        "packages/world/src/*.ts",
      ],
      rules: { "unicorn/filename-case": ["error", { case: "pascalCase" }] },
    },
    {
      files: ["packages/definitions/**"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                message:
                  "The definitions package reads no other package; world, server and web read definitions, never the other way.",
                regex: "^@agent-crossing/",
              },
            ],
          },
        ],
      },
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
                  "The world package reads only definitions; views, server and web read world, never the other way.",
                regex: "^@agent-crossing/(server|views|web)(/|$)",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["packages/views/**"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              noInternals,
              {
                message:
                  "The views package reads only world and definitions; server and web read views, never the other way.",
                regex: "^@agent-crossing/(server|web)(/|$)",
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
