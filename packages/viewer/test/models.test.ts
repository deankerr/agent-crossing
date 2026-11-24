import { kindDefaults, kindNames } from "@agent-crossing/world/kind";
import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Record from "effect/Record";
import { Box3 } from "three";

import {
  modelLibrary,
  modelNameOf,
  modelSpecOf,
  PLACEHOLDER,
  placeholderModel,
} from "../src/models.ts";
import { modelGeometry } from "../src/scene/model-geometry.ts";

const names = [...Record.keys(modelLibrary), PLACEHOLDER];

const HALF_CELL = 0.5;
const SLACK = 0.02;

describe("the model library", () => {
  it.each(kindNames)("draws the %s kind with a model of its own", (kind) => {
    const model = kindDefaults(kind).appearance?.model;

    expect(model).toBeDefined();
    expect(modelNameOf(model)).toBe(model);
  });

  it("draws unknown or missing models as the placeholder", () => {
    expect(modelNameOf("teapot")).toBe(PLACEHOLDER);
    expect(modelNameOf(undefined)).toBe(PLACEHOLDER);
    expect(modelNameOf("constructor")).toBe(PLACEHOLDER);
    expect(modelSpecOf("teapot")).toBe(placeholderModel);
  });

  it.each(names)(
    "builds %s inside its cell, standing on the ground",
    (name) => {
      const geometry = modelGeometry(name);

      const parts = Arr.getSomes([
        geometry.fixed,
        geometry.tinted,
        geometry.glowing,
      ]);

      expect(parts.length).toBeGreaterThan(0);

      const box = new Box3();

      for (const part of parts) {
        part.computeBoundingBox();
        box.union(part.boundingBox ?? new Box3());
      }

      expect(
        Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z)
      ).toBeLessThanOrEqual(HALF_CELL + SLACK);
      expect(box.min.y).toBeGreaterThanOrEqual(-SLACK);
      expect(box.max.y).toBeLessThanOrEqual(modelSpecOf(name).height + 0.15);
    }
  );

  it("gives every part a vertex colour", () => {
    for (const name of names) {
      const { fixed } = modelGeometry(name);

      expect(
        Option.match(fixed, {
          onNone: () => true,
          onSome: (part) => part.hasAttribute("color"),
        })
      ).toBeTruthy();
    }
  });
});
