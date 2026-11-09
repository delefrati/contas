# Caddy with the Cloudflare DNS plugin: the *.BASE_DOMAIN wildcard certificate can
# only be issued through the DNS challenge.
FROM caddy:2.11-builder-alpine AS builder
RUN xcaddy build --with github.com/caddy-dns/cloudflare

FROM caddy:2.11-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
