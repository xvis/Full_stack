FROM node:20-alpine

WORKDIR /app

FROM jenkins/jenkins:lts

USER root

RUN apt-get update && \
    apt-get install -y nodejs npm && \
    apt-get clean

USER jenkins
# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source
COPY . .

# Run as non-root user
USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "src/index.js"]