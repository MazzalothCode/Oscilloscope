# Oscilloscope

Oscilloscope is a single-page browser tool for turning photos into retro signal-inspired artworks. It runs entirely in the browser for image processing and exports both `PNG` and editable `SVG`.

Live site: [https://oscilloscope-edq.pages.dev/](https://oscilloscope-edq.pages.dev/)

## Features

- Upload a photo and crop it to a square composition
- Real-time preview while adjusting parameters
- Export high-resolution `PNG`
- Export editable vector `SVG`
- Shared print counter powered by Cloudflare D1
- No build step required for the front end

## Effects

- `Unknown Pleasures`
- `Known Pleasures`
- `Groove`
- `Fuzz`
- `Atomize`
- `Chaos`

## Stack

- Plain `HTML`, `CSS`, and `JavaScript`
- Cloudflare Pages for hosting
- Cloudflare Pages Functions for the counter API
- Cloudflare D1 for shared counter storage

## Local development

This project does not require a build tool.

Run a simple local server from the project root:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Note:

- The artwork generator works locally
- The shared print counter only works when deployed with the Cloudflare D1 binding

## Project structure

```text
.
├── index.html
├── styles.css
├── app.js
├── assets/
├── functions/
│   └── api/
│       └── counter.js
├── db/
│   └── schema.sql
└── wrangler.toml
```

## Deployment

Deploy with Cloudflare Pages.

Important settings:

- Framework preset: `None`
- Build command: leave empty, or use `echo "No build step"`
- Build output directory: `.`

The project uses:

- `functions/api/counter.js` for the shared counter endpoint
- `wrangler.toml` for D1 configuration
- `db/schema.sql` to initialize the counter table

For the detailed deployment notes, see:

- [DEPLOY.md](/Users/mazzaloth/Desktop/MAZZ/VibeCoding/UnknownPleasures/DEPLOY.md)

## Counter API

Available endpoints:

- `GET /api/counter`
- `POST /api/counter`

The front end reads the current count on load and increments it after each successful print action.

## License

No license file has been added yet.
