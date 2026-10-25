FROM node:24-slim AS build
ARG VITE_API_BASE_URL
ARG VITE_DEMO_MODE=false
ENV CI=true
RUN npm install --global pnpm@12.15.0
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@voita_kone/web..."
RUN pnpm --filter @voita_kone/web exec vite build

FROM nginxinc/nginx-unprivileged:alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
