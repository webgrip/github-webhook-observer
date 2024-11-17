FROM node:22-alpine3.20
WORKDIR /app
COPY src/ .
RUN npm install
EXPOSE 8000
CMD ["node", "--trace-deprecation", "index.js"]
