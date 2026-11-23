# hello-world

The [Alchemy Rivet tutorial](https://alchemy.run/rivet/tutorial/part-1), parts 1 to 3, with the rooms on [Rivet Cloud](https://alchemy.run/rivet/rivet-cloud): chat rooms as Rivet Durable Objects behind a small HTTP API.

Each room counts its visitors in key-value storage, keeps its messages in SQL, and clears them with an alarm an hour after the last one.

Rivet Cloud runs the control plane and the node that hosts the rooms. The API is a Docker service on this machine that calls the rooms over HTTPS.

## Run it

Create a cluster in the [Rivet dashboard](https://dashboard.rivet.dev), then sign in once. The profile keeps the session and the cluster you chose.

```sh
cd packages/hello-world
pnpm exec alchemy profile edit --add RivetCloud
```

```sh
docker swarm init --advertise-addr 127.0.0.1 --listen-addr 127.0.0.1:2377   # once per machine
pnpm --filter @agent-crossing/hello-world run deploy
```

A deploy that changes a room builds a `linux/amd64` image of the node program with the local `docker` and uploads it, and Rivet then prepares the build. The first deploy here spent 12 minutes in that step. A sign-in session's token lasts 15 minutes and Alchemy reads it once before waiting, so a slow preparation fails with `HTTP 401`. Run the deploy again: it finds the uploaded build and carries on ([alchemy-run/alchemy#3680](https://github.com/alchemy-run/alchemy/issues/3680)). The API is published on port 3000, on every interface of the host.

```sh
curl -X POST localhost:3000/lobby/join
curl -X POST localhost:3000/lobby/messages \
  -H 'content-type: application/json' \
  -d '{"author":"sam","text":"hello"}'
curl localhost:3000/lobby/messages
```

```sh
pnpm --filter @agent-crossing/hello-world run destroy
```

## Rivet Cloud limits

- The free plan runs one `e2-micro` or `e2-small` node. The pool uses the default, `e2-small`.
- A cluster runs one pool of nodes, so one stage at a time can deploy to it. A second stage's deploy is refused.
- The node image Rivet stores holds the stage's namespace and any secrets the rooms are given.
- The deploy state is in `.alchemy/state`, which git ignores. It is the only record of what was created on the cluster, so destroy the stage before deleting it.

## Back to local Docker

`src/cluster.ts` is the only file that names Rivet Cloud. Destroy the stage, then swap its two Layers for the Docker ones and deploy:

```ts
import * as RivetDocker from "@alchemy.run/rivet/Docker";

export const Cluster = RivetDocker.SwarmControlPlane("Rivet");

export const Default = RivetDocker.SwarmPool("Default").pipe(
  Layer.provide(Cluster)
);
```

## Differences from the tutorial

The behaviour and endpoints are the tutorial's. The code differs where the repo's lint rules ask for it:

- `room.ts` reads the time from `Clock` and holds the idle time as a `Duration`, instead of `Date.now()` and a millisecond constant.
- `room.ts` passes the per-room Effect to `Effect.succeed`, because its per-node phase has nothing to yield.
- `api.ts` splits the path with `effect/String`.
- The Stack is named `HelloWorld`.

## Patched dependency

`@alchemy.run/docker@2.0.0-beta.87` is patched in `patches/`. Unpatched, it inspects a new swarm network before Docker has allocated it, records an empty driver, and then tries to replace the in-use network on every later deploy. It only matters with the Docker cluster, which creates that network. Drop the patch once a release waits for the allocation: [alchemy-run/alchemy#3679](https://github.com/alchemy-run/alchemy/issues/3679).

## Bun at runtime

The API and the room nodes run in `oven/bun` containers, whatever runs the deploy. `@effect/platform-bun` is a dependency so that it is bundled into the API image. Without it the bundle leaves the import unresolved, and Bun downloads the latest release from npm each time a container starts.
