/**
 * Watchlist Manager Application using TMDB API
 * 
 * Features:
 * - Import from Google Takeout (JSON) or Manual Entry
 * - Detailed TMDB data fetching (rating, posters, genres)
 * - Filtering, Sorting, and Search
 * - LocalStorage persistence
 */

const TMDB_SEARCH_URL = 'https://api.themoviedb.org/3/search/multi';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const OMDB_API_URL = 'https://www.omdbapi.com/';

// State Management
const state = {
  apiKey: localStorage.getItem('tmdb_api_key') || '',
  omdbKey: localStorage.getItem('omdb_api_key') || '',
  watchlist: JSON.parse(localStorage.getItem('watchlist_data') || '[]'),
  filters: {
    search: '',
    type: 'all',
    watched: 'all',
    genre: '',
    language: '',
    minRating: 0
  },
  sort: 'rating-desc',
  genres: new Set(),
  languages: new Set()
};

// DOM Elements
const elements = {
  // Buttons
  importBtn: document.getElementById('importBtn'),
  fetchDataBtn: document.getElementById('fetchDataBtn'),
  startImportBtn: document.getElementById('startImportBtn'),
  loadSampleBtn: document.getElementById('loadSampleBtn'),
  addManualBtn: document.getElementById('addManualBtn'),
  parseJsonBtn: document.getElementById('parseJsonBtn'),
  saveApiKeyBtn: document.getElementById('saveApiKey'),
  refreshRatingsBtn: document.getElementById('refreshRatingsBtn'),

  // Modals
  importModal: document.getElementById('importModal'),
  apiKeyModal: document.getElementById('apiKeyModal'),
  detailModal: document.getElementById('detailModal'),
  detailContent: document.getElementById('detailContent'),
  loadingOverlay: document.getElementById('loadingOverlay'),

  // Inputs
  fileInput: document.getElementById('fileInput'),
  manualInput: document.getElementById('manualInput'),
  jsonInput: document.getElementById('jsonInput'),
  apiKeyInput: document.getElementById('apiKeyInput'),

  // Filters
  searchInput: document.getElementById('searchInput'),
  typeFilterBtns: document.querySelectorAll('#typeFilter .toggle-btn'),
  sortSelect: document.getElementById('sortSelect'),
  genreFilter: document.getElementById('genreFilter'),
  languageFilter: document.getElementById('languageFilter'),
  ratingFilter: document.getElementById('ratingFilter'),
  ratingValueDisplay: document.getElementById('ratingValue'),
  clearFiltersBtn: document.getElementById('clearFilters'),

  // Display
  watchlistGrid: document.getElementById('watchlistGrid'),
  emptyState: document.getElementById('emptyState'),
  resultsCount: document.getElementById('resultsCount'),

  // Stats
  totalMovies: document.getElementById('totalMovies'),
  totalShows: document.getElementById('totalShows'),
  avgRating: document.getElementById('avgRating'),
  totalGenres: document.getElementById('totalGenres'),

  // Loading
  progressBar: document.getElementById('progressBar'),
  progressText: document.getElementById('progressText'),
  progressPercent: document.getElementById('progressPercent')
};

// --- Initialization ---

function init() {
  // Refresh API keys from localStorage (in case config.js set them after state init)
  state.apiKey = localStorage.getItem('tmdb_api_key') || '';
  state.omdbKey = localStorage.getItem('omdb_api_key') || '';

  setupEventListeners();
  updateStats();
  renderGrid();

  // Pre-fill API key inputs if keys exist (for editing)
  if (state.apiKey && elements.apiKeyInput) {
    elements.apiKeyInput.value = state.apiKey;
  }
  const omdbInput = document.getElementById('omdbKeyInput');
  if (state.omdbKey && omdbInput) {
    omdbInput.value = state.omdbKey;
  }

  // Check for API key
  if (state.apiKey) {
    elements.fetchDataBtn.disabled = state.watchlist.length === 0;
    if (elements.refreshRatingsBtn) elements.refreshRatingsBtn.disabled = state.watchlist.length === 0;
  } else {
    // No API keys found - show the modal to prompt user
    // Delay slightly to ensure page is loaded
    setTimeout(() => {
      showModal(elements.apiKeyModal);
    }, 500);
  }
}


