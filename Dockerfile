FROM node:24-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY ingestion-endpoint/package.json ingestion-endpoint/package.json
COPY device-simulation/package.json device-simulation/package.json
COPY datacenter-dashboard/package.json datacenter-dashboard/package.json
RUN npm ci

FROM deps AS build
COPY packages/shared packages/shared
COPY ingestion-endpoint ingestion-endpoint
COPY device-simulation device-simulation
COPY datacenter-dashboard datacenter-dashboard
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY ingestion-endpoint/package.json ingestion-endpoint/package.json
COPY device-simulation/package.json device-simulation/package.json
COPY datacenter-dashboard/package.json datacenter-dashboard/package.json
RUN npm ci --omit=dev --workspaces --include-workspace-root=false && npm cache clean --force

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/ingestion-endpoint/dist ingestion-endpoint/dist
COPY --from=build /app/ingestion-endpoint/db ingestion-endpoint/db
COPY --from=build /app/ingestion-endpoint/scripts ingestion-endpoint/scripts
COPY --from=build /app/device-simulation/dist device-simulation/dist
COPY --from=build /app/datacenter-dashboard/dist datacenter-dashboard/dist

RUN mkdir -p /app/logs
