# 1) Compila la app de Next.js (carpeta out/). next.config.ts hace que la app llame al mismo origen.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2) La sirve server.js: archivos de la app + puente hacia el back + trazas para Grafana
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    BACKEND_URL=http://32.196.100.44:8000
COPY --from=build /app/out ./out
COPY server.js ./
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/_otel/health || exit 1
CMD ["node", "server.js"]
