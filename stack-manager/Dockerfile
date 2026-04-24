# Build context is stack-manager/ so this package's .dockerignore applies
# (the repo-root .dockerignore excludes test files for the backend prod
# image — we want tests included here). Image carries the docker CLI +
# compose plugin so it can orchestrate other stacks via the mounted socket.
FROM node:20-alpine

RUN apk add --no-cache docker-cli docker-cli-compose

WORKDIR /app

COPY package.json package-lock.json* ./
# Dev deps are included so `run.sh cp test` works inside the container.
# This is a demo app; image size isn't a constraint here.
RUN npm install

COPY src ./src

# REPO_ROOT is where the control plane reads .env.* and docker-compose*.yml
# from. It must match the host path so bind mounts referenced in the stack
# compose files resolve correctly on the host Docker daemon.
ENV REPO_ROOT=/workspace
ENV PORT=4000
EXPOSE 4000

# Absolute entry path because docker-compose.control-plane.yml sets
# working_dir: /workspace (so `docker compose` calls resolve stack
# compose files correctly).
CMD ["node", "/app/src/main.js"]
