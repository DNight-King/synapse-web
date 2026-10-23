---
title: Local development
description: Running the app and its toolchain locally or in a container.
order: 13
---

Two supported ways to run the app locally. Both use the same Node version.

| Path                          | Best for                                            |
| ----------------------------- | --------------------------------------------------- |
| [Native](#native-setup)       | day-to-day work, fastest, editor integration        |
| [Container](#container-setup) | onboarding, matching CI exactly, no local toolchain |

## One Node version, three places

The Node version is pinned in **`.nvmrc`**, and that is the only place it is
declared:

- native local setups read it via `nvm use`
- CI reads it via `node-version-file: .nvmrc`
- `Dockerfile.dev` builds from the matching `node:` tag

`scripts/toolchain-consistency.test.ts` runs as part of `npm test` and fails if
those drift apart, or if `ci.yml` goes back to hardcoding a version. This is not
hypothetical: the lockfile was regenerated to match one npm version
(`910fd81`) and jsdom was downgraded for Node 20 compatibility (`91e5082`).

npm is pinned separately in `Dockerfile.dev` via `ARG NPM_VERSION`, because the
`node:20` tag ships whatever npm was current when the image was built, and a
regenerated lockfile from a different npm causes noisy diffs and CI failures.

## Native setup

```bash
nvm use            # reads .nvmrc
npm install
npm run dev
```

If you are not using nvm, any Node 20.x works, but nvm is what keeps CI and your
machine identical.

## Container setup

Requires Docker with Compose v2.

```bash
docker compose up --build
```

Then open [http://localhost:3000](http://localhost:3000). The working tree is
bind-mounted, so editing a file on the host reloads the page in the browser.

### Verifying your setup matches CI

```bash
docker compose exec web node --version
docker compose exec web npm --version
```

These should match `.nvmrc` and `Dockerfile.dev`'s `ARG NPM_VERSION`.

### Why these settings are here

Each of these is a fix for a specific way a container silently misbehaves:

- **The container runs as your host UID/GID** (`HOST_UID`/`HOST_GID` build args).
  Running as root leaves root-owned files in your working tree, which then break
  your next native `npm install`. Override if your IDs are unusual:
  ```bash
  HOST_UID=$(id -u) HOST_GID=$(id -g) docker compose up --build
  ```
- **`node_modules` and `.next` are anonymous volumes**, not bind-mounted. Without
  this, a host-side `node_modules` — built for a different platform or libc —
  shadows the container's and native modules break in confusing ways.
- **File watching is polled** (`CHOKIDAR_USEPOLLING`). inotify events do not
  reliably cross a bind mount, and not at all on Docker Desktop's
  virtiofs/gRPC-FUSE. Without polling, hot reload silently does nothing: the
  container runs, the page just never updates, and it looks like a broken setup.
  This costs some CPU. On Linux with a native filesystem you can turn it off in
  `docker-compose.override.yml`.
- **The dev server binds `0.0.0.0`.** Binding `localhost` inside the container
  is the classic reason a working container is unreachable from the browser.
- **`stdin_open`/`tty`** so `npm run dev` gets a TTY and behaves normally.

### Common problems

**Hot reload does not work.** Confirm `CHOKIDAR_USEPOLLING` is set. If you
overrode it, that is why. Check the container is actually watching the bind
mount: `docker compose exec web sh -c 'ls /app/app'`.

**`EACCES` or root-owned files.** The container ran as root at some point. Run
`sudo chown -R $(id -u):$(id -g) .` and rebuild with `HOST_UID`/`HOST_GID` set.

**Port 3000 already in use.** `docker compose up` with an override:
`docker compose run --service-ports -e PORT=3001 web`. Or stop whatever else is
on 3000 — a native `npm run dev` is the usual culprit.

**Native modules fail to load.** Usually a stale bind-mounted `node_modules`.
Rebuild without cache: `docker compose down -v && docker compose up --build`.
The anonymous volume is recreated, so dependencies install fresh.

**Changes to `package.json` are not picked up.** `npm install` was not re-run
inside the container. The Dockerfile installs at build time, so rebuild after
changing dependencies: `docker compose up --build`.

## Verifying the environment

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

These are exactly what `CI` runs, in the same order.

## Not in scope

Containerising the production build and deploy. This is a development environment
only; deployment remains the existing Vercel flow.
