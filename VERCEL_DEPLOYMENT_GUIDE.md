# Vercel Deployment Guide

This guide walks you through deploying the Internal Support Chat application to Vercel.

## Prerequisites

1. **Vercel Account**: Create a free account at [vercel.com](https://vercel.com)
2. **GitHub Account**: Push your code to GitHub (Vercel integrates directly with GitHub)
3. **Database**: Set up a MySQL/TiDB database (see Database Setup section)
4. **OAuth Provider**: Configure OAuth credentials with your auth provider

## Step 1: Prepare Your Repository

### Option A: Export from Manus to GitHub

1. Go to your project's Management UI in Manus
2. Click **Settings** → **GitHub**
3. Select your GitHub account and repository name
4. Click **Export** to push the code to GitHub

### Option B: Manual GitHub Setup

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial commit: Internal Support Chat"

# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/internal-support-chat.git
git branch -M main
git push -u origin main
```

## Step 2: Set Up Database

### Using PlanetScale (Recommended for MySQL)

1. Create a free account at [planetscale.com](https://planetscale.com)
2. Create a new database named `internal-support-chat`
3. Go to **Settings** → **Passwords**
4. Create a new password and copy the connection string
5. Format: `mysql://username:password@aws.connect.psdb.cloud/internal-support-chat?sslaccept=strict`

### Using AWS RDS

1. Create a MySQL 8.0 instance in AWS RDS
2. Configure security groups to allow Vercel IPs
3. Get your connection string: `mysql://admin:password@your-instance.rds.amazonaws.com:3306/internal-support-chat`

### Using Supabase (PostgreSQL - requires code changes)

Not recommended without modifying the schema to PostgreSQL syntax.

## Step 3: Configure OAuth

### With Manus OAuth

If you're using Manus OAuth, you'll need to:

1. Update your OAuth redirect URI to your Vercel domain: `https://your-app.vercel.app/api/oauth/callback`
2. Keep your existing `VITE_APP_ID` and `OAUTH_SERVER_URL`

### With Other OAuth Providers (Auth0, Google, etc.)

You'll need to reconfigure the authentication flow in `server/_core/auth.ts`.

## Step 4: Deploy to Vercel

### Using Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Select **Import Git Repository**
3. Paste your GitHub repository URL
4. Click **Import**
5. Configure environment variables (see Step 5)
6. Click **Deploy**

### Using Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from project directory
vercel

# Set environment variables
vercel env add DATABASE_URL
vercel env add JWT_SECRET
# ... add all required environment variables

# Deploy to production
vercel --prod
```

## Step 5: Set Environment Variables

In Vercel Dashboard, go to **Settings** → **Environment Variables** and add:

### Required Variables

| Variable | Value | Example |
|----------|-------|---------|
| `DATABASE_URL` | MySQL connection string | `mysql://user:pass@host/db?sslaccept=strict` |
| `JWT_SECRET` | Random 32-character string | Generate with: `openssl rand -base64 32` |
| `VITE_APP_ID` | OAuth app ID | From your OAuth provider |
| `OAUTH_SERVER_URL` | OAuth server URL | `https://api.manus.im` |
| `VITE_OAUTH_PORTAL_URL` | OAuth login portal | `https://portal.manus.im` |
| `OWNER_OPEN_ID` | Owner's OpenID | From your OAuth provider |
| `OWNER_NAME` | Owner's display name | Your name |

### Optional Variables

| Variable | Purpose |
|----------|---------|
| `BUILT_IN_FORGE_API_URL` | LLM and built-in services API |
| `BUILT_IN_FORGE_API_KEY` | API key for built-in services |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend API key |
| `VITE_FRONTEND_FORGE_API_URL` | Frontend API URL |
| `VITE_APP_TITLE` | Application title |
| `VITE_APP_LOGO` | Logo URL |

## Step 6: Run Database Migrations

After deployment, you need to initialize the database schema:

### Option 1: Using Vercel Functions (Recommended)

Create a migration script that runs on first deployment:

```bash
# SSH into Vercel deployment
vercel ssh

# Run migrations
pnpm db:push
```

### Option 2: Manual Migration

Connect to your database directly and run the schema:

```bash
# From your local machine
DATABASE_URL="your_connection_string" pnpm db:push
```

## Step 7: Verify Deployment

1. Visit your Vercel deployment URL: `https://your-app.vercel.app`
2. Test the login flow
3. Create a test conversation
4. Check admin dashboard
5. Verify escalations are working

## Troubleshooting

### Build Fails: "Cannot find module"

```bash
# Clear build cache and redeploy
vercel env pull  # Pull environment variables locally
pnpm install
pnpm build
```

### Database Connection Error

1. Verify `DATABASE_URL` is correct in Vercel settings
2. Check database firewall allows Vercel IPs
3. Test connection locally: `DATABASE_URL="..." pnpm db:push`

### OAuth Login Fails

1. Update redirect URI in OAuth provider to: `https://your-app.vercel.app/api/oauth/callback`
2. Verify `VITE_APP_ID` and `OAUTH_SERVER_URL` are correct
3. Check browser console for error details

### Streaming Responses Not Working

The streaming endpoint requires proper headers. If not working:

1. Check that your database has the `messages` table
2. Verify LLM API keys are configured
3. Check Vercel function timeout (set to 60s minimum)

## Monitoring & Logs

### View Logs in Vercel

1. Go to your project in Vercel dashboard
2. Click **Deployments**
3. Select the latest deployment
4. Click **Logs** to see real-time logs

### Enable Debug Logging

Add to your environment variables:

```
DEBUG=*
NODE_ENV=development
```

## Custom Domain

1. In Vercel dashboard, go to **Settings** → **Domains**
2. Add your custom domain
3. Update DNS records according to Vercel's instructions
4. Update OAuth redirect URI to your custom domain

## Performance Optimization

### Database Query Optimization

The application uses Drizzle ORM. For better performance:

1. Add database indexes on frequently queried columns
2. Use connection pooling (PlanetScale does this automatically)
3. Monitor query performance in database dashboard

### Caching

Enable Vercel's edge caching:

1. Set `Cache-Control` headers in API responses
2. Use ISR (Incremental Static Regeneration) for static pages

### CDN

Vercel automatically serves static assets from a global CDN. No additional configuration needed.

## Scaling

As your application grows:

1. **Database**: Upgrade PlanetScale plan or move to AWS RDS with read replicas
2. **API**: Vercel automatically scales serverless functions
3. **Storage**: If using S3, ensure bucket is in the same region as your database

## Backup & Recovery

### Database Backups

**PlanetScale**: Automatic daily backups, restore from dashboard

**AWS RDS**: Enable automated backups in RDS console

### Code Backups

Your GitHub repository is your backup. To restore:

```bash
git clone https://github.com/YOUR_USERNAME/internal-support-chat.git
cd internal-support-chat
vercel --prod
```

## Support

For issues with:

- **Vercel Deployment**: [Vercel Docs](https://vercel.com/docs)
- **Database**: Check your database provider's documentation
- **Application Code**: Review error logs in Vercel dashboard and browser console

## Next Steps

After successful deployment:

1. **Set up monitoring**: Add error tracking (Sentry, LogRocket)
2. **Configure email**: Set up SendGrid/AWS SES for notifications
3. **Add analytics**: Enable analytics in Vercel dashboard
4. **Security**: Review and update CORS settings, add rate limiting
5. **Backup strategy**: Set up automated database backups
