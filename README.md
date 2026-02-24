# COMPILEME — Online C++ Compiler

A minimal online C++ compiler. Write code in the browser, hit Run — it compiles and executes inside a fresh Docker container every time. The host machine never touches user code.

**Live demo:** http://16.16.207.215:3300

---

## Stack

| Layer     | Tech                         |
|-----------|------------------------------|
| Frontend  | HTML + vanilla JS            |
| Backend   | Node.js + Express            |
| Execution | Docker (`gcc:latest`)        |

---

## Prerequisites

Before running locally, make sure you have both of these installed:

- **Node.js 18+** — the runtime that executes the backend server. Download at https://nodejs.org. Check you have it: `node --version`
- **Docker Desktop** (Mac/Windows) or **Docker Engine** (Linux) — needed to spin up the gcc containers that compile and run code. Check you have it: `docker --version`. On Mac/Windows, Docker Desktop must be **open and running** (whale icon in menu bar) before starting the server.

---

## Run Locally — Option A (direct, simplest)

### Step 1 — Pull the gcc image

```bash
docker pull gcc:latest
```

This downloads the official GCC compiler image from Docker Hub — about 1.2 GB. Only needed once. Every time a user clicks Run, a container is created from this image. If you skip this step, the first compile request will download it on-demand and take 60+ seconds.

### Step 2 — Go into the backend folder and install dependencies

```bash
cd backend
npm install
```

`npm install` reads `package.json` and downloads Express (the only dependency) into a `node_modules` folder. This is what lets `server.js` use `require('express')`. Without this step the server crashes immediately on start.

### Step 3 — Go back to the project root and start the server

```bash
cd ..
node backend/server.js
```

This starts the Express server. You must be in the project root (`COMPILEME/`) when you run this because the server uses relative paths to find the `frontend/` and `docs/` folders. You should see:

```
COMPILEME running → http://localhost:3300
Docs             → http://localhost:3300/docs
```

The server is now listening for requests. Leave this terminal open — closing it kills the server.

### Step 4 — Open in browser

```
http://localhost:3300        ← compiler UI
http://localhost:3300/docs   ← build documentation
```

Write some C++, click **Run**, see the output. The first run may take 2–3 seconds as Docker starts the container. Subsequent runs are faster.

### Step 5 — Stop the server

Press `Ctrl + C` in the terminal where the server is running. This cleanly shuts it down.

---

## Run Locally — Option B (Docker Compose)

Use this if you want to run the backend inside Docker too (no Node.js required on your machine).

### Step 1 — Pull the gcc image first

```bash
docker pull gcc:latest
```

Same reason as above — avoids the first-request timeout.

### Step 2 — Build and start

```bash
docker-compose up --build
```

This builds a Docker image for the Node.js backend (using the `Dockerfile`), then starts it. The `docker-compose.yml` mounts `/var/run/docker.sock` into the container — this is what lets the backend container call `docker run` and spawn the gcc containers on your host machine.

First run takes a minute to build. Subsequent runs reuse the cached image and start in seconds.

### Step 3 — Open in browser

```
http://localhost:3300
```

### Step 4 — Stop

```bash
Ctrl + C

# or from another terminal:
docker-compose down
```

---

## Changing the Port

The server defaults to `3300`. Override with the `PORT` environment variable:

```bash
PORT=8080 node backend/server.js
# now runs at http://localhost:8080
```

For Docker Compose, edit `docker-compose.yml`:
```yaml
ports:
  - "8080:3300"   # host:container
```

---

## API

### `POST /run`

**Request**
```json
{ "code": "#include <iostream>\nint main() { std::cout << \"hi\"; }" }
```

**Response**
```json
{ "output": "hi" }
```

Compile errors, runtime errors, and timeout messages all come back in the `output` field. The HTTP status is always 200 unless the request itself is malformed (400).

---

## Execution Sandbox

Each run gets a brand-new `gcc:latest` container, isolated from everything:

| Limit        | Value                         | What it blocks                    |
|--------------|-------------------------------|-----------------------------------|
| Time         | 2 s (inside container)        | Infinite loops, sleep abuse       |
| Memory       | 256 MB (swap disabled)        | Memory exhaustion attacks         |
| CPU          | 1 core                        | CPU hogging / spinning            |
| Network      | None (`--network=none`)       | Any inbound or outbound traffic   |
| PIDs         | 64 (`--pids-limit=64`)        | Fork bombs                        |
| Server abort | 15 s                          | Hung Docker process               |

The container is auto-deleted after each run (`--rm`). No state persists between runs.

---

## Folder Structure

```
COMPILEME/
├── backend/
│   ├── server.js          Express API + Docker integration
│   └── package.json       Dependencies (just Express)
├── frontend/
│   └── index.html         Code editor UI (plain HTML + JS)
├── docs/
│   └── index.html         Build docs — served at /docs
├── Dockerfile             Containerises the Node backend
├── docker-compose.yml     Runs backend + mounts Docker socket
├── SETUP.md               Local setup guide
├── AWS_DEPLOY.md          AWS EC2 deployment walkthrough
├── CI_CD.md               Domain + GitHub CI/CD guide
└── README.md              This file
```

---

## Documentation

| File | What's in it |
|------|-------------|
| [SETUP.md](SETUP.md) | Detailed local run guide with troubleshooting |
| [AWS_DEPLOY.md](AWS_DEPLOY.md) | Full AWS EC2 deploy walkthrough, plain English |
| [CI_CD.md](CI_CD.md) | Domain mapping + GitHub Actions auto-deploy |
| `/docs` route | In-app build docs at `http://localhost:3300/docs` |

---

## Live Deployment

Currently running on AWS EC2 (t3.micro, Ubuntu 22.04):

```
http://16.16.207.215:3300
```
