#!/bin/bash

# Vercel Environment Variables Setup Script
# Run this script to set up environment variables via Vercel CLI

echo "🚀 Setting up Vercel Environment Variables"
echo "=========================================="

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

echo "📝 Setting environment variables..."

# Required variables
echo "Setting DATABASE_URL..."
vercel env add DATABASE_URL production

echo "Setting JWT_SECRET..."
vercel env add JWT_SECRET production

echo "Setting NODE_ENV..."
vercel env add NODE_ENV production

# Optional variables
echo "Setting POSTGRES_URL..."
vercel env add POSTGRES_URL production

echo "Setting POSTGRES_PRISMA_URL..."
vercel env add POSTGRES_PRISMA_URL production

echo "Setting POSTGRES_URL_NON_POOLING..."
vercel env add POSTGRES_URL_NON_POOLING production

echo "Setting SEED_DATABASE..."
vercel env add SEED_DATABASE production

echo "Setting JWT_EXPIRES_IN..."
vercel env add JWT_EXPIRES_IN production

echo "✅ Environment variables setup complete!"
echo "🔄 Redeploy your project for changes to take effect"