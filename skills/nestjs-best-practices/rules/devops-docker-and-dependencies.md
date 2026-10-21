---
title: Build Small, Non-Root Docker Images and Audit Dependencies
impact: MEDIUM
impactDescription: Smaller attack surface, clean shutdowns in containers, and known-vulnerable packages caught before release
tags: devops, docker, security, dependencies, npm-audit
---

## Build Small, Non-Root Docker Images and Audit Dependencies

**Impact: MEDIUM (smaller attack surface, clean shutdowns in containers, and known-vulnerable packages caught before release)**

The basic `Dockerfile` in the docs works, but it ships dev dependencies and source code, runs as `root`, and installs whatever versions `npm install` picks that day. Node.js Best Practices (section 8) adds a few cheap fixes: a multi-stage build, `npm ci` from the lockfile, a non-root user, `NODE_ENV=production`, and starting `node` directly so it gets `SIGTERM`.

**Incorrect (root, dev deps in the image, signals lost):**

```dockerfile
FROM node:latest                 # moving tag: a different image every build
WORKDIR /app
COPY . .                         # copies .env, .git and local node_modules too
RUN npm install                  # ignores the lockfile
RUN npm run build
ENV JWT_SECRET=supersecret       # baked into every layer, visible with docker history
CMD npm run start:prod           # shell form: npm/sh gets SIGTERM, Node may not
```

**Correct (multi-stage, lockfile, non-root, exec-form CMD):**

```dockerfile
# ---- build ----
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci                                  # exact versions from the lockfile
COPY . .
RUN npm run build && npm prune --omit=dev   # drop dev dependencies after building

# ---- run ----
FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node                                   # the official image ships a non-root "node" user
EXPOSE 3000
CMD ["node", "dist/main.js"]                # exec form: Node is PID 1 and receives SIGTERM
```

```text
# .dockerignore
node_modules
dist
.git
.env*
*.log
coverage
```

```bash
# CI: fail the build on known high-severity vulnerabilities in production dependencies
npm ci
npm audit --omit=dev --audit-level=high
```

Notes:

- Pin the base image to a major version at least (`node:24-slim`), or to a digest for fully repeatable builds. NestJS 12 needs Node.js 20.19+ or 22.12+.
- Secrets come from the runtime (environment variables or a secrets manager), never from `ENV` or `COPY` in the image.
- With `app.enableShutdownHooks()` (see `devops-graceful-shutdown`), the exec-form `CMD` lets Nest run its shutdown hooks when the container stops.
- Let a bot (Renovate or Dependabot) open update PRs, so security fixes do not wait for someone to remember.

Reference: [NestJS Deployment](https://docs.nestjs.com/deployment) · [Node.js Best Practices: Docker](https://github.com/goldbergyoni/nodebestpractices#8-docker-best-practices) · [npm audit](https://docs.npmjs.com/cli/commands/npm-audit)
