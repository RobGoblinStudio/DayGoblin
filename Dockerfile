FROM node:20-alpine
WORKDIR /app
COPY package.json server.js index.html create.html calendar.html home.js calendar.js style.css ./
ENV NODE_ENV=production
ENV PORT=4173
ENV HOST=0.0.0.0
EXPOSE 4173
CMD ["npm", "start"]
