# Use lightweight Node.js image
FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --only=prod

# Copy the rest of the app
COPY . .

# Expose port 4315
EXPOSE 4315

# Start the server
CMD ["npm", "start"]