function setupEventListeners() {
  // Modal Toggles
  elements.importBtn.addEventListener('click', () => showModal(elements.importModal));
  elements.startImportBtn.addEventListener('click', () => showModal(elements.importModal));

  // Settings button to open API key modal
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => showModal(elements.apiKeyModal));
  }

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-overlay');
      hideModal(modal);
    });
  });

  // Also close fix match modal specifically
  const closeFixBtn = document.getElementById('closeFixMatchModal');
  if (closeFixBtn) {
    closeFixBtn.addEventListener('click', () => {
      hideModal(document.getElementById('fixMatchModal'));
    });
  }

  // Import Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      e.target.classList.add('active');
      document.getElementById(`${e.target.dataset.tab}-tab`).classList.add('active');
    });
  });

  // File Upload
  const fileArea = document.getElementById('fileUploadArea');
  fileArea.addEventListener('click', () => elements.fileInput.click());
  fileArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileArea.classList.add('drag-over');
  });
  fileArea.addEventListener('dragleave', () => fileArea.classList.remove('drag-over'));
  fileArea.addEventListener('drop', handleFileDrop);
  elements.fileInput.addEventListener('change', handleFileSelect);

  // Data Actions
  elements.addManualBtn.addEventListener('click', handleManualImport);
  elements.parseJsonBtn.addEventListener('click', handleJsonImport);
  elements.loadSampleBtn.addEventListener('click', loadSampleData);
  elements.fetchDataBtn.addEventListener('click', () => fetchAllMetadata(false));
  if (elements.refreshRatingsBtn) {
    elements.refreshRatingsBtn.addEventListener('click', () => {
      // Auto-confirmed refresh
      fetchAllMetadata(true);
    });
  }
  elements.saveApiKeyBtn.addEventListener('click', saveApiKey);

  // Dedupe Action
  document.getElementById('dedupeBtn').addEventListener('click', removeDuplicates);

  // Clear All Action
  document.getElementById('clearAllBtn').addEventListener('click', clearAllData);

  // Filters
  elements.searchInput.addEventListener('input', (e) => updateFilter('search', e.target.value));

  elements.typeFilterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      elements.typeFilterBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      updateFilter('type', e.target.dataset.value);
    });
  });

  // Watched Filter
  const watchedFilterBtns = document.querySelectorAll('#watchedFilter .toggle-btn');
  watchedFilterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      watchedFilterBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      updateFilter('watched', e.target.dataset.value);
    });
  });

  elements.sortSelect.addEventListener('change', (e) => {
    state.sort = e.target.value;
    renderGrid();
  });

  elements.genreFilter.addEventListener('change', (e) => updateFilter('genre', e.target.value));
  elements.languageFilter.addEventListener('change', (e) => updateFilter('language', e.target.value));

  elements.ratingFilter.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    elements.ratingValueDisplay.textContent = val;
    e.target.style.setProperty('--value', (val / 10 * 100) + '%');
    updateFilter('minRating', val);
  });

  elements.clearFiltersBtn.addEventListener('click', clearFilters);

  // Pick For Me
  document.getElementById('pickForMeBtn').addEventListener('click', pickRandomMovie);
}

// --- Data Handling ---

function handleFileDrop(e) {
  e.preventDefault();
  document.getElementById('fileUploadArea').classList.remove('drag-over');

  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}

function processFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const json = JSON.parse(e.target.result);
      let items = [];

      if (Array.isArray(json)) {
        items = json.map(item => typeof item === 'string' ? { title: item } : item);
      } else if (json.bms_guideItem) {
        items = json.bms_guideItem.map(i => ({ title: i.title }));
      } else {
        const possibleKeys = Object.keys(json).filter(k => Array.isArray(json[k]));
        if (possibleKeys.length > 0) {
          items = json[possibleKeys[0]].map(item => ({
            title: item?.title || item?.header || item?.name || "Unknown"
          }));
        } else {
          showImportStatus('Error: Could not find a list of movies in this JSON.', true);
          return;
        }
      }

      importItems(items);
    } catch (err) {
      console.error(err);
      showImportStatus('Error: ' + err.message, true);
    }
  };
  reader.readAsText(file);
}

function handleManualImport() {
  const text = elements.manualInput.value;
  if (!text.trim()) return;

  const items = text.split('\n')
    .map(t => t.trim())
    .filter(t => t)
    .map(t => ({ title: t }));

  importItems(items);
  elements.manualInput.value = '';
  hideModal(elements.importModal);
}

function handleJsonImport() {
  try {
    const text = elements.jsonInput.value;
    const json = JSON.parse(text);
    let items = [];

    if (Array.isArray(json)) {
      items = json.map(item => typeof item === 'string' ? { title: item } : item);
    } else {
      console.error('JSON must be an array');
      return;
    }

    importItems(items);
    elements.jsonInput.value = '';
  } catch (e) {
    showImportStatus('Error: Invalid JSON syntax.', true);
  }
}

