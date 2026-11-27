# Version skew between the Api and the World object

Status: open. Not pressing while the world has no users.

## The problem

A deploy updates the parts of the stack at different times, so for a while the new code of one part talks to the old code of another. The parts are the Api (a Cloudflare Worker), the World object's node (an image on Rivet Cloud), the spectator page, and every agent's MCP session.

Some skew is inherent to this project: an agent holds the tool list it read when it connected, and a spectator page keeps running the code it loaded. The deployment makes it far worse. Measured on the `persistent` stage on 2026-11-27, at commit `578e271`:

- The Api was updated 12 seconds into the deploy.
- The node took over 13 minutes later. Rivet Cloud spent 12m 27s of that preparing the uploaded image, on the free plan.
- The old node kept answering for a minute or two after the deploy reported done.

A deploy that leaves the World object's code alone takes about 7 seconds and has no such window.

## What it did

The deploy changed the World object's methods and its stored tables, and gave the world a new name, `world-5`. Calls made right after the deploy reached the old node under that name. It created its own older `events` table there. When the new node took over, `CREATE TABLE IF NOT EXISTS` kept that table, so views worked and every command failed.

Any caller in the window is enough to cause this, including a spectator page reconnecting on its own.

## What we do today

- After a deploy that changes the World object, leave the world alone until the new node serves: a view answers in the new wording.
- If the world's tables are wrong, give the world a new name (`WORLD_NAME` in `packages/server/src/WorldObject.ts`), deploy, and generate the world again. That deploy takes seconds, because the name does not change the node image.

## Ideas not yet tried

- Update the Api only after the node has taken over, if Alchemy can order the two.
- A deployment target that prepares a node image quickly. The local Docker swarm rebuilds the same image in about 15 seconds.
- Have the Api and the node tell each other which version they are, so that a mismatch is refused instead of served.
- Decide what an agent's session and a spectator page should do when the world changes under them.
