# syntax=docker/dockerfile:1

# Build context is the repo root (see docker-compose.yml) so COPY paths
# include the `backend/` and `shared/` prefixes. `.dockerignore` at the
# repo root keeps the context lean.

FROM node:20-alpine

# Pre-create the dev-time workspace paths with `node` ownership so that
# named volumes and bind mounts inherit these perms on first mount.
# This keeps dev and prod running as the same non-root user.
RUN mkdir -p /workspace/backend/node_modules \
    && chown -R node:node /workspace

WORKDIR /app
RUN chown node:node /app

USER node

COPY --chown=node:node backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev

COPY --chown=node:node backend/src/ ./src/

# server.js defaults ENUMS_PATH to `resolve(__dirname, "../../shared/enums.json")`,
# which resolves to `/shared/enums.json` when the app lives at `/app/src/`.
# Copy the canonical enums file there so the default path works without
# any env-var configuration in the prod compose stanza.
USER root
RUN mkdir -p /shared && chown node:node /shared
USER node
COPY --chown=node:node shared/enums.json /shared/enums.json

EXPOSE 4001
CMD ["node", "src/server.js"]