function loadSampleData() {
  const sample = [
    { title: "Inception" }, { title: "The Dark Knight" }, { title: "Interstellar" },
    { title: "Breaking Bad" }, { title: "Stranger Things" }, { title: "Parasite" },
    { title: "Spirited Away" }, { title: "The Godfather" }, { title: "Pulp Fiction" }
  ];
  importItems(sample);
}

function importItems(newItems) {
  // Deduplicate based on title
  const existingTitles = new Set(state.watchlist.map(i => i.title.toLowerCase()));
  let duplicatesCount = 0;

  const uniqueItems = newItems.filter(i => {
    const isDuplicate = existingTitles.has(i.title.toLowerCase());
    if (isDuplicate) duplicatesCount++;
    return !isDuplicate;
  });

  if (uniqueItems.length === 0) {
    showImportStatus(`No new items found. (${duplicatesCount} duplicates skipped)`, true);
    return;
  }

  // Add raw items (un-enriched)
  const formattedItems = uniqueItems.map(i => ({
    id: Date.now() + Math.random(),
    title: i.title,
    original_title: i.title, // fallback
    type: i.type || 'unknown',
    added_at: new Date().toISOString(),
    details_fetched: false
  }));

  state.watchlist = [...state.watchlist, ...formattedItems];
  saveState();
  updateStats();
  renderGrid();

  // Enable fetch button if we have raw items
  elements.fetchDataBtn.disabled = false;
  if (elements.refreshRatingsBtn) elements.refreshRatingsBtn.disabled = false;

  // Success Feedback & Close
  showImportStatus(`Success! Added ${formattedItems.length} movies.`, false);

  setTimeout(() => {
    hideModal(elements.importModal);
    showImportStatus('', false); // reset

    // Auto-fetch if key exists
    if (state.apiKey) {
      fetchAllMetadata();
    }
  }, 1500);
}

function removeDuplicates() {
  const originalCount = state.watchlist.length;
  const uniqueMap = new Map();

  // Keep the first instance of every title (prefer one with details fetched if possible)
  state.watchlist.forEach(item => {
    const key = item.title.toLowerCase().trim();
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, item);
    } else {
      // updates existing if current item has details and stored one doesn't
      if (item.details_fetched && !uniqueMap.get(key).details_fetched) {
        uniqueMap.set(key, item);
      }
    }
  });

  const newWatchlist = Array.from(uniqueMap.values());
  const removedCount = originalCount - newWatchlist.length; // Correct calculation

  if (removedCount > 0) {
    state.watchlist = newWatchlist;
    saveState();
    updateStats();
    renderGrid();
    console.log(`Cleanup complete! Removed ${removedCount} duplicate items.`);
  } else {
    console.log("Your watchlist is already clean! No duplicates found.");
  }
}

function clearAllData() {
  // Silent clear (no confirm)
  state.watchlist = [];
  saveState();
  updateStats();
  renderGrid();
  elements.fetchDataBtn.disabled = true;
  if (elements.refreshRatingsBtn) elements.refreshRatingsBtn.disabled = true;
  console.log('All data cleared!');
}

// --- API Integration ---

function saveApiKey() {
  const tmdbKey = elements.apiKeyInput.value.trim();
  const omdbInput = document.getElementById('omdbKeyInput');
  const omdbKey = omdbInput ? omdbInput.value.trim() : '';

  if (tmdbKey) {
    state.apiKey = tmdbKey;
    localStorage.setItem('tmdb_api_key', tmdbKey);
  }

  if (omdbKey) {
    state.omdbKey = omdbKey;
    localStorage.setItem('omdb_api_key', omdbKey);
  }

  if (tmdbKey || omdbKey) {
    hideModal(elements.apiKeyModal);
    if (state.watchlist.length > 0) {
      elements.fetchDataBtn.disabled = false;
      if (elements.refreshRatingsBtn) elements.refreshRatingsBtn.disabled = false;
    }
  }
}

