# COMPILEME — Online C++ Compiler

A minimal online C++ compiler. Every run executes inside a fresh Docker container — the host machine never touches user code.

## Stack

| Layer     | Tech                         |
|-----------|------------------------------|
| Frontend  | HTML + vanilla JS            |
| Backend   | Node.js + Express            |
| Execution | Docker (`gcc:latest`)        |

---

## Prerequisites

- **Node.js** 18+ → https://nodejs.org
- **Docker** (Desktop on Mac/Windows, Engine on Linux)

---

## Run Locally (Option A — host)

```bash
# 1. Pull the gcc image once (≈1.2 GB — only needed the first time)
docker pull gcc:latest

# 2. Install backend dependencies
cd backend
npm install
cd ..

# 3. Start the server
node backend/server.js

# 4. Open in browser
open http://localhost:3300
```

---

## Run Locally (Option B — Docker Compose)

```bash
docker-compose up --build
open http://localhost:3300
```

> The Compose file mounts `/var/run/docker.sock` so the backend container can
> spawn child gcc containers on the host daemon.

---

## API

### `POST /run`

**Request**
```json
{ "code": "#include <iostream>\nint main(){}" }
```

**Response**
```json
{ "output": "Hello, World!\n" }
```

Compile errors and runtime errors are included in `output`.

---

## Execution Sandbox

Each run gets a fresh `gcc:latest` container with these limits:

| Limit        | Value                         |
|--------------|-------------------------------|
| Time         | 2 s (inside container)        |
| Memory       | 256 MB (swap disabled)        |
| CPU          | 1 core                        |
| Network      | None (`--network=none`)       |
| PIDs         | 64 (`--pids-limit=64`)        |
| Server abort | 15 s (kills hung Docker proc) |

The container is destroyed automatically (`--rm`) after each run.

---

## Folder Structure

```
COMPILEME/
├── backend/
│   ├── server.js          Express API + Docker integration
│   └── package.json
├── frontend/
│   └── index.html         Code editor UI
├── docs/
│   └── index.html         Build docs (served at /docs)
├── Dockerfile             Containerises the backend
├── docker-compose.yml
└── README.md
```

---

## Docs

Served at **http://localhost:3300/docs** — seven chapters covering the build in chronological order.
