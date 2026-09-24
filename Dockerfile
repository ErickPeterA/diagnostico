FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist-server ./dist-server
COPY --from=builder --chown=node:node /app/dist-client ./dist-client
COPY --from=builder --chown=node:node /app/package.json ./package.json
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
