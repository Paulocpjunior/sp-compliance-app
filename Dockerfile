FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Include custom nginx config if we had routing issues
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
