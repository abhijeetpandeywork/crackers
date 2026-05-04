# AWS Deployment Guide — Rathinam Crackers Platform

Step-by-step runbook to host the platform on AWS. Two recommended topologies:

- **Path A — Single EC2 + RDS** (simplest, best price for one shop, ~₹3–6 k/month)
- **Path B — ECS Fargate + RDS + ALB + CloudFront** (scalable, multi-AZ, ~₹10–20 k/month)

Both paths host the **same artifacts** behind **one HTTPS host**, with path-based routing.

> If you've already deployed on Replit and are migrating, the only things that change are: secrets storage, the reverse proxy, and the Postgres host. The application code is identical.

---

## 0. One-time AWS account setup

1. Create an AWS account (or use existing). Set MFA on the root user.
2. Create an IAM user `rathinam-deployer` with programmatic access; attach `AdministratorAccess` for setup, downscope later.
3. Install AWS CLI locally and `aws configure` with that user's keys.
4. Pick a region — recommended **`ap-south-1` (Mumbai)** for India latency and GST data residency.
5. Buy / transfer your domain in Route 53 (or point your existing registrar's nameservers there).

---

## Path A — Single EC2 + RDS (recommended for go-live)

### A.1 Provision RDS PostgreSQL

```
Engine:          PostgreSQL 16
Instance class:  db.t4g.small  (2 vCPU, 2 GB) — fine for the first 1k orders/day
Storage:         50 GB gp3, autoscaling to 200 GB
Multi-AZ:        No (Yes if you want zero-downtime patching)
Backup:          7-day automated, 02:00 UTC
Public access:   No
VPC:             default, in same AZ as the EC2
Security group:  rds-sg — inbound 5432 from ec2-sg only
```

Save the master username + password into AWS Secrets Manager as `rathinam/db`.

### A.2 Provision EC2

```
AMI:             Amazon Linux 2023 (or Ubuntu 22.04)
Instance type:   t4g.small (or t4g.medium for headroom)
Storage:         30 GB gp3
Security group:  ec2-sg — inbound 22 (your IP only), 80, 443 (anywhere)
Elastic IP:      Allocate + attach
IAM role:        ec2-rathinam-role with AmazonSSMManagedInstanceCore + read on Secrets Manager
```

### A.3 Bootstrap the EC2

SSH in (or use SSM Session Manager) and run:

```bash
# system deps
sudo dnf install -y git nginx

# node 20 + pnpm
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
sudo npm i -g pnpm@9 pm2

# clone repo (use a deploy key or PAT for private repos)
sudo mkdir -p /opt/rathinam && sudo chown ec2-user:ec2-user /opt/rathinam
cd /opt/rathinam
git clone https://github.com/<your-username>/<your-repo>.git .

# install + build
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-spec run codegen
pnpm -r run build
```

### A.4 Environment variables

Create `/opt/rathinam/.env`:

```bash
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASS@<rds-endpoint>:5432/rathinam
SESSION_SECRET=<openssl rand -hex 32>
JWT_SECRET=<openssl rand -hex 32>      # set explicitly so tokens survive restarts
PORT_API=8080
PORT_ERP=5173
PORT_POS=5174
PORT_WH=5175
PORT_WEB=5176
```

Pull secrets from AWS Secrets Manager at boot (recommended) — see snippet at the bottom.

### A.5 First-time DB migrate + seed

```bash
cd /opt/rathinam
pnpm --filter @workspace/db run migrate
pnpm --filter @workspace/scripts run seed   # creates default users + sample data
```

### A.6 Run with PM2

```bash
cd /opt/rathinam
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u ec2-user --hp /home/ec2-user
```

Create `/opt/rathinam/ecosystem.config.cjs`:

```js
module.exports = {
  apps: [
    { name: "api",      cwd: "./artifacts/api-server", script: "node",  args: "dist/index.js",                     env: { PORT: 8080 } },
    { name: "erp",      cwd: "./artifacts/erp",        script: "pnpm",  args: "exec vite preview --host --port 5173 --strictPort", env: { NODE_ENV: "production" } },
    { name: "pos",      cwd: "./artifacts/pos",        script: "pnpm",  args: "exec vite preview --host --port 5174 --strictPort --base /pos/", env: { NODE_ENV: "production" } },
    { name: "warehouse",cwd: "./artifacts/warehouse",  script: "pnpm",  args: "exec vite preview --host --port 5175 --strictPort --base /warehouse/", env: { NODE_ENV: "production" } },
    { name: "website",  cwd: "./artifacts/website",    script: "pnpm",  args: "exec vite preview --host --port 5176 --strictPort --base /website/", env: { NODE_ENV: "production" } },
  ],
};
```

For real production, build static assets once (`pnpm -r run build`) and serve them through nginx directly instead of `vite preview` — see A.8.

### A.7 nginx as reverse proxy

`/etc/nginx/conf.d/rathinam.conf`:

```nginx
upstream api  { server 127.0.0.1:8080; }
upstream erp  { server 127.0.0.1:5173; }
upstream pos  { server 127.0.0.1:5174; }
upstream wh   { server 127.0.0.1:5175; }
upstream web  { server 127.0.0.1:5176; }

server {
  listen 80;
  server_name your-domain.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name your-domain.com;

  ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

  client_max_body_size 25m;
  proxy_http_version 1.1;
  proxy_set_header Host              $host;
  proxy_set_header X-Real-IP         $remote_addr;
  proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;

  # most-specific paths first
  location /api/        { proxy_pass http://api; }
  location /pos/        { proxy_pass http://pos; }
  location /warehouse/  { proxy_pass http://wh; }
  location /website/    { proxy_pass http://web; }
  location /            { proxy_pass http://erp; }   # ERP at root
}
```

Get a free TLS cert with certbot:

```bash
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com --redirect -m you@your-domain.com --agree-tos
```

certbot installs a cron job that auto-renews.

### A.8 (Recommended for prod) Serve built static assets

After `pnpm -r run build`, each Vite app has a `dist/` directory. Serve them directly from nginx for max performance:

```nginx
location /pos/ {
  alias /opt/rathinam/artifacts/pos/dist/;
  try_files $uri /pos/index.html;
}
location /warehouse/ {
  alias /opt/rathinam/artifacts/warehouse/dist/;
  try_files $uri /warehouse/index.html;
}
location /website/ {
  alias /opt/rathinam/artifacts/website/dist/;
  try_files $uri /website/index.html;
}
location / {
  root /opt/rathinam/artifacts/erp/dist/;
  try_files $uri /index.html;
}
location /api/ {
  proxy_pass http://api;   # only the API needs Node at runtime
}
```

This drops PM2 down to a single process (the API server).

### A.9 Domain + DNS

In Route 53, create an A record `your-domain.com → <Elastic IP>`. Wait for propagation, then visit `https://your-domain.com` — the ERP loads.

### A.10 Backups

- **DB**: rely on the 7-day automated RDS backups; additionally, run a daily `pg_dump` to S3 with lifecycle policy (Glacier after 30 d):
  ```bash
  pg_dump $DATABASE_URL | gzip | aws s3 cp - s3://rathinam-backups/db/$(date +%F).sql.gz
  ```
- **Code**: commit everything to GitHub; redeploys are `git pull && pnpm install && pnpm -r run build && pm2 reload all`.

### A.11 Smoke test

Run the same checks as `PRODUCTION.md` § 3 against the live HTTPS domain.

---

## Path B — ECS Fargate + RDS + ALB + CloudFront

For larger scale or stricter SLAs.

1. **Build & push images** to ECR — one image per artifact (or a single multi-stage image).
2. **ECS Cluster** (Fargate); one Service per artifact, behind an **ALB** with path-based listener rules (`/api/*` → api task, `/pos/*` → pos task, etc.).
3. **RDS PostgreSQL** as in Path A but Multi-AZ.
4. **Secrets Manager** mounted into tasks via `secrets:` in the task definition.
5. **CloudFront** in front of the ALB with the ACM cert + Route 53 alias.
6. **CodePipeline / GitHub Actions** for CI: on push to `main`, build images → push → `aws ecs update-service --force-new-deployment`.

A starter `Dockerfile` for the API server:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY artifacts/api-server/package.json artifacts/api-server/
COPY lib/ lib/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @workspace/api-spec run codegen \
 && pnpm --filter @workspace/api-server run build

FROM node:20-alpine AS run
WORKDIR /app
COPY --from=build /app /app
EXPOSE 8080
CMD ["node", "artifacts/api-server/dist/index.js"]
```

Build & push:

```bash
aws ecr create-repository --repository-name rathinam-api
docker build -t rathinam-api -f Dockerfile .
docker tag rathinam-api:latest <acct>.dkr.ecr.ap-south-1.amazonaws.com/rathinam-api:latest
aws ecr get-login-password | docker login --username AWS --password-stdin <acct>.dkr.ecr.ap-south-1.amazonaws.com
docker push <acct>.dkr.ecr.ap-south-1.amazonaws.com/rathinam-api:latest
```

Repeat per artifact, or build a single image and switch entrypoints.

---

## Pulling secrets from Secrets Manager

Bootstrap `.env` from Secrets Manager on every boot:

```bash
# /etc/systemd/system/rathinam-env.service
[Unit]
Description=Pull rathinam secrets into /opt/rathinam/.env
Before=pm2-ec2-user.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/pull-secrets.sh

[Install]
WantedBy=multi-user.target
```

```bash
# /usr/local/bin/pull-secrets.sh
#!/bin/bash
set -euo pipefail
aws secretsmanager get-secret-value --secret-id rathinam/app \
  --query SecretString --output text > /opt/rathinam/.env
chown ec2-user:ec2-user /opt/rathinam/.env
chmod 600 /opt/rathinam/.env
```

Store the JSON-as-key=value file in Secrets Manager once; rotate when needed.

---

## Cost guardrails

- Set a **billing alarm** at ₹3 k / ₹10 k.
- Stop the EC2 outside business hours during the first month if traffic is low.
- Use `t4g` (ARM Graviton) instance types — ~20% cheaper than x86 for the same perf.
- Enable RDS storage autoscaling, but cap at 200 GB.

---

## Observability

- **CloudWatch Logs**: ship PM2 logs (`pm2 install pm2-logrotate` + `pm2 logs --json | aws logs put-log-events ...`) or use the CloudWatch agent.
- **Health endpoint**: `GET /api/healthz` returns 200 — wire it into ALB / Route 53 health checks.
- **In-app verifier**: bookmark `/verifier` and run it daily (or from a Lambda + EventBridge schedule that hits the live URL and posts a Slack message on red).

---

## Rollback

Tag every release in git (`git tag v2026.05.04 && git push --tags`). To roll back:

```bash
cd /opt/rathinam
git fetch --tags
git checkout v2026.05.03
pnpm install --frozen-lockfile
pnpm -r run build
pm2 reload all
```

For a DB rollback, restore from the latest RDS snapshot (or the daily `pg_dump` from S3) into a fresh RDS instance and swap the `DATABASE_URL`.

---

You're ready. After your first successful deploy, walk through `PRODUCTION.md` § 2 (rotate passwords, real company info, master data, opening stock, CMS pages) and then through § 3 (smoke test). Once green, flip DNS / publish.
