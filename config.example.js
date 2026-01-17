// API Keys Configuration
// 
// HOW TO USE:
// 1. Copy this file and rename it to "config.js"
// 2. Get your FREE API keys:
//    - TMDB: https://www.themoviedb.org/settings/api (free account required)
//    - OMDB: https://www.omdbapi.com/apikey.aspx (free tier available)
// 3. Paste your keys below and save
//
// NOTE: If running the hosted version, you can enter keys directly in the app settings.

const CONFIG = {
  TMDB_API_KEY: 'YOUR_TMDB_API_KEY_HERE',
  OMDB_API_KEY: 'YOUR_OMDB_API_KEY_HERE'
};

// Auto-save keys to localStorage on load
if (CONFIG.TMDB_API_KEY && CONFIG.TMDB_API_KEY !== 'YOUR_TMDB_API_KEY_HERE') {
  localStorage.setItem('tmdb_api_key', CONFIG.TMDB_API_KEY);
}
if (CONFIG.OMDB_API_KEY && CONFIG.OMDB_API_KEY !== 'YOUR_OMDB_API_KEY_HERE') {
  localStorage.setItem('omdb_api_key', CONFIG.OMDB_API_KEY);
}
