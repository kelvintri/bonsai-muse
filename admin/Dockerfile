FROM node:22-alpine
WORKDIR /app
COPY admin/package.json admin/package-lock.json* ./
RUN npm install --omit=dev 2>/dev/null || npm install --omit=dev
COPY admin/ ./
EXPOSE 3001
CMD ["node", "server.mjs"]
