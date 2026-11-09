# Deploy to Oracle Cloud Free (VM)

This guide deploys the app on a single Oracle Cloud Always Free VM using Docker Compose + Caddy (automatic HTTPS).

## 1) Provision VM and DNS

1. Create an Ubuntu VM (Always Free shape).
2. Assign a static public IP.
3. Create DNS records on Cloudflare, all set to **DNS only**:
  - `minhabanda.com` (A record `@`) -> VM public IP — central login page
  - `www.minhabanda.com` (CNAME -> `minhabanda.com`) — redirects to `minhabanda.com`
  - `*.minhabanda.com` (wildcard A record) -> VM public IP — one subdomain per band
4. Create a Cloudflare API token limited to the `minhabanda.com` zone, with `Zone: Read` and
  `DNS: Edit`.

  Every band is served at `<slug>.minhabanda.com`, with the API under `/api` on the same host.
  Caddy uses the token to get one wildcard certificate for all bands (DNS challenge), so a new
  band needs no DNS or certificate step. Addresses without an active band are sent to
  `minhabanda.com` by the app.

Open inbound ports in OCI and OS firewall:
- TCP 22
- TCP 80
- TCP 443

## 2) Install Docker on VM

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Reconnect SSH after adding your user to docker group.

## 3) Configure production env

In the project root:

```bash
cp .env.prod.example .env
```

Edit `.env` and set all `CHANGE_ME...` values.

Important values:
- `BASE_DOMAIN=minhabanda.com`
- `VITE_GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_ID` must match the same Google OAuth client
- `BASE_DOMAIN` must match the wildcard DNS record
- `CF_API_TOKEN` is the Cloudflare token from step 1; the deploy doesn't copy env files, so it
  must be in both `.env.prod` (local) and `.env` (server)

## 4) Configure Google OAuth

In Google Cloud Console for your OAuth client:
- Add Authorized JavaScript origins:
  - `https://minhabanda.com`

Google login always happens on `https://minhabanda.com/entrar`. After signing in, the backend
issues a single-use code (valid for 60 seconds) for the chosen band and the browser exchanges it
on `https://<slug>.minhabanda.com/auth/callback`, so new bands need no Google configuration.

No redirect URI is required for the Google Identity token flow used here.

## 5) First deploy

From your local machine, run the sync script which builds images locally, uploads them to the server, and starts services:

```bash
bash scripts/sync-from-prod.sh
```

The script does:
1. Builds Docker images locally (`backend`, `frontend`, `caddy`)
2. Exports and compresses them (`docker save | gzip`)
3. Uploads via rsync over SSH
4. Syncs `docker-compose.prod.yml` and `Caddyfile` to the server
5. Loads images and runs `docker compose up -d` on the server

Check status on the server:

```bash
ssh -i $DEPLOY_SSH_KEY $DEPLOY_SSH_HOST
cd ~/contas-app
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f caddy
```

Health check:
- `https://maverick.minhabanda.com/api/health`

To add a band (and its first admin member):

```bash
COMPOSE_FILE=docker-compose.prod.yml ./scripts/create-band.sh <slug> 'Band Name' 'YourName' 'you@example.com'
```

To manage every band without being a member of them, make yourself a super admin:

```bash
COMPOSE_FILE=docker-compose.prod.yml ./scripts/create-super-admin.sh 'YourName' 'you@example.com'
```

Super admins can then create and manage bands, members and other super admins from
`https://<BASE_DOMAIN>/admin` instead of the scripts.

## 6) Update deployment

Just re-run the sync script from your local machine:

```bash
bash scripts/sync-from-prod.sh
```

Note: The server does not have the source code — images are always built locally and uploaded.

## 7) Backup database (optional)

```bash
docker compose exec -T db mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" > backup-$(date +%F).sql
```
