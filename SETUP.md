# COMPILEME — How to Run It Locally

This is my guide to getting the compiler running on your own machine. I wrote it step by step so you don't have to guess anything.

For AWS deployment, see [AWS_DEPLOY.md](AWS_DEPLOY.md).
For CI/CD and domain setup, see [CI_CD.md](CI_CD.md).

---

## What you need installed

| Tool | Minimum version | Check you have it |
|------|----------------|-------------------|
| Node.js | 18+ | `node --version` |
| npm | 9+ (ships with Node) | `npm --version` |
| Docker | any recent version | `docker --version` |

Docker must be **running** (not just installed). On Mac/Windows that means Docker Desktop must be open. On Linux the daemon must be active (`systemctl status docker`).

---

## Option 1 — Run directly on your machine (recommended for local dev)

This is the simplest path. The Node server runs on your host, and Docker runs the gcc containers on demand.

### Step 1 — Pull the gcc image

Do this once. It downloads ~1.2 GB so get it out of the way before you start the server.

```bash
docker pull gcc:latest
```

You should see something like:

```
latest: Pulling from library/gcc
...
Status: Downloaded newer image for gcc:latest
```

### Step 2 — Install backend dependencies

```bash
cd backend
npm install
cd ..
```

This installs Express. Nothing else. The `node_modules` folder will appear inside `backend/`.

### Step 3 — Start the server

From the root of the project (`COMPILEME/`):

```bash
node backend/server.js
```

Expected output:

```
COMPILEME running → http://localhost:3300
Docs             → http://localhost:3300/docs
```

### Step 4 — Open in browser

```
http://localhost:3300        ← compiler UI
http://localhost:3300/docs   ← build documentation
```

Write some C++, hit **Run**, see the output. Done.

### Step 5 — Stop the server

Press `Ctrl + C` in the terminal where the server is running.

---

## Option 2 — Run everything in Docker (Compose)

Use this if you want to containerise the backend too, or if you don't want to install Node locally.

> **Heads up:** The backend container needs to spawn child Docker containers. I do this by mounting the host's Docker socket into the backend container (`/var/run/docker.sock`). The `docker-compose.yml` handles this automatically.

### Step 1 — Pull the gcc image

Same as above — do this first so the first compile request doesn't time out.

```bash
docker pull gcc:latest
```

### Step 2 — Build and start

From the project root:

```bash
docker-compose up --build
```

First time this builds the backend image (a minute or so). Subsequent starts reuse the cache and are near-instant.

### Step 3 — Open in browser

```
http://localhost:3300
```

### Step 4 — Stop

```bash
# in the same terminal
Ctrl + C

# or from another terminal
docker-compose down
```

---

## Changing the port

The server defaults to port `3300`. Override it with the `PORT` environment variable.

**Option 1 (host):**
```bash
PORT=8080 node backend/server.js
```

**Option 2 (Compose):** edit `docker-compose.yml`:
```yaml
ports:
  - "8080:3300"
```
Then `docker-compose up --build` and visit `http://localhost:8080`.

---

## Verifying Docker works for compilation

If you want to confirm Docker execution works independently before starting the server, run this manually:

```bash
echo '#include <iostream>
int main() { std::cout << "ok" << std::endl; }' \
| docker run --rm -i --network=none gcc:latest \
  bash -c 'cat > /tmp/t.cpp && g++ /tmp/t.cpp -o /tmp/t 2>&1 && /tmp/t'
```

Expected output: `ok`

If that works, the compiler will work inside the app.

---

## Common problems

### `Error: Docker not found. Is Docker installed and running?`

Docker is either not installed or the daemon is not running.

- **Mac/Windows:** open Docker Desktop and wait for it to show "running".
- **Linux:** run `sudo systemctl start docker`.

### First run takes 30–60 seconds

The gcc image wasn't pulled ahead of time. Let it finish — subsequent runs are fast (1–3 s).

### Port 3300 already in use

Something else is on port 3300. Either stop that process or run on a different port (see "Changing the port" above).

```bash
# find what's using 3300
lsof -i :3300
```

### `docker-compose` command not found

On newer Docker installs it's `docker compose` (space, not hyphen):

```bash
docker compose up --build
```

### `permission denied` on Docker socket (Linux, Option 2)

Your user isn't in the `docker` group. Either prefix with `sudo` or add your user:

```bash
sudo usermod -aG docker $USER
# then log out and back in
```

---

## What happens when you click Run

1. Browser sends the code to `POST /run` as JSON.
2. Express validates it (non-empty, under 50 KB).
3. Node spawns `docker run --rm -i gcc:latest bash -c '...'` and pipes the code in via stdin.
4. Inside the container: `g++` compiles the code; if that succeeds, `timeout 2 ./main` runs the binary.
5. All output (stdout + stderr) is collected and returned as `{ "output": "..." }`.
6. The container is destroyed. Nothing persists.
7. The browser displays the output.

Time limit: **2 seconds** per run. Memory limit: **256 MB**. No network access from inside the container.

---

## Related docs

- [README.md](README.md) — project overview and quick start
- [AWS_DEPLOY.md](AWS_DEPLOY.md) — how I deployed this on AWS EC2
- [CI_CD.md](CI_CD.md) — domain setup and GitHub auto-deploy
- [ROADMAP.md](ROADMAP.md) — what's planned next
