# Estágio 1: Build (Transforma o código TypeScript em arquivos que o navegador entende)
FROM node:18-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Estágio 2: Serve (Roda a aplicação no Cloud Run)
FROM node:18-slim
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist

# Porta padrão do Cloud Run
EXPOSE 8080
CMD ["serve", "-s", "dist", "-l", "8080"]
