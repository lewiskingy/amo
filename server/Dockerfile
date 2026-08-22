FROM node:22-alpine
WORKDIR /app
COPY server/package.json ./package.json
COPY server/server.js server/repository.js ./
ENV PORT=8080
ENV AMO_WORKSPACE_ROOT=/data/workspace
EXPOSE 8080
VOLUME ["/data"]
CMD ["node","server.js"]
