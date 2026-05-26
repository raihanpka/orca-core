FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY apps/orca-web/package.json apps/orca-web/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
COPY apps/orca-web ./
# Copy root .env so Next.js can bake NEXT_PUBLIC_ variables during build
COPY .env ./.env
# Disable deprecation warnings
ENV NODE_OPTIONS='--no-deprecation'
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS='--no-deprecation'

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set correct ownership for nextjs
COPY --from=builder /app/public ./public
# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
