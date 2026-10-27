# syntax=docker/dockerfile:1

FROM oven/bun:1.3.14-alpine AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

COPY index.html vite.config.ts tsconfig*.json postcss.config.js tailwind.config.ts ./
COPY src/ ./src/
COPY public/ ./public/
RUN bun run build

FROM busybox:1.37.0-musl
WORKDIR /www
COPY --from=build /app/dist/ ./
USER 65534:65534
EXPOSE 8080
CMD ["httpd", "-f", "-p", "8080", "-h", "/www"]
