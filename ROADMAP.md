# ROADMAP

Things to improve or set up next. Currently the app is live at a raw IP with no domain, no HTTPS, and no automated deploys.

---

## Pending

### 1 — GitHub CI/CD
Right now every code change has to be manually uploaded to the server via `scp` and restarted with `pm2 restart`. We need a GitHub Actions workflow that auto-deploys on every `git push` to `main`.

See full setup guide: [CI_CD.md](CI_CD.md)

- [ ] Push code to GitHub
- [ ] Create `~/deploy.sh` on server
- [ ] Add `.github/workflows/deploy.yml`
- [ ] Store SSH private key as GitHub Secret

---

### 2 — Nginx (remove the :3300 from the URL)
The app is currently only reachable at `http://16.16.207.215:3300`. Nginx as a reverse proxy would forward standard port 80 traffic to port 3300 internally, so users just go to the domain with no port number.

- [ ] Install Nginx on the EC2 instance
- [ ] Create a site config proxying port 80 → 3300
- [ ] Reload Nginx

---

### 3 — SSL / HTTPS
The site currently runs on plain HTTP. Browsers show "Not Secure" and some features (like clipboard API) are blocked without HTTPS. Certbot (Let's Encrypt) gives a free auto-renewing certificate.

Requires Nginx to be set up first (see above).

- [ ] Buy or point a domain to the EC2 IP
- [ ] Install Certbot
- [ ] Run `sudo certbot --nginx -d yourdomain.com`
- [ ] Verify HTTPS works and HTTP redirects to HTTPS

---

## Done

- [x] Core compiler — HTML/JS frontend + Node.js/Express backend
- [x] Docker sandboxing — fresh `gcc:latest` container per run, all limits applied
- [x] Deployed live on AWS EC2 (t3.micro, Ubuntu 22.04)
- [x] PM2 — app survives reboots
- [x] Docs at `/docs` — 9-chapter build walkthrough
- [x] README, SETUP.md, AWS_DEPLOY.md, CI_CD.md
