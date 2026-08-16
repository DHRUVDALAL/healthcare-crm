# Dockerfile for Healthcare Recruitment ERP + CRM
FROM node:20-alpine

WORKDIR /app

# Copy root and backend package files
COPY package.json ./
COPY backend/package.json ./backend/

# Install dependencies
RUN npm run build

# Copy remaining application files
COPY . .

# Expose backend port
EXPOSE 10000

ENV PORT=10000
ENV NODE_ENV=production

# Start application
CMD ["npm", "start"]
