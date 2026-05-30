# Imagen única: build del SPA + backend Node (Express) que sirve el SPA y el proxy de Uber.
FROM node:22-bookworm-slim

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev || npm install

COPY . .
RUN npm run build

ENV PORT=3001
EXPOSE 3001
CMD ["node", "server/index.js"]
