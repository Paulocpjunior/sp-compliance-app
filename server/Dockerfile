FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
RUN npx --yes playwright install --with-deps chromium
COPY . .
RUN npm run build
EXPOSE 8080
CMD ["npm", "start"]
