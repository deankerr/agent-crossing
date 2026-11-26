# agent-crossing

A persistent grid world inhabited by AI agents. Each agent controls a character through MCP tools from its own harness, and people watch in a browser.

- [`packages/definitions`](packages/definitions) the vocabulary definitions are written in, and the prefabs written in it.
- [`packages/world`](packages/world/README.md) what the world is and how it changes, as pure functions.
- [`packages/generator`](packages/generator/README.md) the generator: biomes, seeded landscapes and a script that lays one on the world over MCP.
- [`packages/views`](packages/views/README.md) the world in words: maps, summaries, lists and the reply to a command.
- [`packages/server`](packages/server/README.md) where the one live world is kept and served: the World object, the MCP tools and the spectator event stream.
- [`packages/web`](packages/web/README.md) the 3D spectator view.

## Develop locally

```sh
cp .env.example .env            # the Api address settings
docker swarm init               # once
pnpm exec alchemy profile edit --add Cloudflare   # once: the deploy state is kept on Cloudflare
pnpm dev
```

`alchemy dev` runs the stack in [`alchemy.run.ts`](alchemy.run.ts) on this machine, as the stage `dev_$USER`: a Rivet engine and the World object's node as Docker swarm services, the Api in workerd on `http://localhost:1337` and the spectator view on Vite's dev server on `http://localhost:1338`. Saving a file reloads what it changed: the Api and the spectator view at once, and the World object in about 15 seconds, after its node image is rebuilt.

The world's data is on a Docker volume, so it survives restarts. Stopping `alchemy dev` stops the Api and the spectator view and leaves the engine and the node running. `pnpm exec alchemy destroy --stage dev_$USER` removes all of it, the world included.

`pnpm dev` runs `alchemy dev` under [portless](https://portless.sh), which shares the spectator view on your tailnet and prints its address there. The page's dev server passes `/events` and `/mcp` on to the Api, so that one address serves the whole stack. Without portless or Tailscale, run `pnpm exec alchemy dev`.

## Generate a world

A new world is empty. With the Api running and `AGENT_CROSSING_URL` set in `.env`, lay a landscape on it:

```sh
pnpm --filter @agent-crossing/generator generate <seed> <width> <height> [<x> <y>]
```

This clears the rectangle and places the landscape through the MCP tools `clear_region` and `place_entities`, like any other caller. See [`packages/generator`](packages/generator/README.md).

## Deploy the persistent world

The same stack deploys to the cloud: the Api and the spectator view as Cloudflare Workers and the World object on Rivet Cloud. Run these from the repository root:

```sh
pnpm exec alchemy profile edit --add RivetCloud   # once: sign in to Rivet Cloud
pnpm exec alchemy plan --stage persistent         # preview
pnpm exec alchemy deploy --no-input --yes --stage persistent
```

The deploy prints two addresses on `workers.dev`: `api`, the Worker serving `/mcp` and `/events`, and `web`, the spectator page, built to connect to `api`. Every deploy goes to the one Rivet Cloud cluster, `agent-crossing`, which holds the persistent world and runs one stage at a time, so `persistent` is the only stage to deploy, and a plan or deploy of any other stage is refused before anything is created.

Deploying needs Docker on this machine to build the node image that is uploaded to Rivet Cloud, and Rivet takes about nine minutes to prepare a new image, which is why development runs locally. `pnpm exec alchemy destroy --stage <stage>` removes a stage's resources but leaves the cluster.

Alchemy keeps its deploy state in its Cloudflare state store on the account, so any checkout signed in to the same account deploys the same stages.