async function fetchAllMetadata(forceAll = false) {
  if (!state.apiKey) {
    showModal(elements.apiKeyModal);
    return;
  }

  // If forceAll is false, pick items that either have NO metadata OR have metadata but are missing OMDb ratings
  const itemsToFetch = forceAll
    ? state.watchlist
    : state.watchlist.filter(i => !i.details_fetched || (state.omdbKey && !i.imdb_rating && !i.rt_rating));

  if (itemsToFetch.length === 0) {
    console.log(forceAll ? 'Your watchlist is empty.' : 'All items already have complete ratings and details.');
    return;
  }

  showLoading(true, itemsToFetch.length);

  let completed = 0;
  const errors = [];

  for (const item of itemsToFetch) {
    try {
      // Step 1: Fetch from TMDB (for posters, genres, metadata)
      const tmdbData = await searchTMDB(item.title);

      if (tmdbData) {
        const idx = state.watchlist.findIndex(w => w.id === item.id);
        if (idx !== -1) {
          const extracted = extractTMDBFields(tmdbData);

          // Step 2: Fetch from OMDb (for IMDb and RT ratings)
          const year = extracted.release_date ? extracted.release_date.substring(0, 4) : null;
          const omdbData = await fetchOMDbRatings(extracted.title, year);

          state.watchlist[idx] = {
            ...state.watchlist[idx],
            ...extracted,
            // Override with OMDb ratings if available
            imdb_rating: omdbData?.imdb_rating || null,
            imdb_id: omdbData?.imdb_id || null,
            rt_rating: omdbData?.rt_rating || null,
            details_fetched: true
          };
        }
      }
    } catch (err) {
      console.error(`Failed to fetch ${item.title}`, err);
      errors.push(item.title);
    }

    completed++;
    updateProgress(completed, itemsToFetch.length);

    // Slight delay to respect rate limits
    await new Promise(r => setTimeout(r, 300));
  }

  saveState();
  updateStats();
  renderGrid();
  showLoading(false);

  if (errors.length > 0) {
    console.warn(`Finished with ${errors.length} errors.`);
  }
}

async function searchTMDB(query) {
  const url = `${TMDB_SEARCH_URL}?api_key=${state.apiKey}&query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.results && data.results.length > 0) {
    // Prefer exact matches, otherwise first result
    // Also prefer movies/tv over people
    const filtered = data.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv');
    return filtered.length > 0 ? filtered[0] : data.results[0];
  }
  return null;
}

async function fetchOMDbRatings(title, year) {
  if (!state.omdbKey) return null;

  try {
    let url = `${OMDB_API_URL}?apikey=${state.omdbKey}&t=${encodeURIComponent(title)}`;
    if (year) url += `&y=${year}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.Response === 'True') {
      // Extract ratings
      let imdbRating = data.imdbRating !== 'N/A' ? parseFloat(data.imdbRating) : null;
      let rtRating = null;

      // Find Rotten Tomatoes in Ratings array
      if (data.Ratings) {
        const rt = data.Ratings.find(r => r.Source === 'Rotten Tomatoes');
        if (rt) {
          rtRating = parseInt(rt.Value); // "85%" -> 85
        }
      }

      return {
        imdb_rating: imdbRating,
        imdb_id: data.imdbID,
        rt_rating: rtRating,
        metacritic: data.Metascore !== 'N/A' ? parseInt(data.Metascore) : null
      };
    }
  } catch (e) {
    console.error('OMDb fetch error:', e);
  }
  return null;
}

function extractTMDBFields(data) {
  const isMovie = data.media_type === 'movie';
  return {
    tmdb_id: data.id,
    title: isMovie ? data.title : data.name,
    original_title: isMovie ? data.original_title : data.original_name,
    overview: data.overview,
    poster_path: data.poster_path,
    backdrop_path: data.backdrop_path,
    vote_average: data.vote_average, // Keep as fallback
    vote_count: data.vote_count,
    release_date: isMovie ? data.release_date : data.first_air_date,
    media_type: data.media_type, // 'movie' or 'tv'
    genre_ids: data.genre_ids,
    original_language: data.original_language,
    popularity: data.popularity
  };
}

/**
 * Composite Score Logic: 50% IMDb (0-10) + 50% Rotten Tomatoes (0-100 / 10).
 * If one is missing, use 100% of the other.
 */
function getCompositeScore(item) {
  const imdb = (item.imdb_rating && !isNaN(item.imdb_rating)) ? parseFloat(item.imdb_rating) : null;
  const rt = (item.rt_rating && !isNaN(item.rt_rating)) ? parseFloat(item.rt_rating) / 10 : null; // 0-100 -> 0-10

  if (imdb !== null && rt !== null) {
    return (imdb + rt) / 2;
  } else if (imdb !== null) {
    return imdb;
  } else if (rt !== null) {
    return rt;
  }
  return null;
}

// --- UI Rendering ---

