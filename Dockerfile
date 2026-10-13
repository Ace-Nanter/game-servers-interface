FROM node:24-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json ./
COPY package-lock.json ./

RUN npm install --production

# Bundle app source
COPY dist ./

# Start application
CMD node main.js
