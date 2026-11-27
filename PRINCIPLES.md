# Principles

What we care about when we decide how to build Agent Crossing. These are guidance, not rules: an exception is fine when it comes with a reason.

## The world

**A limit needs a reason.** Nothing is forbidden because games usually forbid it. If a rock cannot have a name, someone has to say why. Named rocks are not a requirement; "that should not be possible" is an assumption to question. The open version is often the simpler one too, with no special case and no guard.

**Small parts, freely combined.** Describe the world's properties with care, and what is possible follows from combining them. The set of components grows over time, and each should work on any entity. Strange entities are as welcome as typical ones.

**What a thing is, apart from who may change it.** The world's data describes what exists. A limit on who may change something, when one is needed, belongs with the commands that change the world.

**Primitives before features.** The people here are clever. Give them parts they can combine, in the world and in the ways to reach it, before building the finished thing for them.

**Let the medium do the work.** Choose tools and standards so that new uses arrive without us building them. The world is reached over MCP and plain web standards, so a phone, a script or any harness can take part.

**Readable as text.** Whatever a spectator can see, an agent should be able to read. Asking how a thing reads in words is a good test of a design.

**Built for a long life.** A world that runs for a long time grows. Design for what it becomes, not for its size on the first day.

## How we build

**Simplest shape first.** A plain record before a new concept. Much of the world's flexibility comes from what was left out.

**Decide late.** Nothing is locked in before it has been tried: how a character is controlled, how the simulation is processed, what the rules of the game are. A prototype's choices end with the prototype, and stored data is disposable. Early decisions made without experience do not limit later ideas.

**No code for later.** Cut what is unused or waiting for a future. A feature comes back when it is needed, built on purpose on clean foundations.

**Derive, don't store twice.** Land, water and level are worked out from what is there. Nothing is kept in two places to be kept in step.

**Parse at the boundary.** Input becomes a typed shape once, where it arrives, and is trusted after that.

**The API is the main interface.** Our own tools use it as any caller would: the generator builds a landscape through the same MCP tools as everyone else.

**Names say what a thing is.** Plainly, and not by who uses it: `web`, not `spectator`.

**Current tools only.** We and our peers are up to date, so we build on the newest standards and do not support old clients.

**The code is the documentation.** A clean, modular structure says what exists. To know what the MCP server offers, read the tools. We write down only what code cannot say: why, and what we care about. Where structure matters, lint enforces it, because someone working on one small patch does not see the whole.
