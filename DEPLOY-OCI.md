# Deploy to Oracle Cloud Free (VM)

This guide deploys the app on a single Oracle Cloud Always Free VM using Docker Compose + Caddy (automatic HTTPS).

## 1) Provision VM and DNS

1. Create an Ubuntu VM (Always Free shape).
2. Assign a static public IP.
3. Create DNS records:
  - `app.yourdomain.com` -> VM public IP
  - `api.yourdomain.com` -> VM public IP

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
- `VITE_API_URL=https://api.yourdomain.com`
- `VITE_GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_ID` must match the same Google OAuth client
- `APP_DOMAIN` and `API_DOMAIN` must match DNS

## 4) Configure Google OAuth

In Google Cloud Console for your OAuth client:
- Add Authorized JavaScript origins:
  - `https://app.yourdomain.com`

No redirect URI is required for the Google Identity token flow used here.

## 5) First deploy

From your local machine, run the sync script which builds images locally, uploads them to the server, and starts services:

```bash
bash scripts/sync-from-prod.sh
```

The script does:
1. Builds Docker images locally (`backend`, `frontend`)
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
- `https://api.yourdomain.com/api/health`

After the first deploy, create the initial admin user:

```bash
COMPOSE_FILE=docker-compose.prod.yml ./scripts/create-admin.sh 'YourName' 'you@example.com'
```

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
