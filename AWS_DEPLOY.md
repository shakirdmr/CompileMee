# AWS Deployment — What We Did & Why

A plain-English walkthrough of every step taken to deploy COMPILEME on AWS EC2.
Written so anyone can follow it without prior cloud experience.

---

## What is AWS EC2, actually?

EC2 stands for "Elastic Compute Cloud". Ignore the fancy name.
It's just a computer (server) that Amazon runs for you in their data center.
You rent it by the hour. It has an IP address, an operating system (Ubuntu), and it runs 24/7.
You talk to it through your terminal using SSH — basically a secure remote terminal connection.

The t2.micro size (1 CPU, 1 GB RAM) is free for 12 months on a new AWS account.

---

## Step 1 — Creating the EC2 Instance

### What is an "instance"?
An instance = one rented server. You configure it before turning it on.

### Choices made and why:

**OS: Ubuntu 22.04**
Ubuntu is a Linux distribution. Linux is what almost all servers on the internet run.
It's free, stable, and has great support. We picked 22.04 because it's the latest Long Term Support (LTS) version — meaning it gets security updates for years.

**Instance type: t2.micro / t3.micro**
This is the size of the computer. t2.micro = 1 CPU core, 1 GB RAM.
It's in the free tier so it costs nothing for the first 12 months.
More than enough for a small compiler app.

**Key pair: compileme-key.pem**
Think of this as a physical key to your server.
AWS gives you a file (`.pem`) that acts as your password — but it's a cryptographic key, not a string you type.
You use it every time you SSH (connect) to the server.
`.pem` format is for Mac/Linux. `.ppk` is for Windows — we're on Mac so we chose `.pem`.
**Never lose this file. AWS never shows it again after download.**

---

## Step 2 — Firewall (Security Group)

### What is a Security Group?
It's a firewall that sits in front of your server.
By default ALL ports are blocked — nothing can reach your server from the internet.
You have to explicitly punch holes (rules) to allow specific traffic in.

### Rules we added:

**SSH — Port 22, Source 0.0.0.0/0**
This was already there by default.
Port 22 is the SSH port. Without this rule open you'd be completely locked out and couldn't connect your terminal to the server at all.
`0.0.0.0/0` means "allow from any IP address" — this lets you connect from home, a coffee shop, anywhere.

**Custom TCP — Port 3300, Source 0.0.0.0/0**
This is the port our Node.js app listens on.
Without this rule, browsers on the internet would get a connection refused error when visiting `http://YOUR_IP:3300`.
`0.0.0.0/0` again means anyone can access it — which is what we want for a public web app.

### Why does the yellow warning appear?
AWS shows a warning saying "0.0.0.0/0 allows all IP addresses to access your instance."
That's fine to ignore for a public-facing web app. It would only matter if this were a private internal service.

---

## Step 3 — SSH Into the Server

### What is SSH?
SSH = Secure Shell. It's a way to open a terminal session on a remote computer.
When you run `ssh -i key.pem ubuntu@IP`, your terminal stops being your Mac's terminal
and starts being the server's terminal. Every command you type runs on the server, not your Mac.

### Why `chmod 400` first?
SSH is paranoid about key file security. If the `.pem` file is readable by anyone other than you,
SSH refuses to use it and throws a "Permissions too open" error.
`chmod 400` sets the file to read-only for you only. This satisfies SSH's security check.

### Why `ubuntu@` ?
`ubuntu` is the default username on Ubuntu EC2 instances. Amazon creates this user automatically.
If you used Amazon Linux instead of Ubuntu, the username would be `ec2-user`.

### The "Are you sure you want to continue connecting?" prompt
First time you connect to any server, SSH asks you to confirm its identity.
Type `yes`. This saves the server's fingerprint to `~/.ssh/known_hosts` on your Mac
so it won't ask again next time.

---

## Step 4 — Installing Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu
newgrp docker
```

**What this does:**
`curl` downloads the official Docker install script from docker.com.
Piping it to `sh` executes it immediately — it installs Docker Engine on Ubuntu.

`usermod -aG docker ubuntu` adds the `ubuntu` user to the `docker` group.
Without this, every `docker` command would need `sudo` in front of it.

`newgrp docker` applies the group change in the current session without needing to log out and back in.

**Why Docker?**
Our app needs Docker to spin up gcc containers for each compile request.
Without Docker installed on this server, `docker run gcc:latest` would fail with "command not found".

---

## Step 5 — Installing Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs
```

