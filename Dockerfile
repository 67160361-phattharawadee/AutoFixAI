FROM node:20-alpine AS builder

WORKDIR /app
COPY . .
RUN node --check app.js && node --check ai-service.js
RUN node build-static.js

FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
