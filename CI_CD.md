# Domain + CI/CD — What I Did & How To Set It Up

My plain-English guide to connecting a domain name to the server
and making GitHub auto-deploy code every time I push.

This picks up where [AWS_DEPLOY.md](AWS_DEPLOY.md) left off — the server is already running.
For local setup, see [SETUP.md](SETUP.md). For what's still pending, see [ROADMAP.md](ROADMAP.md).

---

## Part 1 — Connecting a Domain Name

### What is a domain name, actually?
Right now the app lives at `http://16.16.207.215:3300`.
That IP address is hard to remember and looks unprofessional.
A domain name (like `compileme.dev`) is just a human-readable label that points to that IP.
When someone types `compileme.dev` in a browser, the internet looks up which IP it maps to, then connects there.
This lookup system is called **DNS** (Domain Name System) — basically a giant phone book for the internet.

### Step 1 — Buy a domain
Go to any registrar. Cheapest options:
- **Namecheap** — ~$10/yr for `.com`, ~$3/yr for `.xyz`
- **Cloudflare Registrar** — at-cost pricing, best deal for serious projects
- **GoDaddy** — more expensive but very beginner friendly

### Step 2 — Add a DNS A Record
An **A Record** is a DNS rule that says "this domain name = this IP address".

Go to your domain registrar's DNS settings and add:

| Type | Host | Value              | TTL  |
|------|------|--------------------|------|
| A    | @    | `16.16.207.215`    | Auto |
| A    | www  | `16.16.207.215`    | Auto |

- `@` means the root domain (`compileme.dev`)
- `www` means `www.compileme.dev`
- Both pointing to the same IP means either works

**Wait 5–30 minutes** for DNS to propagate (spread across the internet).
Test it with: `ping compileme.dev` — if it shows your IP, it's working.

At this point `http://compileme.dev:3300` works.
But users shouldn't have to type `:3300`. That's what Nginx fixes.

---

### Step 3 — Install Nginx (removes the :3300)

**What is Nginx?**
Nginx is a web server that sits in front of your Node app.
Users hit port 80 (standard HTTP) → Nginx receives it → forwards it internally to port 3300 → Node responds.
Users never see the port number. This forwarding is called a **reverse proxy**.

```bash
sudo apt install -y nginx
```

Create the config file for your site:
```bash
sudo nano /etc/nginx/sites-available/compileme
```

Paste this inside (replace `compileme.dev` with your actual domain):
```nginx
server {
    listen 80;
    server_name compileme.dev www.compileme.dev;

    location / {
        proxy_pass http://localhost:3300;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Save and exit (`Ctrl+O`, Enter, `Ctrl+X`), then activate it:
```bash
sudo ln -s /etc/nginx/sites-available/compileme /etc/nginx/sites-enabled/
sudo nginx -t          # test config — should say "syntax is ok"
sudo systemctl reload nginx
```

Now `http://compileme.dev` works — no port needed.

---

### Step 4 — Free HTTPS with Certbot

**Why HTTPS?**
Without it, browsers show "Not Secure" warnings. Also required if you ever add any sensitive features.
Certbot gets you a free SSL certificate from Let's Encrypt, automatically.

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d compileme.dev -d www.compileme.dev
```

Follow the prompts — enter your email, agree to terms.
Certbot edits your Nginx config automatically and sets up auto-renewal.

Now `https://compileme.dev` works. Certificate renews itself every 90 days for free.

---

## Part 2 — GitHub CI/CD

### What is CI/CD, actually?
**CI** = Continuous Integration — automatically test/build your code when you push to GitHub.
**CD** = Continuous Deployment — automatically deploy your code to the server after that.

Without CI/CD:
- Edit code on Mac → manually `scp` files to server → manually SSH in → manually restart PM2
- Every single time I make a change.

With CI/CD:
- Edit code on Mac → `git push` → GitHub automatically SSHs into the server and restarts the app
- I never touch the server again after initial setup.

---

### How it works (the flow)

```
You push code to GitHub
        ↓
GitHub Actions detects the push
        ↓
GitHub's servers SSH into your EC2 instance
        ↓
Run ~/deploy.sh on your server
        ↓
deploy.sh does: git pull + pm2 restart
        ↓
Your live site is updated
```

---

### Step 1 — Put your code on GitHub

On your Mac:
```bash
cd /Users/alif/Desktop/TuringLabs/COMPILEME

# Initialize git repo
git init

# Create a .gitignore so node_modules doesn't get uploaded to GitHub
echo "node_modules/" > .gitignore
echo ".env" >> .gitignore

# Stage and commit everything
git add .
git commit -m "initial commit"
```

