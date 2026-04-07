# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# URL del API en el navegador (build-time). En Docker Desktop suele ser el host:8000.
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

RUN npx vite build --outDir dist

# Runtime stage
FROM nginx:alpine
# Ahora sí, copiamos desde 'dist' porque forzamos esa carpeta arriba
COPY --from=build /app/dist /usr/share/nginx/html

# (Opcional) Si creaste el nginx.conf, descomenta la siguiente linea:
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]