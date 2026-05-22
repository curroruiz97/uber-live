# Backend Node (Express) + SPA compilado + Chromium para whatsapp-web.js.
# Imagen única: sirve /api y el dist en el mismo proceso (un solo despliegue).
FROM node:22-bookworm-slim

# Librerías de sistema que necesita el Chromium de Puppeteer en Debian slim.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates fonts-liberation wget \
      libasound2 libatk-bridge2.0-0 libatk1.0-0 libcairo2 libcups2 \
      libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libglib2.0-0 libgtk-3-0 \
      libnspr4 libnss3 libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 \
      libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Chrome de Puppeteer en una caché conocida (la usa whatsapp-web.js en runtime).
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

# Instala dependencias (puppeteer entra como dep transitiva de whatsapp-web.js).
COPY package*.json ./
RUN npm install --no-audit --no-fund

# Asegura el Chrome que espera la versión de Puppeteer instalada.
RUN npx puppeteer browsers install chrome

# Copia el resto y compila el front (Vite -> dist/, que el backend sirve).
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# La sesión de WhatsApp vive en /app/.wwebjs_auth -> monta un volumen ahí para
# que sobreviva a redeploys (si no, habrá que re-escanear el QR).
VOLUME ["/app/.wwebjs_auth"]

CMD ["node", "server/index.js"]
