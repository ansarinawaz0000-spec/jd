FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
# Database file persistent volume par rakho taaki restart par data na ude
ENV PORT=3000 DB_PATH=/data/dukan-hisab.db
VOLUME ["/data"]
EXPOSE 3000
CMD ["npm", "start"]
