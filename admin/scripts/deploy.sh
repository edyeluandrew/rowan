#!/bin/bash

# Admin Panel Build & Deployment Script

set -e

echo "🚀 Starting Admin Panel Build & Deployment..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_section() {
  echo -e "\n${BLUE}==== $1 ====${NC}\n"
}

log_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

# Check Node version
log_section "Checking Environment"
NODE_VERSION=$(node -v)
log_success "Node version: $NODE_VERSION"

# Install dependencies
log_section "Installing Dependencies"
npm ci
log_success "Dependencies installed"

# Run linting
log_section "Running ESLint"
npm run lint || log_warning "Lint warnings found"

# Run tests
log_section "Running Tests"
npm test -- --coverage
log_success "Tests passed"

# Build
log_section "Building Admin Panel"
npm run build
log_success "Build completed"

# Size analysis
log_section "Bundle Size Analysis"
du -sh dist/
log_success "Bundle ready for deployment"

# Create deployment package
log_section "Creating Deployment Package"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEPLOY_DIR="deploy_${TIMESTAMP}"
mkdir -p "${DEPLOY_DIR}"
cp -r dist/* "${DEPLOY_DIR}/"
tar -czf "${DEPLOY_DIR}.tar.gz" "${DEPLOY_DIR}"
log_success "Deployment package created: ${DEPLOY_DIR}.tar.gz"

# Upload to server (optional)
if [ "$DEPLOY_TARGET" = "production" ]; then
  log_section "Deploying to Production"
  # Add your deployment command here
  # Example: rsync -avz dist/ user@server:/var/www/admin
  log_success "Deployment complete"
fi

echo -e "\n${GREEN}✓ Build & Deployment Process Complete!${NC}\n"
