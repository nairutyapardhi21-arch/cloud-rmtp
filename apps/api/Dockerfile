FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache ffmpeg
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install
COPY apps/api apps/api
WORKDIR /app/apps/api
RUN npx prisma generate
EXPOSE 3001
CMD ["npm", "run", "start"]

