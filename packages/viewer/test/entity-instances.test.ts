import { entityIdFor } from "@agent-crossing/world/entity";
import { entityCount } from "@agent-crossing/world/world";
import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Order from "effect/Order";

import { entityInstances, jitterOf } from "../src/entity-instances.ts";
import type { EntityInstance } from "../src/entity-instances.ts";
import { landSurface, WATER_DROP } from "../src/layout.ts";
import { PLACEHOLDER } from "../src/models.ts";
import { cell, paintCells, paintRect, runAll, spawn } from "./world.fixture.ts";

const world = runAll([
  paintRect(cell(-6, -8), cell(-4, -6), "grass", 2),
  paintCells([cell(30, 30)], "water", 1),
  paintRect(cell(10, 0), cell(10, 3), "dirt", 0),
  spawn("oak", cell(-5, -7)),
  spawn("flowers", cell(-5, -7), { colour: "blue" }),
  spawn("mushroom", cell(-5, -7)),
  spawn("mushroom", cell(-5, -7)),
  spawn("lily-pad", cell(30, 30)),
  spawn("rock", cell(-6, -8), { appearance: { model: "teapot" } }),
  spawn("fence", cell(10, 0)),
  spawn("fence", cell(10, 1)),
  spawn("fence", cell(10, 2)),
  spawn("flowers", cell(-4, -6)),
]);

const groups = entityInstances(world);

const instancesOf = (model: string) => groups.get(model) ?? [];

const all = Arr.flatten([...groups.values()]);

const onCell = (x: number, y: number) =>
  Arr.filter(all, (instance) => instance.cell.x === x && instance.cell.y === y);

const offsetOf = (instance: EntityInstance) =>
  Math.hypot(instance.x - instance.cell.x, instance.z - instance.cell.y);

describe(entityInstances, () => {
  it("draws every entity once, grouped by model", () => {
    expect(all).toHaveLength(entityCount(world));
    expect(instancesOf("oak-tree")).toHaveLength(1);
    expect(instancesOf("mushroom")).toHaveLength(2);
    expect(instancesOf("fence")).toHaveLength(3);
  });

  it("groups unknown models under the placeholder", () => {
    expect(instancesOf(PLACEHOLDER)).toHaveLength(1);
    expect(instancesOf("teapot")).toHaveLength(0);
  });

  it("stands things on their cell's surface, negatives included", () => {
    const [oak] = instancesOf("oak-tree");

    expect(oak).toMatchObject({ x: -5, z: -7 });
    expect(oak?.y).toBeCloseTo(landSurface(2));
  });

  it("floats aquatic things on the water surface", () => {
    const [pad] = instancesOf("lily-pad");

    expect(pad?.y).toBeCloseTo(landSurface(1) - WATER_DROP);
  });

  it("moves cover and unlayered things aside for an object", () => {
    const sharing = onCell(-5, -7);
    const [oak] = instancesOf("oak-tree");
    const others = Arr.filter(sharing, (instance) => instance !== oak);

    expect(sharing).toHaveLength(4);
    expect(oak === undefined ? 1 : offsetOf(oak)).toBe(0);

    for (const instance of others) {
      expect(offsetOf(instance)).toBeGreaterThan(0.15);
      expect(offsetOf(instance)).toBeLessThan(0.5);
    }

    const spots = new Set(
      Arr.map(others, (instance) => `${instance.x},${instance.z}`)
    );

    expect(spots.size).toBe(3);
  });

  it("leaves a thing alone on its cell in the middle", () => {
    const [alone] = onCell(-4, -6);

    expect(alone === undefined ? 1 : offsetOf(alone)).toBe(0);
  });

  it("tints with the entity's colour or the model's default", () => {
    const tints = Arr.map(
      instancesOf("flower-patch"),
      (instance) => instance.tint
    );

    expect(Arr.sort(tints, Order.String)).toStrictEqual(["blue", "pink"]);
  });

  it("runs a line of fences along it", () => {
    for (const fence of instancesOf("fence")) {
      expect(fence.heading).toBeCloseTo(Math.PI / 2);
    }
  });

  it("is the same for the same world", () => {
    expect(entityInstances(world)).toStrictEqual(groups);
  });
});

describe(jitterOf, () => {
  const ids = Arr.makeBy(200, (index) => entityIdFor(index + 1));

  it("depends only on the id", () => {
    for (const id of ids) {
      expect(jitterOf(id, "nature")).toStrictEqual(jitterOf(id, "nature"));
    }
  });

  it("varies heading and size between ids within limits", () => {
    const jitters = Arr.map(ids, (id) => jitterOf(id, "nature"));
    const headings = new Set(Arr.map(jitters, (jitter) => jitter.heading));

    expect(headings.size).toBeGreaterThan(150);

    for (const { heading, scale } of jitters) {
      expect(heading).toBeGreaterThanOrEqual(0);
      expect(heading).toBeLessThan(Math.PI * 2);
      expect(scale).toBeGreaterThanOrEqual(0.85);
      expect(scale).toBeLessThanOrEqual(1.15);
    }
  });

  it("turns built things by quarters and keeps their size", () => {
    for (const id of ids) {
      const { heading, scale } = jitterOf(id, "quarter");

      expect((heading / (Math.PI / 2)) % 1).toBeCloseTo(0);
      expect(scale).toBe(1);
    }
  });
});
