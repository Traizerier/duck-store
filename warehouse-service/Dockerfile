# syntax=docker/dockerfile:1

FROM node:20-alpine

# Pre-create the dev-time workspace paths with `node` ownership so that
# named volumes and bind mounts inherit these perms on first mount.
# This keeps dev and prod running as the same non-root user.
RUN mkdir -p /workspace/warehouse-service/node_modules \
    && chown -R node:node /workspace

WORKDIR /app
RUN chown node:node /app

USER node

COPY --chown=node:node package.json package-lock.json* ./
RUN npm install --omit=dev

COPY --chown=node:node src/ ./src/

EXPOSE 4001
CMD ["node", "src/server.js"]
