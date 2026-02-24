# ROADMAP

Things I still want to set up or improve. Right now the app is live at a raw IP — no domain, no HTTPS, no automated deploys yet.

Related docs: [AWS_DEPLOY.md](AWS_DEPLOY.md) · [CI_CD.md](CI_CD.md) · [SETUP.md](SETUP.md)

---

## Pending

### 1 — GitHub CI/CD
Right now every code change has to be manually uploaded to the server via `scp` and restarted with `pm2 restart`. I want a GitHub Actions workflow that auto-deploys on every `git push` to `main` so I never have to touch the server manually.

See full setup guide: [CI_CD.md](CI_CD.md)

- [ ] Push code to GitHub
- [ ] Create `~/deploy.sh` on server
- [ ] Add `.github/workflows/deploy.yml`
- [ ] Store SSH private key as GitHub Secret

---

### 2 — Nginx (remove the :3300 from the URL)
Right now anyone reaching the app has to type `http://16.16.207.215:3300` — including the port. I want to install Nginx as a reverse proxy to forward standard port 80 traffic to port 3300 internally, so the URL is just the domain.

- [ ] Install Nginx on the EC2 instance
- [ ] Create a site config proxying port 80 → 3300
- [ ] Reload Nginx

---

### 3 — SSL / HTTPS
The site runs on plain HTTP right now. Browsers show "Not Secure" and some features (like clipboard API) won't work without HTTPS. I'll use Certbot (Let's Encrypt) — it's free and auto-renewing.

Requires Nginx to be set up first (see above). Full steps in [CI_CD.md](CI_CD.md).

- [ ] Buy or point a domain to the EC2 IP
- [ ] Install Certbot
- [ ] Run `sudo certbot --nginx -d yourdomain.com`
- [ ] Verify HTTPS works and HTTP redirects to HTTPS

---

## Done

- [x] Core compiler — HTML/JS frontend + Node.js/Express backend
- [x] Docker sandboxing — fresh `gcc:latest` container per run, all limits applied
- [x] Deployed live on AWS EC2 (t3.micro, Ubuntu 22.04) — see [AWS_DEPLOY.md](AWS_DEPLOY.md)
- [x] PM2 — app survives reboots automatically
- [x] Docs at `/docs` — 9-chapter build walkthrough
- [x] [README.md](README.md), [SETUP.md](SETUP.md), [AWS_DEPLOY.md](AWS_DEPLOY.md), [CI_CD.md](CI_CD.md)
