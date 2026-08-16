# Google BigQuery Release Notes Explorer & Tweet Hub

A lightweight, modern Python Flask web application built with plain vanilla HTML, CSS, and JavaScript. It automatically fetches, parses, categorizes, and displays Google Cloud BigQuery release notes from the official Atom XML feed with on-demand refresh and one-click Twitter / X sharing.

---

## 🌟 Key Features

1. **Live Feed Fetching & Atom XML Parsing**:
   - Parses `https://docs.cloud.google.com/feeds/bigquery-release-notes.xml`.
   - Extracts structured release dates, update categories (`Feature`, `Announcement`, `Change`, `Security`, `Issue`), status tags (`GA`, `Preview`, `SQL`, `AI/ML`), plain text summaries, and Google Cloud documentation links.
   - Built-in caching with 5-minute TTL to reduce latency and prevent rate-limiting.

2. **On-Demand Refresh with Active Spinner**:
   - Dedicated **"Refresh"** button featuring an animated SVG spinner.
   - Real-time timestamp updates and toast notifications on fresh fetch.

3. **Select & Tweet Update Workflow**:
   - **Single Update Tweet**: Click the **Tweet** button on any release card to open the tweet composer.
   - **Multi-Select Tweet**: Select multiple checkboxes across updates and compile them into a combined summary tweet.
   - **Tweet Templates**: Choose from preset styles (🚀 Launch, ⚡ Feature Focus, 💡 TL;DR, 📋 Detailed).
   - **280-Character Counter**: Real-time Twitter length tracking with an animated SVG circular progress meter and color transitions (green $\to$ yellow $\to$ red).
   - **Interactive Hashtag Pills**: Click `#BigQuery`, `#GoogleCloud`, `#GCP`, `#DataEngineering`, `#SQL`, or `#CloudData` to toggle them directly in the composer.
   - **One-Click Post**: Direct integration with `twitter.com/intent/tweet` to open pre-filled tweet drafts.
   - **Clipboard Copy**: Instant copy with visual feedback.

4. **Modern, Responsive Developer UI**:
   - Dark developer aesthetic using custom CSS variables.
   - Real-time instant search bar (`/` or `Ctrl+K` shortcut).
   - Category filtering pills with dynamic count badges.
   - Accessible semantic HTML with no heavy JavaScript frameworks or Tailwind dependencies.

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.10+ (tested on Python 3.14)

### 2. Install Dependencies
```bash
py -m pip install -r requirements.txt
```

### 3. Run the Web Application
```bash
py app.py
```

Open your browser at [http://127.0.0.1:5000](http://127.0.0.1:5000).

---

## 📁 Project Structure

```
agy-cli-projects/
├── app.py                     # Flask web server & API endpoints
├── feed_parser.py             # XML Atom feed parser & summarizer
├── requirements.txt           # Python dependencies (Flask, BeautifulSoup4, Requests)
├── templates/
│   └── index.html             # Vanilla HTML5 responsive template
├── static/
│   ├── css/
│   │   └── style.css          # Custom CSS design system
│   └── js/
│       └── app.js             # Vanilla JS state, search, modal & tweet intent logic
└── README.md
```
