FROM node:18-alpine

WORKDIR /app

# Copy package.json
COPY package.json ./

# Install dependencies (this works even without a lockfile)
RUN npm install

# Copy the rest of the code
COPY . .

# Expose port
EXPOSE 3000

# Start the app
CMD ["node", "index.js"]
