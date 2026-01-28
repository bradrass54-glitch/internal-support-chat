# Free Deployment Setup Guide - Internal Support Chat

This guide walks you through deploying to Vercel (free) with PlanetScale (free MySQL database) and Manus OAuth.

**Total Cost: $0/month** ✅

---

## Step 1: Create PlanetScale Database (5 minutes)

PlanetScale offers a free tier with 5GB storage - perfect for getting started.

### 1.1 Sign Up for PlanetScale

1. Go to [planetscale.com](https://planetscale.com)
2. Click **Sign Up** (or **Sign in with GitHub** for easier setup)
3. Create your account

### 1.2 Create Your Database

1. Click **Create a database**
2. Name it: `internal-support-chat`
3. Select region closest to you
4. Click **Create database**
5. Wait 1-2 minutes for it to initialize

### 1.3 Get Your Connection String

1. In your database dashboard, click **Connect**
2. Select **Node.js** from the dropdown
3. Copy the connection string (looks like: `mysql://user:password@aws.connect.psdb.cloud/internal-support-chat?sslaccept=strict`)
4. **Save this - you'll need it for Vercel**

---

## Step 2: Create Vercel Account & Deploy (10 minutes)

### 2.1 Sign Up for Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **Sign Up**
3. Select **Continue with GitHub** (easiest option)
4. Authorize Vercel to access your GitHub account

### 2.2 Deploy Your Project

1. After signing in, click **Add New** → **Project**
2. Find and select `internal-support-chat` repository
3. Click **Import**
4. You'll see the configuration page

### 2.3 Add Environment Variables

On the Vercel configuration page, click **Environment Variables** and add these:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | *Paste your PlanetScale connection string from Step 1.3* |
| `JWT_SECRET` | `QyMYQG4GYWfMpuVuQYxHNIZXsNcZ9+Zp/GzYmcHdaxw=` |
| `VITE_APP_ID` | *From your Manus OAuth setup* |
| `OAUTH_SERVER_URL` | `https://api.manus.im` |
| `VITE_OAUTH_PORTAL_URL` | `https://portal.manus.im` |
| `OWNER_OPEN_ID` | *Your Manus user ID* |
| `OWNER_NAME` | *Your name* |

**Don't have OAuth credentials?** If you're using Manus OAuth, these should be pre-configured. If not, contact your Manus admin.

### 2.4 Deploy

1. Click **Deploy**
2. Wait 2-3 minutes for the build to complete
3. You'll see a success message with your deployment URL
4. Click **Visit** to see your live app!

---

## Step 3: Initialize Database (2 minutes)

Your app is live, but the database tables don't exist yet. Let's create them:

### 3.1 Using Vercel CLI (Recommended)

```bash
# Install Vercel CLI if you don't have it
npm i -g vercel

# Navigate to your project
cd /path/to/internal-support-chat

# Pull environment variables from Vercel
vercel env pull

# Run database migrations
pnpm db:push
```

### 3.2 Or Using SSH (Alternative)

1. In Vercel dashboard, go to your project
2. Click **Deployments** → Latest deployment
3. Click **... → Open in SSH**
4. Run: `pnpm db:push`
5. Exit SSH

---

## Step 4: Verify Your Deployment (5 minutes)

### 4.1 Test the App

1. Visit your Vercel URL (e.g., `https://internal-support-chat.vercel.app`)
2. Click **Sign In**
3. You should see the OAuth login page
4. Sign in with your account
5. You should land on the chat interface

### 4.2 Test Core Features

- **Chat**: Type a message and verify AI responds
- **Admin Dashboard**: Click Admin to see dashboard
- **Escalations**: Create a test escalation
- **Agent Dashboard**: Switch to agent role and view escalations

### 4.3 Check Logs

If something doesn't work:

1. In Vercel dashboard, go to **Deployments** → Latest
2. Click **Logs** to see error messages
3. Check browser console (F12) for frontend errors

---

## Step 5: Custom Domain (Optional)

Want `support.yourcompany.com` instead of `vercel.app`?

### 5.1 Add Domain in Vercel

1. In Vercel project settings, go to **Domains**
2. Enter your domain name
3. Follow the DNS setup instructions
4. Update OAuth redirect URI to your custom domain

---

## Troubleshooting

### "Build failed" error

**Solution**: Check that all environment variables are set in Vercel dashboard. Missing any? Add them and redeploy.

```bash
# Verify locally
vercel env pull
cat .env.local
```

### "Database connection error"

**Solution**: Verify your `DATABASE_URL` is correct:

```bash
# Test connection locally
DATABASE_URL="your_connection_string" pnpm db:push
```

### "OAuth login fails"

**Solution**: Update redirect URI in your OAuth provider:

1. Go to your OAuth provider settings
2. Add: `https://your-vercel-url.vercel.app/api/oauth/callback`
3. If using custom domain: `https://yourdomain.com/api/oauth/callback`

### "Streaming responses not working"

**Solution**: Ensure LLM API keys are configured:

1. Check `BUILT_IN_FORGE_API_KEY` is set in Vercel
2. Verify `BUILT_IN_FORGE_API_URL` is correct
3. Check Vercel function timeout is 60s+

---

## Free Tier Limits

| Service | Free Tier | Limit |
|---------|-----------|-------|
| **Vercel** | Unlimited deployments | 100GB bandwidth/month |
| **PlanetScale** | 5GB storage | 1 free database |
| **Manus OAuth** | Included | Depends on your plan |

---

## Next Steps

1. **Set up email notifications** (optional): Add SendGrid for alerts
2. **Add custom domain**: Point your domain to Vercel
3. **Monitor performance**: Use Vercel Analytics
4. **Scale up**: Upgrade PlanetScale plan if needed

---

## Support

**Stuck?** Check these resources:

- [Vercel Docs](https://vercel.com/docs)
- [PlanetScale Docs](https://planetscale.com/docs)
- [Manus OAuth Docs](https://docs.manus.im)

Your app is now live! 🎉