function updateStats() {
  const items = state.watchlist;

  // Counts
  const movies = items.filter(i => i.media_type === 'movie').length;
  const shows = items.filter(i => i.media_type === 'tv').length;

  // Avg Rating (Composite Score)
  const ratedItems = items.map(i => getCompositeScore(i)).filter(s => s !== null);
  const avg = ratedItems.length ? (ratedItems.reduce((acc, s) => acc + s, 0) / ratedItems.length).toFixed(1) : '-';

  // Genres Mapping (Standard TMDB IDs)
  // We would ideally fetch the genre list from API, but hardcoding common ones for filter logic
  // For counting, we just collect all unique IDs found
  const allGenreIds = new Set();
  const allLangs = new Set();

  items.forEach(i => {
    if (i.genre_ids) i.genre_ids.forEach(id => allGenreIds.add(id));
    if (i.original_language) allLangs.add(i.original_language);
  });

  elements.totalMovies.textContent = movies;
  elements.totalShows.textContent = shows;
  elements.avgRating.textContent = avg;
  elements.totalGenres.textContent = allGenreIds.size;

  populateFilterDropdowns(allLangs);
}

// Genre Map for display
const GENRE_MAP = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
  10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
  10759: "Action & Adventure", 10762: "Kids", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics"
};

function populateFilterDropdowns(languages) {
  // Genres
  // Clear existing except first
  while (elements.genreFilter.options.length > 1) elements.genreFilter.remove(1);

  // Get unique genres present in data
  const presentGenres = new Set();
  state.watchlist.forEach(i => {
    if (i.genre_ids) i.genre_ids.forEach(id => presentGenres.add(id));
  });

  Object.entries(GENRE_MAP).forEach(([id, name]) => {
    if (presentGenres.has(parseInt(id))) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = name;
      elements.genreFilter.appendChild(opt);
    }
  });

  // Languages
  while (elements.languageFilter.options.length > 1) elements.languageFilter.remove(1);
  languages.forEach(lang => {
    const opt = document.createElement('option');
    opt.value = lang;
    opt.textContent = lang.toUpperCase();
    elements.languageFilter.appendChild(opt);
  });
}

function getFilteredAndSortedItems() {
  let items = [...state.watchlist];

  // Filter
  if (state.filters.search) {
    const term = state.filters.search.toLowerCase();
    items = items.filter(i => i.title.toLowerCase().includes(term));
  }

  if (state.filters.type !== 'all') {
    items = items.filter(i => i.media_type === state.filters.type);
  }

  if (state.filters.watched === 'watched') {
    items = items.filter(i => i.watched === true);
  } else if (state.filters.watched === 'unwatched') {
    items = items.filter(i => !i.watched);
  }

  if (state.filters.genre) {
    const gId = parseInt(state.filters.genre);
    items = items.filter(i => i.genre_ids && i.genre_ids.includes(gId));
  }

  if (state.filters.language) {
    items = items.filter(i => i.original_language === state.filters.language);
  }

  if (state.filters.minRating > 0) {
    // Filter by Composite Score
    items = items.filter(i => {
      const score = getCompositeScore(i);
      return score !== null && score >= state.filters.minRating;
    });
  }

  // Sort
  items.sort((a, b) => {
    const valA = getValueForSort(a, state.sort);
    const valB = getValueForSort(b, state.sort);

    if (state.sort.includes('desc')) return valA < valB ? 1 : -1;
    return valA > valB ? 1 : -1;
  });

  return items;
}

function getValueForSort(item, sortType) {
  // Use Composite Score for sorting
  if (sortType.includes('rating')) return getCompositeScore(item) || 0;
  if (sortType.includes('title')) return item.title.toLowerCase();
  if (sortType.includes('year')) return item.release_date || '0000';
  return 0;
}

function renderGrid() {
  const items = getFilteredAndSortedItems();
  elements.resultsCount.textContent = `Showing ${items.length} titles`;

  if (items.length === 0) {
    elements.watchlistGrid.innerHTML = '';
    if (state.watchlist.length === 0) {
      elements.watchlistGrid.appendChild(elements.emptyState);
      elements.emptyState.style.display = 'flex';
    } else {
      elements.emptyState.style.display = 'none';
      elements.watchlistGrid.innerHTML = '<div class="empty-search">No matches found</div>';
    }
    return;
  }

  elements.emptyState.style.display = 'none';
  elements.watchlistGrid.innerHTML = '';

  items.forEach(item => {
    const card = createCard(item);
    elements.watchlistGrid.appendChild(card);
  });
}

function pickRandomMovie() {
  const items = getFilteredAndSortedItems();
  if (items.length === 0) {
    console.log('No movies match your current filters! Try adjusting them.');
    return;
  }

  // Weighted random selection: favor higher rated movies slightly
  // Or just simple random for surprise factor. Let's go simple random for now but ensure it's fun.

  // Animation effect could go here, but for now just show result
  const randomIndex = Math.floor(Math.random() * items.length);
  const winner = items[randomIndex];

  showDetails(winner);

  // Add a little celebration effect text to the modal title temporarily
  const titleEl = document.querySelector('.detail-title');
  if (titleEl) {
    const originalText = titleEl.textContent;
    titleEl.innerHTML = `✨ MOOD MATCH ✨<br>${originalText}`;
  }
}

