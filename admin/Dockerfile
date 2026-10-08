FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.mjs ./
COPY public/ ./public/
EXPOSE 3001
CMD ["node", "server.mjs"]