Create a new **empty** repo on github.com (don't add README or .gitignore there — I already have them).
Then connect and push:
```bash
git remote add origin https://github.com/YOURUSER/compileme.git
git branch -M main
git push -u origin main
```

The code is now on GitHub.

---

### Step 2 — Set up the server to pull from GitHub

SSH into your server:
```bash
ssh -i ~/Downloads/compileme-key.pem ubuntu@16.16.207.215
```

Delete the old folder that was uploaded via scp, and clone from GitHub instead:
```bash
rm -rf ~/compileme
git clone https://github.com/YOURUSER/compileme.git ~/compileme
cd ~/compileme/backend && npm install
pm2 restart compileme
```

Now the server's code comes from GitHub, not from scp uploads.

---

### Step 3 — Create a deploy script on the server

This is the script GitHub Actions will run every time I push:
```bash
nano ~/deploy.sh
```

Paste:
```bash
#!/bin/bash
set -e                          # stop if any command fails

cd ~/compileme
git pull origin main            # download latest code from GitHub
npm install --prefix backend    # install any new dependencies
pm2 restart compileme           # restart the Node app
echo "Deploy done."
```

Make it executable:
```bash
chmod +x ~/deploy.sh
```

Test it manually:
```bash
~/deploy.sh
```
Should print "Deploy done." without errors.

---

### Step 4 — Create the GitHub Actions workflow file

Back on your Mac, create this file:
```bash
mkdir -p /Users/alif/Desktop/TuringLabs/COMPILEME/.github/workflows
```

Create `/Users/alif/Desktop/TuringLabs/COMPILEME/.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS

on:
  push:
    branches:
      - main        # runs every time you push to the main branch

jobs:
  deploy:
    runs-on: ubuntu-latest    # GitHub spins up a temporary Linux machine to run this

    steps:
      - name: SSH into server and deploy
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: 16.16.207.215              # your server IP
          username: ubuntu                 # server username
          key: ${{ secrets.SSH_PRIVATE_KEY }}   # your .pem key (stored in GitHub Secrets)
          script: ~/deploy.sh              # the script we created on the server
```

**What does this file do?**
It tells GitHub: "Whenever code is pushed to `main`, SSH into my server and run `~/deploy.sh`."
`appleboy/ssh-action` is a pre-built GitHub Action (like a plugin) that handles the SSH connection.

---

### Step 5 — Add your SSH key to GitHub Secrets

GitHub needs my private key to SSH into the server. I store it as a **Secret** (encrypted, never visible).

**Get the contents of your key file** (on your Mac):
```bash
cat ~/Downloads/compileme-key.pem
```
Copy the entire output — from `-----BEGIN RSA PRIVATE KEY-----` to `-----END RSA PRIVATE KEY-----`.

**Add it to GitHub:**
1. Go to your GitHub repo
2. Click **Settings** (top tab)
3. Left sidebar → **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Name: `SSH_PRIVATE_KEY`
6. Value: paste the entire key content
7. Click **Add secret**

---

### Step 6 — Push and watch it deploy

Commit the workflow file and push:
```bash
cd /Users/alif/Desktop/TuringLabs/COMPILEME
git add .github/
git commit -m "add CI/CD workflow"
git push
```

Go to your GitHub repo → click the **Actions** tab.
You'll see a workflow run appear. Click it to watch the live logs.
If everything is green, your server just auto-deployed.

From now on, every `git push` to `main` auto-deploys in ~15 seconds.

---

## Common Questions

### "What if the deploy fails?"
GitHub Actions will show a red X and send an email.
Click the failed run to see which step errored and the full log output.
The live site is unaffected — the old version keeps running until a successful deploy.

### "What if I want to deploy from a branch other than main?"
Change `branches: [main]` in the workflow to whichever branch you want.
My pattern: `develop` branch for testing, `main` for production.

### "Do I need to SSH into the server anymore?"
Almost never. The only reasons I'd SSH in:
- Something broke badly and needs manual fixing
- Checking logs with `pm2 logs compileme`
- One-time setup tasks

### "What is a GitHub Secret and why can't I just put the key in the file?"
Never put private keys or passwords directly in code files — those files are public on GitHub.
GitHub Secrets are encrypted and only injected at runtime when the workflow runs.
They never appear in logs or anywhere visible.

---

## Full Flow Summary

```
Local Mac                GitHub                  AWS EC2 Server
─────────────────────────────────────────────────────────────
git push origin main
        │
        ▼
    GitHub receives push
    triggers Actions workflow
        │
        ▼
    GitHub SSHs into server
    using SSH_PRIVATE_KEY
        │
        ▼
                            runs ~/deploy.sh:
                            - git pull origin main
                            - npm install
                            - pm2 restart compileme
                                    │
                                    ▼
                            Site is updated live
                            https://compileme.dev ✓
```
