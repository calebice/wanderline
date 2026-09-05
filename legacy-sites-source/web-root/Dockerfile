FROM node:22-alpine AS base
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN chown -R node:node /app

FROM base AS development
USER node
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

FROM base AS build
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
