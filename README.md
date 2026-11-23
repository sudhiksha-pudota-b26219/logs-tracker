# Wake-up Call Tracker

Each caller logs in with their own username and password and sees their own list. For each person they tap **Called**, **Not picked** (or **Not picked again**), or **Undo**. Everyone can see the whole team's progress, and the page refreshes every few seconds. Callers can see other people's lists but can only mark their own. The organiser can mark any list.

## Deploy on Vercel (about 10 minutes)

1. **Put the code on GitHub.** Create a new private repository and upload the contents of this folder (everything except `node_modules`).
2. **Import it into Vercel.** Go to vercel.com → *Add New… → Project*, pick the repository, and click *Deploy*. Leave the framework set to Next.js. The first deploy will fail or show an error page because there's no database yet. That's expected.
3. **Add the database.** In the project, open *Storage → Create Database → Upstash (Redis)*, choose the free plan and a region near you (Mumbai if it's offered), and connect it to this project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
4. **Add three environment variables** under *Settings → Environment Variables*:
   - `ADMIN_USERNAME`: the organiser's login, e.g. `organiser`
   - `ADMIN_PASSWORD`: a long password only you know
   - `SESSION_SECRET`: a long random string (for example, run `openssl rand -hex 32`, or mash the keyboard for 40+ characters)
5. **Redeploy** (*Deployments → ⋯ → Redeploy*) so it picks up the new settings.

## First-time setup (organiser)

1. Open your Vercel URL and log in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
2. Click **Setup & logins**.
3. Paste the 14 callers' names, one per line, and click **Create logins**. Copy the usernames and passwords it shows and send each person theirs. They're shown only once. If someone loses theirs, use **New password**.
4. **Before the real list arrives:** click **Load practice list** to give everyone made-up names (Practice Student 001, roll P001…) to try the buttons on. Callers see a "Practice list" banner.
5. **When the real list arrives:** paste it in as `Name, roll number` per line, or as two columns copied from a spreadsheet in either order. Untick **This is still a practice list** and click **Divide evenly & save**. This replaces the practice list.
6. **To edit later:** click **Edit current list**, change the lines and save. The list is divided evenly again, and anyone already marked keeps their status as long as their roll number hasn't changed.
7. Before each morning's calls, click **Start a new round** to set everyone back to "yet to call".

Callers can change their own password after logging in. Resetting or changing a password logs that person out on their other devices.

## Run locally (optional)

```
npm install
ADMIN_USERNAME=organiser ADMIN_PASSWORD=test SESSION_SECRET=dev npm run dev
```

Without Upstash variables, local runs keep data in memory, and it's lost when you stop the app.
