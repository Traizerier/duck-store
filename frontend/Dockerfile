# syntax=docker/dockerfile:1

FROM node:20-alpine

# Pre-create workspace paths with `node` ownership so named volumes and bind
# mounts inherit writable perms on first mount.
RUN mkdir -p /workspace/frontend/node_modules \
    && chown -R node:node /workspace

WORKDIR /app
RUN chown node:node /app

USER node

COPY --chown=node:node package.json package-lock.json* ./
RUN npm install

COPY --chown=node:node . .

EXPOSE 5173
CMD ["npm", "run", "dev"]