function createCard(item) {
  const div = document.createElement('div');
  div.className = 'card-item group relative glass rounded-2xl overflow-hidden glass-hover cursor-pointer group animate-in fade-in zoom-in duration-500' + (item.watched ? ' opacity-60' : '');
  div.onclick = () => showDetails(item);

  const posterUrl = item.poster_path ? TMDB_IMAGE_BASE + item.poster_path : null;
  const type = item.media_type === 'tv' ? 'TV' : 'Movie';
  const genres = item.genre_ids ? item.genre_ids.slice(0, 1).map(id => GENRE_MAP[id]).filter(Boolean).join(', ') : '';
  const year = item.release_date ? item.release_date.substring(0, 4) : '';
  const score = getCompositeScore(item);

  const scoreDisplay = (score !== null && score !== undefined && !isNaN(score)) ? `
    <div class="absolute bottom-3 left-3 bg-primary/90 text-white text-[11px] font-bold px-2 py-1 rounded-lg backdrop-blur shadow-lg shadow-primary/20 z-10 transition-transform group-hover:scale-110">
      RANK ${Number(score).toFixed(1)}
    </div>` : '';

  div.innerHTML = `
    <div class="aspect-[2/3] relative overflow-hidden">
        ${posterUrl ? `
          <img src="${posterUrl}" loading="lazy" alt="${item.title}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
        ` : `
          <div class="w-full h-full bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
            <svg class="w-8 h-8 text-slate-800 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4" stroke-width="1.5"/></svg>
            <span class="text-xs font-bold text-slate-700 leading-tight">${item.title}</span>
          </div>
        `}
        
        <!-- Overlays -->
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
        
        ${item.watched ? `
          <div class="absolute top-3 right-3 w-7 h-7 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm z-10">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>
          </div>
        ` : ''}
        
        ${scoreDisplay}
        
        <div class="absolute top-3 left-3 bg-black/50 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-white/10 backdrop-blur-md uppercase tracking-widest text-white/80 z-10">
          ${type}
        </div>

        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
           <div class="p-3 bg-primary text-white rounded-full shadow-2xl shadow-primary/50">
             <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path d="M12 4v16m8-8H4" class="hidden"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
           </div>
        </div>
    </div>
    
    <div class="p-4 space-y-2">
        <h3 class="font-bold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">${item.title}</h3>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">
            <span>${year}</span>
            <span class="w-1 h-1 bg-slate-700 rounded-full"></span>
            <span>${item.original_language ? item.original_language.toUpperCase() : '??'}</span>
          </div>
          ${item.imdb_rating ? `
            <div class="flex items-center gap-1 text-[10px] font-bold text-amber-500">
              <span class="text-[8px] opacity-70">IMDb</span> ${item.imdb_rating}
            </div>
          ` : ''}
        </div>
    </div>
  `;
  return div;
}

// --- Fix Match Logic ---

let currentItemToFix = null;

