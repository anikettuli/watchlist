# Watchlist Manager & Mood Picker

A beautiful, premium web application to manage your movie/TV watchlist, enrich it with IMDb/TMDB ratings, and pick what to watch based on your mood.

## Features

- **Rank & Sort**: View your watchlist sorted by IMDb rating, release date, or title.
- **Mood Picker**: Filter by genre (e.g., "Sci-Fi", "Comedy") and hit "Pick for Me" to let the app randomly select a high-rated gem.
- **Rich Metadata**: Automatically fetches posters, summaries, genres, and ratings from TMDB.
- **Privacy First**: All data is stored locally in your browser. No external database.
- **Import Support**: 
  - Import directly from Google Takeout (`Search Contributions` JSON).
  - Paste a list of titles manually.
  - Upload a custom JSON/CSV.

## Setup

1. **Open the App**: Simply open `index.html` in your web browser (Chrome, Edge, Firefox).
2. **Get a Free API Key**:
   - The app uses TMDB (The Movie Database) for movie data.
   - You need a free API key (takes 1 minute).
   - Sign up at [themoviedb.org](https://www.themoviedb.org/signup).
   - Go to Settings -> API -> Request Key.
   - Copy the API Key (v3).
3. **Import Data**:
   - Click "Import Watchlist".
   - Drag & drop your Google Takeout JSON file, or paste a list of movies.
4. **Enjoy**: Filter, sort, and find your next favorite movie!

## Google Takeout Instructions

1. Go to [takeout.google.com](https://takeout.google.com).
2. Deselect all.
3. Find and check **"Search Contributions"** (this often contains the most reliable watchlist data) or **"Saved"**.
4. Download and extract the zip.
5. Upload the JSON file to this app.

## Deployment (GitHub Pages)

This app is a static site and can be hosted for free on GitHub Pages.

### Quick Steps

1. **Create a GitHub repo** (public, don't initialize with README)

2. **Push your code:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/watchlist.git
   git branch -M main
   git push -u origin main
   ```

3. **Enable GitHub Pages:**
   - Go to repo Settings → Pages
   - Source: Deploy from branch
   - Branch: `main` / `/ (root)`
   - Save

4. **Access your site** at: `https://YOUR_USERNAME.github.io/watchlist/`

### API Keys for Deployed Site

When users visit your deployed site, they'll be **automatically prompted** to enter their own API keys:
- **TMDB**: Free at [themoviedb.org](https://www.themoviedb.org/settings/api)
- **OMDb**: Free at [omdbapi.com](http://www.omdbapi.com/apikey.aspx)

Keys are stored in the user's browser (localStorage) and never leave their device.

### For Local Development

1. Copy `config.example.js` to `config.js`
2. Add your API keys to `config.js`
3. Open `index.html` in a browser