**What this does:**
NodeSource is an official third-party repository that provides up-to-date Node.js packages.
Ubuntu's default `apt` repository has an outdated Node version.
The first command adds the NodeSource repo. The second installs Node.js 20 from it.

**Why Node.js?**
Our backend (`server.js`) is a Node.js app. Without Node installed, you can't run it.

---

## Step 6 — Installing PM2

```bash
sudo npm install -g pm2
```

**What is PM2?**
PM2 is a process manager for Node.js apps.
If you just run `node server.js`, the app dies the moment you close your terminal or the server reboots.
PM2 keeps it running forever in the background, restarts it if it crashes, and can start it automatically on boot.

`-g` means install globally so `pm2` is available as a command anywhere on the server.

---

## Step 7 — Uploading the Code

```bash
scp -i ~/Downloads/compileme-key.pem -r /Users/alif/Desktop/TuringLabs/COMPILEME ubuntu@16.16.207.215:/home/ubuntu/compileme
```

**What is SCP?**
SCP = Secure Copy Protocol. It copies files over SSH.
`-i` specifies the key file (same one we use for SSH).
`-r` means recursive — copies the entire folder including all subfolders.
The last two arguments are `source` (your Mac) and `destination` (the server).

**Does .gitignore affect SCP? (Common doubt)**
No. `.gitignore` is only for Git. SCP copies everything it sees regardless.
If `node_modules` existed locally it would be copied too — but that's fine,
`npm install` on the server just reinstalls/verifies everything anyway.

---

## Step 8 — Pulling the gcc Docker Image

```bash
docker pull gcc:latest
```

**What does this do?**
Downloads the official `gcc` image from Docker Hub to your server.
It's about 1.2 GB. Takes 1–2 minutes on first run.
After this, every compile request spins up a container from this image instantly.

**Why pull it manually first?**
If you don't, the first time a user clicks Run, the server has to download 1.2 GB before compiling.
That would take 60+ seconds. Pulling in advance means the first run is fast.

---

## Step 9 — Starting the App with PM2

```bash
pm2 start backend/server.js --name compileme
pm2 save
pm2 startup
```

**`pm2 start`** — launches `server.js` as a background process managed by PM2. Gives it the name "compileme" so you can reference it easily.

**`pm2 save`** — saves the current list of PM2 processes to disk. Without this, PM2 forgets what to restart after a reboot.

**`pm2 startup`** — generates a system command that registers PM2 as a startup service. It prints a long `sudo env PATH=...` command that you must copy and run manually. This is what makes your app survive server reboots.

---

## Common Doubts We Had

### "Should the gcc container show up in Docker Desktop?"
No. The containers are created and destroyed per request (because of `--rm` flag).
They flash into existence for ~1–3 seconds then self-delete.
What you will see permanently is the `gcc:latest` entry under Docker Desktop's **Images** tab.

### "The scp upload seemed slow — is there a problem without .gitignore?"
No problem. SCP copied `node_modules` if it existed locally, which made it larger.
It doesn't matter — `npm install` on the server overwrites it anyway.
The actual source code files (server.js, index.html, etc.) are only a few KB.

### "Where do I run these commands — in the project root or backend folder?"
Always from `~/compileme` (the project root) unless told otherwise.
`pm2 start backend/server.js` — run from `~/compileme`, the path `backend/server.js` is relative to where you are.
`npm install --prefix backend` — also from project root, `--prefix` tells npm which subfolder to install into.

### "What is that long sudo command pm2 startup prints?"
It looks like:
```
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
```
This command tells Ubuntu's systemd (the service manager) to start PM2 when the server boots.
Without running it, if AWS restarts your instance (maintenance, reboot), your app goes offline and stays offline.
You must copy-paste and run it manually — PM2 can't run it for you because it needs root privileges (`sudo`).

---

## Useful Commands for Later

```bash
# Check if your app is running
pm2 status

# See live logs from your app
pm2 logs compileme

# Restart the app (e.g. after updating code)
pm2 restart compileme

# Stop the app
pm2 stop compileme

# SSH back into the server any time
ssh -i ~/Downloads/compileme-key.pem ubuntu@16.16.207.215
```

---

## Your App is Live At

```
http://16.16.207.215:3300
```

---

## To Stop AWS Billing After Free Tier Ends

Go to AWS Console → EC2 → select your instance → **Instance State → Stop**.
Stopped instances don't count toward compute hours.
Your data and setup are preserved — just start it again when needed.
If you want to delete everything permanently, choose **Terminate** instead.