function showDetails(item) {
  currentItemToFix = item;
  const posterUrl = item.poster_path ? TMDB_IMAGE_BASE + item.poster_path : null;
  const genres = item.genre_ids ? item.genre_ids.map(id => GENRE_MAP[id]).filter(Boolean) : [];
  const score = getCompositeScore(item);

  elements.detailContent.innerHTML = '';

  // Left side: Poster
  const posterDiv = document.createElement('div');
  posterDiv.className = 'w-full md:w-2/5 aspect-[2/3] md:aspect-auto relative';
  posterDiv.innerHTML = posterUrl
    ? `<img src="${posterUrl}" alt="${item.title}" class="w-full h-full object-cover">`
    : `<div class="w-full h-full bg-slate-900 flex items-center justify-center text-slate-700">No Image</div>`;

  // Right side: Details
  const infoDiv = document.createElement('div');
  infoDiv.className = 'w-full md:w-3/5 p-8 md:p-12 space-y-8 max-h-[90vh] overflow-y-auto custom-scrollbar';

  // Header: Title & Badges
  const header = document.createElement('div');
  header.className = 'space-y-4';

  const tagsRow = document.createElement('div');
  tagsRow.className = 'flex flex-wrap gap-2';

  if (item.imdb_rating) {
    tagsRow.innerHTML += `<div class="bg-[#f5c518] text-black text-[10px] font-black px-2 py-1 rounded flex items-center gap-1">⭐ ${item.imdb_rating} <span class="opacity-60">IMDb</span></div>`;
  }
  if (item.rt_rating) {
    tagsRow.innerHTML += `<div class="bg-[#fa320a] text-white text-[10px] font-black px-2 py-1 rounded flex items-center gap-1">🍅 ${item.rt_rating}% <span class="opacity-60">RT</span></div>`;
  }
  if (score !== null && score !== undefined && !isNaN(score)) {
    tagsRow.innerHTML += `<div class="bg-primary text-white text-[10px] font-black px-2 py-1 rounded flex items-center gap-1 shadow-lg shadow-primary/40 uppercase tracking-tighter">Rank ${Number(score).toFixed(1)}</div>`;
  }

  header.innerHTML = `
    <div class="flex items-start justify-between gap-4">
      <h2 class="text-3xl md:text-5xl font-black tracking-tight leading-none">${item.title}</h2>
    </div>
  `;
  header.appendChild(tagsRow);

  // Meta: Year, Length, Lang
  const meta = document.createElement('div');
  meta.className = 'flex items-center gap-4 text-xs font-bold text-slate-500 uppercase tracking-widest';
  meta.innerHTML = `
    <span>${item.release_date || 'Unknown Year'}</span>
    <span class="w-1.5 h-1.5 bg-slate-800 rounded-full"></span>
    <span>${item.media_type === 'tv' ? 'TV Series' : 'Movie'}</span>
    <span class="w-1.5 h-1.5 bg-slate-800 rounded-full"></span>
    <span>${item.original_language ? item.original_language.toUpperCase() : '??'}</span>
  `;

  // Description
  const desc = document.createElement('div');
  desc.className = 'space-y-3';
  desc.innerHTML = `
    <h4 class="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">The Story</h4>
    <p class="text-slate-400 leading-relaxed text-sm md:text-base">${item.overview || 'Plot unknown.'}</p>
  `;

  // Categories
  const genresRow = document.createElement('div');
  genresRow.className = 'space-y-3';
  genresRow.innerHTML = `
    <h4 class="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Categories</h4>
    <div class="flex flex-wrap gap-2">
      ${genres.map(g => `<span class="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-slate-300 transition-colors hover:border-primary/50 cursor-default">${g}</span>`).join('')}
    </div>
  `;

  // Actions Footer
  const footer = document.createElement('div');
  footer.className = 'pt-8 border-t border-white/5 flex flex-col md:flex-row gap-4';

  const watchedBtn = document.createElement('button');
  watchedBtn.className = item.watched
    ? 'flex-1 btn-base bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
    : 'flex-1 btn-primary';
  watchedBtn.innerHTML = item.watched
    ? `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg> Was Viewed`
    : `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Mark as Viewed`;
  watchedBtn.onclick = () => toggleWatched(item.id);

  const fixBtn = document.createElement('button');
  fixBtn.className = 'btn-secondary px-6 shrink-0';
  fixBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg> Fix`;
  fixBtn.onclick = () => openFixMatchModal();

  footer.appendChild(watchedBtn);
  footer.appendChild(fixBtn);

  infoDiv.appendChild(header);
  infoDiv.appendChild(meta);
  infoDiv.appendChild(genresRow);
  infoDiv.appendChild(desc);
  infoDiv.appendChild(footer);

  elements.detailContent.appendChild(posterDiv);
  elements.detailContent.appendChild(infoDiv);

  showModal(elements.detailModal);
}

function toggleWatched(itemId) {
  const idx = state.watchlist.findIndex(i => i.id === itemId);
  if (idx !== -1) {
    state.watchlist[idx].watched = !state.watchlist[idx].watched;
    saveState();
    renderGrid();
    // Refresh detail view
    showDetails(state.watchlist[idx]);
  }
}

window.openFixMatchModal = function () {
  if (!currentItemToFix) return;

  const modal = document.getElementById('fixMatchModal');
  const input = document.getElementById('fixSearchInput');
  const btn = document.getElementById('fixSearchBtn');
  const resultsDiv = document.getElementById('fixResultsList');

  // Pre-fill input
  input.value = currentItemToFix.title;
  resultsDiv.innerHTML = '<div style="color:var(--text-secondary);text-align:center;padding:1rem;">Click search to find matching titles</div>';

  // one-off handler binding (simple way)
  btn.onclick = () => performFixSearch(input.value);

  // Allow enter key
  input.onkeyup = (e) => {
    if (e.key === 'Enter') performFixSearch(input.value);
  };

  showModal(modal);
  setTimeout(() => input.focus(), 100);
}

async function performFixSearch(query) {
  if (!query) return;
  const resultsDiv = document.getElementById('fixResultsList');
  resultsDiv.innerHTML = '<div class="loading-spinner" style="width:30px;height:30px;margin:20px auto;"></div>';

  try {
    const url = `${TMDB_SEARCH_URL}?api_key=${state.apiKey}&query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const data = await res.json();

    resultsDiv.innerHTML = '';

    if (!data.results || data.results.length === 0) {
      resultsDiv.innerHTML = '<div style="text-align:center;padding:1rem;">No results found.</div>';
      return;
    }

    const filtered = data.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv');

    filtered.forEach(result => {
      const isMovie = result.media_type === 'movie';
      const title = isMovie ? result.title : result.name;
      const date = isMovie ? result.release_date : result.first_air_date;
      const year = date ? date.split('-')[0] : 'N/A';
      const imgUrl = result.poster_path ? TMDB_IMAGE_BASE + result.poster_path : null;

      const div = document.createElement('div');
      div.className = 'flex items-center gap-4 p-4 glass rounded-2xl hover:bg-primary/10 hover:border-primary/30 transition-all cursor-pointer group';
      div.innerHTML = `
        <div class="w-16 aspect-[2/3] rounded-lg overflow-hidden shrink-0 text-white flex items-center justify-center">
            ${imgUrl ? `<img src="${imgUrl}" class="w-full h-full object-cover">` : '<div class="w-full h-full bg-slate-800"></div>'}
        </div>
        <div class="flex-1 min-w-0">
            <div class="font-bold truncate group-hover:text-primary transition-colors text-white text-sm">${title}</div>
            <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">${isMovie ? 'Movie' : 'TV Show'} • ${year} • ${result.original_language ? result.original_language.toUpperCase() : '??'}</div>
        </div>
      `;

      div.onclick = () => applyFixMatch(result);
      resultsDiv.appendChild(div);
    });

  } catch (e) {
    resultsDiv.innerHTML = '<div style="color:var(--danger)">Error searching. Check API Key.</div>';
  }
}

