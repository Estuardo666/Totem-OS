FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/worker
COPY worker/package.json worker/package-lock.json ./
RUN npm ci --no-audit --no-fund

WORKDIR /app
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY src ./src
COPY worker/build-wa.mjs ./worker/build-wa.mjs
COPY worker/index.ts ./worker/index.ts
COPY worker/tsconfig.wa.json ./worker/tsconfig.wa.json
COPY worker/whatsapp ./worker/whatsapp

WORKDIR /app/worker
RUN npm run build:wa

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app/worker
ENV NODE_ENV=production
COPY --from=build /app/worker/package.json ./package.json
COPY --from=build /app/worker/node_modules ./node_modules
COPY --from=build /app/worker/dist ./dist
EXPOSE 3081
CMD ["node", "dist/whatsapp/index.js"]
