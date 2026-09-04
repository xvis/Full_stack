# Build Stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy dependency manifests first for better layer caching
COPY package*.json ./
RUN npm ci

# Copy source code and build Angular application
COPY . .
RUN npm run build

# Runtime Stage
FROM nginx:1.27-alpine

# Copy custom Nginx configuration with SPA routing and API reverse proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled Angular distribution
COPY --from=build /app/dist/frontend-app/browser /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O - http://127.0.0.1/health || exit 1

CMD ["nginx", "-g", "daemon off;"]