# Deployment Checklist - Internal Support Chat

Follow these steps in order to deploy to Vercel with PlanetScale.

## Pre-Deployment (Have these ready)

- [ ] GitHub account with code pushed (✅ Already done)
- [ ] Manus OAuth credentials (VITE_APP_ID, OWNER_OPEN_ID, OWNER_NAME)
- [ ] 15 minutes of free time

## Step 1: Create PlanetScale Database

- [ ] Go to [planetscale.com](https://planetscale.com)
- [ ] Sign up (or sign in with GitHub)
- [ ] Click **Create a database**
- [ ] Name: `internal-support-chat`
- [ ] Select your region
- [ ] Click **Create database**
- [ ] Wait for initialization (1-2 min)
- [ ] Click **Connect**
- [ ] Select **Node.js**
- [ ] **Copy the connection string** - SAVE THIS!

**Your connection string should look like:**
```
mysql://username:password@aws.connect.psdb.cloud/internal-support-chat?sslaccept=strict
```

## Step 2: Deploy to Vercel

- [ ] Go to [vercel.com](https://vercel.com)
- [ ] Sign up with GitHub
- [ ] Click **Add New** → **Project**
- [ ] Select `internal-support-chat` repository
- [ ] Click **Import**

## Step 3: Configure Environment Variables in Vercel

In the Vercel configuration screen, add these environment variables:

- [ ] `DATABASE_URL` = *Your PlanetScale connection string*
- [ ] `JWT_SECRET` = `QyMYQG4GYWfMpuVuQYxHNIZXsNcZ9+Zp/GzYmcHdaxw=`
- [ ] `VITE_APP_ID` = *Your Manus OAuth App ID*
- [ ] `OAUTH_SERVER_URL` = `https://api.manus.im`
- [ ] `VITE_OAUTH_PORTAL_URL` = `https://portal.manus.im`
- [ ] `OWNER_OPEN_ID` = *Your Manus User ID*
- [ ] `OWNER_NAME` = *Your Name*

## Step 4: Deploy

- [ ] Click **Deploy** button
- [ ] Wait for build to complete (2-3 minutes)
- [ ] See "Congratulations" message
- [ ] Click **Visit** to open your app

## Step 5: Initialize Database

After deployment, run database migrations:

### Option A: Using Vercel CLI (Recommended)

```bash
npm i -g vercel
cd /path/to/internal-support-chat
vercel env pull
pnpm db:push
```

- [ ] Install Vercel CLI
- [ ] Pull environment variables
- [ ] Run `pnpm db:push`
- [ ] See "✓ Successfully applied X migrations"

### Option B: Using SSH

- [ ] In Vercel, click **Deployments** → Latest
- [ ] Click **... → Open in SSH**
- [ ] Run: `pnpm db:push`
- [ ] Exit SSH

## Step 6: Verify Deployment

- [ ] Visit your Vercel URL
- [ ] Click **Sign In**
- [ ] Sign in with your account
- [ ] See chat interface
- [ ] Type a test message
- [ ] Verify AI responds

## Step 7: Test Admin Features

- [ ] Click **Admin** in header
- [ ] See Admin Dashboard
- [ ] Check Analytics tab
- [ ] Check Escalations tab (should be empty)
- [ ] Check Conversations tab

## Step 8: Test Agent Features

- [ ] Switch to agent role in workspace settings
- [ ] Go to **Agent Dashboard**
- [ ] Verify escalation list loads

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails | Check all env vars are set in Vercel |
| Database error | Verify DATABASE_URL is correct |
| OAuth fails | Update redirect URI in OAuth provider |
| Streaming broken | Check LLM API keys are configured |
| Can't access app | Wait 5 min, then refresh browser |

## Success! 🎉

Your app is now live at: `https://your-app-name.vercel.app`

### What's Next?

1. Add custom domain (optional)
2. Set up email notifications
3. Invite team members
4. Create documentation
5. Configure escalation rules

---

**Need help?** See `FREE_DEPLOYMENT_SETUP.md` for detailed instructions.
