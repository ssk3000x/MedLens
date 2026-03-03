# 1. Use the Node 20 engine
FROM node:20-slim

# 2. Create the folder inside the container
WORKDIR /app

# 3. Copy the package files and install the tools
COPY package*.json ./
RUN npm install

# 4. Copy your backend code
COPY . .

# 5. CONVERT TypeScript to JavaScript (The "Build" step)
RUN npx tsc

# 6. Set the Port for Google Cloud (Cloud Run uses 8080)
ENV PORT=8080
EXPOSE 8080

# 7. Start the app from the "dist" folder (where the converted code lives)
CMD ["node", "dist/index.js"]