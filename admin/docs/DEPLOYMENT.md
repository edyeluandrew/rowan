# Deployment Guide

## Prerequisites

- Node.js 18+
- npm or yarn
- Git

## Development Setup

```bash
# Install dependencies
npm install

# Port 5173
npm run dev

# With vite preview
npm run preview
```

## Building for Production

```bash
# Build
npm run build

# Output in: dist/

# Build with analyze
npm run build -- --analyze

# Preview production build locally
npm run preview
```

## Environment Configuration

### Development (.env.development)
```
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3001
VITE_DEBUG=true
```

### Production (.env.production)
```
VITE_API_URL=https://api.example.com
VITE_SOCKET_URL=https://socket.example.com
VITE_DEBUG=false
```

## Deployment Platforms

### Vercel

```bash
# Push to git (Vercel will auto-deploy)
git push origin main

# Or deploy directly
npm install -g vercel
vercel
```

**vercel.json:**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "env": {
    "VITE_API_URL": "@vite_api_url",
    "VITE_SOCKET_URL": "@vite_socket_url"
  }
}
```

### Netlify

```bash
npm install -g netlify-cli
netlify deploy --prod
```

**netlify.toml:**
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[env]
  VITE_API_URL = "https://api.example.com"
  VITE_SOCKET_URL = "https://socket.example.com"
```

### Docker

```dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
```

**Build and run:**
```bash
docker build -t admin-panel .
docker run -p 3000:3000 admin-panel
```

### AWS S3 + CloudFront

```bash
# Build
npm run build

# Upload to S3
aws s3 sync dist/ s3://my-bucket/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id XXXXX --paths "/*"
```

## CI/CD Pipeline

### GitHub Actions

**.github/workflows/deploy.yml:**
```yaml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test -- --coverage

      - name: Build
        run: npm run build

      - name: Deploy to Vercel
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        uses: vercel/action@master
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
```

## Performance Optimization

### Bundle Analysis
```bash
npm run build -- --analyze
```

### Compression
```bash
# Enable gzip in your web server
# nginx.conf or similar
gzip on;
gzip_types text/javascript application/javascript text/css;
```

### Caching Headers
```
Cache-Control: public, max-age=31536000  # JS/CSS
Cache-Control: no-cache                   # HTML
```

## Monitoring

### Error Tracking (Sentry)
```javascript
// main.jsx
import * as Sentry from "@sentry/react"

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1
})
```

### Analytics (Google Analytics)
```javascript
// Gtag integration
gtag('config', 'GA_ID', {
  page_path: window.location.pathname,
})
```

## Troubleshooting

### Build Errors
```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install

# Check for missing dependencies
npm ls
```

### Runtime Errors
1. Check browser console for errors
2. Enable debugging: `VITE_DEBUG=true`
3. Check network tab for failed requests
4. Verify environment variables are set

### Performance Issues
1. Run bundle analysis
2. Check for missing Code Splitting
3. Monitor API response times
4. Use DevTools Performance tab

## Rollback

```bash
# Vercel - automatic
vercel rollback

# Manual - redeploy previous version
git revert <commit-hash>
git push
```

## Health Checks

```bash
# Check if app is running
curl http://localhost:3000

# Check API connectivity
curl https://api.example.com/health

# Check Socket connection
npm test -- --testNamePattern="socket"
```

## Checklist

Before deploying to production:
- [ ] All tests pass
- [ ] Build succeeds
- [ ] Environment variables set
- [ ] API endpoints verified
- [ ] CORS configured
- [ ] Security headers added
- [ ] Performance optimized
- [ ] Error monitoring enabled
- [ ] Backup created
- [ ] Rollback plan ready
