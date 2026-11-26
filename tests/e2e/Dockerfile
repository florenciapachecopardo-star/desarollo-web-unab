# Imagen oficial de Playwright con Chromium ya instalado. La versión debe coincidir
# con @playwright/test en package.json.
FROM mcr.microsoft.com/playwright:v1.49.1-noble
WORKDIR /e2e
COPY package.json ./
RUN npm install --no-audit --no-fund
# El código de las pruebas se monta en /e2e/codigo (docker-compose.yml), no se copia.
# Node encuentra @playwright/test subiendo a /e2e/node_modules.
ENTRYPOINT ["npx", "playwright", "test", "-c", "codigo/playwright.config.js"]