function applyFixMatch(newTmdbData) {
  if (!currentItemToFix) return;

  // find index in main list
  const idx = state.watchlist.findIndex(i => i.id === currentItemToFix.id);
  if (idx !== -1) {
    // Update data
    state.watchlist[idx] = {
      ...state.watchlist[idx],
      ...extractTMDBFields(newTmdbData),
      details_fetched: true
    };

    saveState();
    updateStats(); // re-calc stats
    renderGrid();

    // Refresh detail view
    showDetails(state.watchlist[idx]);

    // Close fix modal
    hideModal(document.getElementById('fixMatchModal'));
  }
}

// --- Helpers ---

function updateFilter(key, value) {
  state.filters[key] = value;
  renderGrid();
}

function clearFilters() {
  state.filters = {
    search: '',
    type: 'all',
    genre: '',
    language: '',
    minRating: 0
  };

  elements.searchInput.value = '';
  elements.typeFilterBtns.forEach(b => b.classList.remove('active'));
  elements.typeFilterBtns[0].classList.add('active'); // set All active
  elements.genreFilter.value = '';
  elements.languageFilter.value = '';
  elements.ratingFilter.value = 0;
  elements.ratingValueDisplay.textContent = '0';

  renderGrid();
}

function showModal(modal) {
  modal.classList.add('active');
}

function hideModal(modal) {
  modal.classList.remove('active');
}

function showLoading(show, total = 0) {
  if (show) {
    elements.loadingOverlay.classList.remove('opacity-0', 'invisible');
    elements.loadingOverlay.classList.add('opacity-100', 'visible');
    elements.progressBar.style.width = '0%';
    elements.progressText.textContent = `0 / ${total}`;
    if (elements.progressPercent) elements.progressPercent.textContent = '0%';
  } else {
    elements.loadingOverlay.classList.add('opacity-0', 'invisible');
    elements.loadingOverlay.classList.remove('opacity-100', 'visible');
  }
}

function updateProgress(current, total) {
  const pct = Math.round((current / total) * 100);
  elements.progressBar.style.width = `${pct}%`;
  elements.progressText.textContent = `Processing ${current} of ${total} items`;
  if (elements.progressPercent) elements.progressPercent.textContent = `${pct}%`;
}

function saveState() {
  localStorage.setItem('watchlist_data', JSON.stringify(state.watchlist));
}

function showImportStatus(msg, isError) {
  const el = document.getElementById('importFileStatus');
  if (el) {
    el.textContent = msg;
    el.className = isError
      ? 'text-center text-xs font-bold mt-4 p-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20'
      : 'text-center text-xs font-bold mt-4 p-3 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20';
    el.classList.remove('hidden');
  }
}

// Run
init();
