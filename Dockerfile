FROM node:22-bullseye-slim AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# Copy everything first — postinstall scripts need project files present at install time
COPY . .

# Install all dependencies (including devDeps needed for build)
RUN npm install --legacy-peer-deps

# Set production mode AFTER install so devDeps are not skipped
ENV NODE_ENV=production

RUN npm run build

FROM node:22-bullseye-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Explicitly select Postgres runtime. Without this, src/db/config.ts defaults
# to PGlite on non-Vercel environments, which ignores DATABASE_URL entirely.
ENV DB_RUNTIME=postgres

# Standalone output only — no node_modules bloat in the final image
COPY --from=builder /app/.next/standalone ./.next/standalone
COPY --from=builder /app/public ./.next/standalone/public
COPY --from=builder /app/.next/static ./.next/standalone/.next/static

EXPOSE 3000

CMD ["node", ".next/standalone/server.js"]
