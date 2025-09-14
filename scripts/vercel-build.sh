#!/bin/bash

# Vercel Build Script
# This script runs during Vercel deployment to set up the database and build the application

set -e

echo "🔧 Starting Vercel build process..."

# Generate Prisma client
echo "📦 Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "🗄️ Running database migrations..."
npx prisma migrate deploy

# Seed database if needed (only for new deployments)
if [ "$VERCEL_ENV" = "production" ] && [ "$SEED_DATABASE" = "true" ]; then
  echo "🌱 Seeding database..."
  npm run db:seed
fi

# Build Next.js application
echo "🏗️ Building Next.js application..."
npm run build

echo "✅ Vercel build completed successfully!"