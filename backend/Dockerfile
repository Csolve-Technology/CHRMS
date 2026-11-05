FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate && npm run test:auth && npm run test:bootstrap && npm run build
RUN npm prune --omit=dev --ignore-scripts

FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates gosu \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package*.json ./
COPY scripts ./scripts
RUN mkdir -p /app/uploads/agreements \
  && chown -R node:node /app/uploads \
  && chmod +x /app/scripts/docker-entrypoint.sh
EXPOSE 3000
# Start as root so entrypoint can fix volume ownership, then drop to node
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
