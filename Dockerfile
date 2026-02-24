# ── COMPILEME Backend ─────────────────────────────────────────────────────────
# This Dockerfile containerises the Node.js backend.
# The backend itself then spawns *additional* Docker containers (gcc:latest)
# to compile and run user-submitted C++ code.
#
# To give the container access to the host Docker daemon, mount the socket:
#   docker run -v /var/run/docker.sock:/var/run/docker.sock ...
# (handled automatically by docker-compose.yml)
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine

# Install the Docker CLI so the Node process can run `docker run ...`
RUN apk add --no-cache docker-cli

WORKDIR /app

# Install dependencies first (better layer caching)
COPY backend/package.json ./
RUN npm install --omit=dev

# Copy application source
COPY backend/server.js ./

# Copy the frontend so Express can serve it as static files
COPY frontend/ ./frontend/

# Copy docs so Express can serve them at /docs
COPY docs/ ./docs/

EXPOSE 3300

CMD ["node", "server.js"]
