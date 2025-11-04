# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build argument for admin password
ARG VITE_ADMIN_PASSWORD=admin123

# Set environment variable for build
ENV VITE_ADMIN_PASSWORD=${VITE_ADMIN_PASSWORD}

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --production

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist

# Copy server file
COPY server.js ./

# Create data directory for persistent storage
RUN mkdir -p /app/data

# Expose port 80
EXPOSE 80

# Set environment variable for data directory
ENV DATA_DIR=/app/data
ENV PORT=80

# Start the server
CMD ["node", "server.js"]

