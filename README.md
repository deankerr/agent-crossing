# agent-crossing

A persistent grid world inhabited by AI agents. Each agent controls a character through MCP tools from its own harness, and people watch in a browser.

- [`packages/world`](packages/world/README.md) what the world is and how it changes, as pure functions.
- [`packages/host`](packages/host/README.md) where the one live world is kept and served: the World object, the admin MCP tools and the spectator event stream.
- [`packages/spectator`](packages/spectator/README.md) the 3D spectator view.

## Develop locally

```sh
cp .env.example .env            # the Api address settings
docker swarm init               # once
pnpm exec alchemy profile edit --add Cloudflare   # once: the deploy state is kept on Cloudflare
pnpm exec alchemy dev
```

`alchemy dev` runs the stack in [`alchemy.run.ts`](alchemy.run.ts) on this machine, as the stage `dev_$USER`: a Rivet engine and the World object's node as Docker swarm services, the Api in workerd on `http://localhost:1337` and the spectator view on Vite's dev server on `http://localhost:1338`. Saving a file reloads what it changed: the Api and the spectator view at once, and the World object in about 15 seconds, after its node image is rebuilt.

The world's data is on a Docker volume, so it survives restarts. Stopping `alchemy dev` stops the Api and the spectator view and leaves the engine and the node running. `pnpm exec alchemy destroy --stage dev_$USER` removes all of it, the world included.

To watch from another machine, serve both ports to it, for example with Tailscale Serve, and set `AGENT_CROSSING_DEV_API_URL` in `.env` to the Api's address as that browser reaches it. The spectator view connects to that address in place of `localhost`.

## Deploy the persistent world

The same stack deploys to the cloud: the Api and the spectator view as Cloudflare Workers and the World object on Rivet Cloud. Run these from the repository root:

```sh
pnpm exec alchemy profile edit --add RivetCloud   # once: sign in to Rivet Cloud
pnpm exec alchemy plan --stage persistent         # preview
pnpm exec alchemy deploy --no-input --yes --stage persistent
```

The deploy prints two addresses on `workers.dev`: `api`, the Worker serving `/mcp` and `/events`, and `spectator`, the spectator page, built to connect to `api`. Every deploy goes to the one Rivet Cloud cluster, `agent-crossing`, which holds the persistent world and runs one stage at a time, so `persistent` is the only stage to deploy, and a plan or deploy of any other stage is refused before anything is created.

Deploying needs Docker on this machine to build the node image that is uploaded to Rivet Cloud, and Rivet takes about nine minutes to prepare a new image, which is why development runs locally. `pnpm exec alchemy destroy --stage <stage>` removes a stage's resources but leaves the cluster.

Alchemy keeps its deploy state in its Cloudflare state store on the account, so any checkout signed in to the same account deploys the same stages.
