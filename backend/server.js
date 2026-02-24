const express = require('express');
const { spawn }  = require('child_process');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3300;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Serve docs at /docs
app.use('/docs', express.static(path.join(__dirname, '..', 'docs')));

// ── POST /run ─────────────────────────────────────────────────────────────────
app.post('/run', (req, res) => {
  const { code } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ output: 'Error: No code provided.' });
  }

  if (code.length > 50_000) {
    return res.status(400).json({ output: 'Error: Code exceeds 50 KB size limit.' });
  }

  /*
   * Docker execution strategy
   * ─────────────────────────
   * We pipe the C++ source via stdin → docker run -i → bash -c "cat > /tmp/main.cpp ..."
   * This avoids volume mounts, temp files on the host, and any shell injection risk,
   * because the code never touches a shell argument — only stdin.
   *
   * Limits applied:
   *   --memory=256m        → hard memory cap
   *   --memory-swap=256m   → disables swap (swap = memory limit)
   *   --cpus=1             → one CPU core maximum
   *   --network=none       → no inbound or outbound network
   *   --pids-limit=64      → prevent fork bombs
   *   timeout 2            → kill program after 2 seconds (inside container)
   *   15 s server timer    → hard-kill the Docker process if it hangs
   */
  const dockerArgs = [
    'run', '--rm', '-i',
    '--memory=256m',
    '--memory-swap=256m',
    '--cpus=1',
    '--network=none',
    '--pids-limit=64',
    'gcc:latest',
    'bash', '-c',
    'cat > /tmp/main.cpp && g++ /tmp/main.cpp -o /tmp/main 2>&1 && timeout 2 /tmp/main 2>&1'
  ];

  const proc = spawn('docker', dockerArgs);

  let output    = '';
  let responded = false;

  // Single-response guard — ensures only one res.json() fires
  const respond = (data) => {
    if (!responded) {
      responded = true;
      clearTimeout(killTimer);
      res.json(data);
    }
  };

  proc.stdout.on('data', (chunk) => { output += chunk.toString(); });
  proc.stderr.on('data', (chunk) => { output += chunk.toString(); });

  proc.on('close', (exitCode) => {
    // exit 124 is what `timeout` returns when it kills the process
    if (exitCode === 124) {
      respond({ output: 'Error: Program exceeded the 2-second time limit.' });
    } else {
      respond({ output: output.trim() || '(no output)' });
    }
  });

  proc.on('error', (err) => {
    const msg = err.code === 'ENOENT'
      ? 'Error: Docker not found. Is Docker installed and running?'
      : `Server error: ${err.message}`;
    respond({ output: msg });
  });

  // Pipe source code into the container via stdin
  proc.stdin.write(code);
  proc.stdin.end();

  // Hard server-side timeout — kills the Docker process if Docker itself hangs
  const killTimer = setTimeout(() => {
    proc.kill('SIGKILL');
    respond({ output: 'Error: Execution timed out (15-second server limit).' });
  }, 15_000);
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`COMPILEME running → http://localhost:${PORT}`);
  console.log(`Docs             → http://localhost:${PORT}/docs`);
});
