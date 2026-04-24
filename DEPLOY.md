# Oscilloscope Deployment Notes

## 1. Push the project to GitHub

Run these commands inside the project folder:

```bash
git branch -m main
git add .
git commit -m "Initial release"
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## 2. Create the shared counter database in Cloudflare

1. Create a D1 database named `oscilloscope-counter`.
2. Copy its database ID.
3. Replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` in `wrangler.toml`.
4. Run the schema in `db/schema.sql`.

## 3. Publish the site on Cloudflare Pages

1. Create a new Pages project and connect the GitHub repository.
2. Set the build command to empty.
3. Set the output directory to `.`.
4. Add a D1 binding:
   - Binding name: `DB`
   - Database: `oscilloscope-counter`

## 4. Counter behavior

- The front end requests `GET /api/counter` to load the current shared count.
- Every successful print triggers `POST /api/counter`.
- If the shared endpoint is unavailable, the app falls back to the browser's local cache.
