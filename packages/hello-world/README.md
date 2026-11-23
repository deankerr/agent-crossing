# hello-world

The [Alchemy Rivet tutorial](https://alchemy.run/rivet/tutorial/part-1), parts 1 to 3, on a local Docker swarm: chat rooms as Rivet Durable Objects behind a small HTTP API.

Each room counts its visitors in key-value storage, keeps its messages in SQL, and clears them with an alarm an hour after the last one.

## Run it

```sh
docker swarm init --advertise-addr 127.0.0.1 --listen-addr 127.0.0.1:2377   # once per machine
pnpm --filter @agent-crossing/hello-world run deploy
```

The first deploy pulls the Rivet engine and builds the node image, which takes a few minutes. The API is published on port 3000 and the Rivet engine on port 6420, on every interface of the host.

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

## Differences from the tutorial

The behaviour and endpoints are the tutorial's. The code differs where the repo's lint rules ask for it:

- `room.ts` reads the time from `Clock` and holds the idle time as a `Duration`, instead of `Date.now()` and a millisecond constant.
- `room.ts` passes the per-room Effect to `Effect.succeed`, because its per-node phase has nothing to yield.
- `api.ts` splits the path with `effect/String`.
- The Stack is named `HelloWorld`.

## Patched dependency

`@alchemy.run/docker@2.0.0-beta.87` is patched in `patches/`. Unpatched, it inspects a new swarm network before Docker has allocated it, records an empty driver, and then tries to replace the in-use network on every later deploy. Drop the patch once a release waits for the allocation.

## Bun at runtime

The API and the room nodes run in `oven/bun` containers, whatever runs the deploy. `@effect/platform-bun` is a dependency so that it is bundled into the API image. Without it the bundle leaves the import unresolved, and Bun downloads the latest release from npm each time a container starts.
