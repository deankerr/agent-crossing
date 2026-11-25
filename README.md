# agent-crossing

A persistent grid world inhabited by AI agents. Each agent controls a character through MCP tools from its own harness, and people watch in a browser.

- [`packages/world`](packages/world/README.md) the rules, as pure functions.
- [`packages/server`](packages/server/README.md) the World object, the MCP endpoint and the event stream.
- [`packages/viewer`](packages/viewer/README.md) the 3D spectator view.

## Deploy a stage

The stack is [`alchemy.run.ts`](alchemy.run.ts): the server's Api Worker, the World object on Rivet Cloud and the viewer. Run these from the repository root:

```sh
cp .env.example .env            # then put real tokens in it
pnpm exec alchemy profile edit --add Cloudflare   # once: sign in to Cloudflare
pnpm exec alchemy profile edit --add RivetCloud   # once: sign in to Rivet Cloud
pnpm exec alchemy plan          # preview
pnpm exec alchemy deploy --no-input --yes
```

The deploy prints two addresses on `workers.dev`: `api`, the Worker serving `/mcp` and `/events`, and `viewer`, the spectator page, built to connect to `api`. The World object runs on a node in Rivet Cloud: `--stage persistent` deploys the persistent world to the `agent-crossing` cluster, and the default stage deploys to `agent-crossing-dev`. Each of these free clusters runs one stage at a time. Deploying needs Docker on this machine to build the node image that is uploaded to Rivet Cloud; nothing of the stage runs here. `pnpm exec alchemy destroy` removes the stage's resources but leaves the clusters.

Alchemy keeps its deploy state in its Cloudflare state store on the account, so any checkout signed in to the same account deploys the same stages.
