# Use Alpine version for smaller image size
FROM node:20-alpine

# Create app directory with proper permissions
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# Copy package files first for better Docker layer caching
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile --production=false && \
    yarn cache clean

# Copy application code
COPY . .

# Change ownership to non-root user
RUN chown -R nodeuser:nodejs /app

# Switch to non-root user
USER nodeuser

# Expose port
EXPOSE 3002

# Add health check for Fastify
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3002/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Use CMD instead of overriding in docker-compose for flexibility
CMD ["node", "server.js"]