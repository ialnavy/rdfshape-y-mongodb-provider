FROM node:lts-alpine AS build

WORKDIR /app
COPY package.json ./
RUN npm install --verbose
COPY . ./

EXPOSE 2403
CMD ["npm", "start"]
