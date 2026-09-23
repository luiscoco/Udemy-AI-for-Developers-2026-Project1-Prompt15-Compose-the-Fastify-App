# Compose the Fastify App

This README walks through what was built for this prompt: wiring up the Fastify
backend by composing the pieces (`repository`, `dashboard`) that earlier prompts
already created and tested in isolation.

## Goal

Earlier prompts built pure, dependency-free building blocks:

- [`apps/backend/src/data/repository.ts`](apps/backend/src/data/repository.ts) —
  loads `assets.json`, `technicians.json`, and `work-orders.json` from disk and
  exposes them through a `Repository` interface.
- [`apps/backend/src/domain/dashboard.ts`](apps/backend/src/domain/dashboard.ts) —
  a pure function, `buildDashboardSummary(workOrders)`, that computes dashboard
  counts from a list of work orders.

Neither of those files knows anything about HTTP. This prompt's job was to
*compose* them into an actual web server, split into two files with distinct
responsibilities:

- **`app.ts`** — builds and configures the Fastify instance (routes, wiring).
  It never calls `.listen()`, which is what makes it testable.
- **`server.ts`** — the thin entry point that actually starts listening on a
  port. This file is what you run in production/dev; it's not imported by tests.

## Steps followed

1. **Read the existing pieces first.** Before writing any code, the repository
   (`repository.ts`) and the dashboard summary function (`dashboard.ts`) were
   read to learn their exact shapes — e.g. that `Repository.listWorkOrders()`
   returns `WorkOrder[]`, which is exactly what `buildDashboardSummary()`
   expects as input. Composing code correctly requires knowing the contracts
   of the pieces you're gluing together.

2. **Checked the project for a Fastify dependency — there wasn't one.**
   `apps/backend/package.json` only depended on `@equipment-hub/contract` and
   `vitest`. `fastify` was added as a real dependency, and `@types/node` was
   added as a dev dependency (needed because `server.ts` reads
   `process.env.PORT`, and TypeScript needs Node's type definitions to know
   what `process` is).

3. **Wrote `apps/backend/src/app.ts`.**
   ```ts
   export function createApp(repository: Repository = createRepository()): FastifyInstance {
     const app = Fastify({ logger: false });

     app.get("/api/health", async () => ({ status: "ok" }));
     app.get("/api/assets", async () => repository.listAssets());
     app.get("/api/technicians", async () => repository.listTechnicians());
     app.get("/api/dashboard/summary", async () =>
       buildDashboardSummary(repository.listWorkOrders())
     );

     return app;
   }
   ```
   Two design choices worth calling out for students:
   - **`repository` is a parameter with a default value**, not a hardcoded
     import used directly inside the function body. This is *dependency
     injection*: in production nobody passes an argument, so
     `createRepository()` (reading real JSON files) kicks in. In tests, a fake
     in-memory repository can be passed instead — no disk I/O, fully
     predictable data.
   - **`createApp()` never calls `.listen()`.** Building the app and running
     it are two different concerns. Keeping them separate is what allows the
     app to be tested via `app.inject()` (see below) without opening a real
     network socket.

4. **Wrote `apps/backend/src/server.ts`**, the small entry point that actually
   starts the server:
   ```ts
   const PORT = Number(process.env.PORT ?? 3001);
   const app = createApp();
   app.listen({ port: PORT, host: "127.0.0.1" }, (err) => {
     if (err) {
       app.log.error(err);
       process.exit(1);
     }
   });
   ```
   Binding to `127.0.0.1` instead of `0.0.0.0` keeps the dev server reachable
   only from the local machine, which is the safer default for local
   development.

5. **Wrote `apps/backend/src/app.test.ts`** to prove `createApp()` is testable
   in isolation, using `app.inject()`:
   ```ts
   const app = createApp(makeFakeRepository());
   const response = await app.inject({ method: "GET", url: "/api/health" });
   expect(response.statusCode).toBe(200);
   ```
   `app.inject()` is a Fastify testing utility that dispatches a request
   directly through the router in-process — it simulates an HTTP call without
   binding a port or touching the network. That's why `server.ts` (which calls
   `.listen()`) is never imported by the tests: the tests only need `app.ts`.

   The test file also defines a small `makeFakeRepository()` helper that
   implements the `Repository` interface with in-memory arrays and lets each
   test override just the methods it cares about (e.g.
   `listWorkOrders: () => [workOrder]`). This is the same "fake object"
   pattern used by `dashboard.test.ts` for its `makeWorkOrder()` fixture
   builder.

6. **Ran the full test suite** (`npx vitest run`) to confirm the new
   `app.test.ts` passes alongside the pre-existing domain tests
   (`dashboard.test.ts`, `reference.test.ts`, `workOrderLifecycle.test.ts`) —
   57 tests passing in total, with no regressions.

## Why this structure matters

Splitting `app.ts` from `server.ts` is a common and valuable pattern in
Fastify (and Express/Koa) projects:

| File        | Responsibility                          | Imported by tests? |
|-------------|------------------------------------------|---------------------|
| `app.ts`    | Build & configure the app (routes, DI)  | ✅ yes              |
| `server.ts` | Bind a port and actually run the server | ❌ no               |

If routes were registered directly inside `server.ts` alongside
`app.listen()`, testing any route would require actually starting a server on
a real port for every test run — slower, flakier (port conflicts), and harder
to isolate. Separating "build" from "run" is what makes fast, reliable HTTP
tests possible.

## Running it yourself

```bash
# install dependencies from the repo root
npm install

# run the backend test suite
cd apps/backend
npx vitest run

# start the dev server (defaults to port 3001) — compile then run,
# since this project has no TS-in-place runner (e.g. tsx) configured yet
npx tsc -p tsconfig.json --outDir dist
node dist/server.js
```

With the server running, try it out:

```bash
curl http://127.0.0.1:3001/api/health
curl http://127.0.0.1:3001/api/dashboard/summary
```

## Running it in Windows Terminal (PowerShell)

The commands above use Unix-style syntax (`cd apps/backend`, `curl`). In
Windows Terminal running PowerShell, use this instead, starting from the repo
root:

```powershell
# install dependencies (only needed once, or after pulling changes)
npm install

# move into the backend package
cd apps\backend

# compile the TypeScript sources to dist/
npx tsc -p tsconfig.json --outDir dist

# start the server (defaults to port 3001; override with $env:PORT = "4000")
node dist\server.js
```

The server keeps running in that terminal window (it never returns) — press
`Ctrl+C` to stop it. To try it out, open a **second** PowerShell tab/window
and run:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health
Invoke-RestMethod http://127.0.0.1:3001/api/dashboard/summary
```

> `curl` in PowerShell is usually aliased to `Invoke-WebRequest`, not the real
> curl.exe, so `Invoke-RestMethod` (which parses the JSON response for you) is
> the more reliable choice here.
