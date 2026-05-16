# Cut Tracker v2

Workout, calorie deficit, and daily life tracker. PWA — installs to your phone home screen.

## What's new in v2

- **Today tab** is now your morning command center: #1 priority, checklist, water tracking, habit status
- **Morning checklist** with smart defaults (water, supps, protein, gear) — fully customizable in Settings
- **Water tracking** with quick +8/+16/+24 oz buttons
- **Body tab** — BMI, estimated body fat %, lean mass, fat mass, protein floor calculation
- **Exercise history** with fatigue detection — flags 10%+ volume drops (deload signal) and 5%+ jumps (PR push)
- **Last session display** under each exercise as you log so you know what to beat
- **Exercise PR tracker** showing top weight per movement
- **Weekly stats** — fat loss estimate, gym days, water goal hits
- Data export for backup

## Deploy to Vercel

### To update your existing Vercel deployment (replacing v1):

1. Unzip this file
2. Go to your `cut-tracker` repo on GitHub
3. Delete the old files (or just upload these on top — GitHub will overwrite)
4. Upload all the new files via drag-and-drop
5. Vercel auto-redeploys in ~30 seconds
6. Refresh the app on your phone — your data carries over (it's in localStorage, separate from the code)

### First-time Vercel deploy:

1. Push these files to a new GitHub repo
2. Import the repo at vercel.com
3. Click Deploy. Vercel auto-detects Vite.

## Install on phone

Open the Vercel URL on your phone:
- **iPhone/Safari:** Share → Add to Home Screen
- **Android/Chrome:** Menu → Install app

## Data backup

Settings → Export All Data. Save the JSON file somewhere safe (Google Drive, email to yourself). localStorage is durable but not bulletproof — back up monthly.

## Local dev

```bash
npm install
npm run dev
```
