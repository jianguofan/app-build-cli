# Multi-stage build for production

# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/

# Install dependencies
RUN npm ci

# Copy source code
COPY packages/backend ./packages/backend
COPY tsconfig.json ./

# Build
WORKDIR /app/packages/backend
RUN npm run build

# Stage 2: Production
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "packages/backend/dist/main.js"]
