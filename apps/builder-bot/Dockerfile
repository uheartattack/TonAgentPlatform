FROM node:20-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
RUN corepack enable
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/builder-bot ./apps/builder-bot
COPY --from=build /app/apps/landing ./apps/landing
COPY --from=build /app/package.json ./
EXPOSE 3001
CMD ["node", "--loader", "ts-node/esm", "apps/builder-bot/src/index.ts"]
