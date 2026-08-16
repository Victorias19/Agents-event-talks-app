/**
 * BigQuery Release Notes Explorer & Tweet Hub
 * Frontend Application Logic (Vanilla JavaScript)
 */

(function () {
    'use strict';

    // Application State
    const state = {
        feedData: null,
        filteredEntries: [],
        activeCategory: 'all',
        searchQuery: '',
        selectedItems: new Map(), // item.id -> item
        currentTweetItem: null,
        currentTemplate: 'launch',
        isRefreshing: false
    };

    // DOM Elements
    const elements = {
        refreshBtn: document.getElementById('refreshBtn'),
        refreshSpinner: document.getElementById('refreshSpinner'),
        refreshBtnText: document.getElementById('refreshBtnText'),
        feedStatusBadge: document.getElementById('feedStatusBadge'),
        lastUpdatedText: document.getElementById('lastUpdatedText'),
        
        statTotalEntries: document.getElementById('statTotalEntries'),
        statTotalItems: document.getElementById('statTotalItems'),
        statLatestDate: document.getElementById('statLatestDate'),
        
        searchInput: document.getElementById('searchInput'),
        clearSearchBtn: document.getElementById('clearSearchBtn'),
        categoryFilterContainer: document.getElementById('categoryFilterContainer'),
        
        countAll: document.getElementById('countAll'),
        countFeature: document.getElementById('countFeature'),
        countAnnouncement: document.getElementById('countAnnouncement'),
        countChange: document.getElementById('countChange'),
        countSecurity: document.getElementById('countSecurity'),
        countIssue: document.getElementById('countIssue'),
        
        selectionBar: document.getElementById('selectionBar'),
        selectedCountBadge: document.getElementById('selectedCountBadge'),
        tweetSelectedBtn: document.getElementById('tweetSelectedBtn'),
        clearSelectionBtn: document.getElementById('clearSelectionBtn'),
        
        feedList: document.getElementById('feedList'),
        emptyState: document.getElementById('emptyState'),
        resetFiltersBtn: document.getElementById('resetFiltersBtn'),
        
        // Tweet Modal Elements
        tweetModal: document.getElementById('tweetModal'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        cancelModalBtn: document.getElementById('cancelModalBtn'),
        modalSourceBadge: document.getElementById('modalSourceBadge'),
        modalSourceDate: document.getElementById('modalSourceDate'),
        modalSourceSnippet: document.getElementById('modalSourceSnippet'),
        tweetTextarea: document.getElementById('tweetTextarea'),
        charCountDisplay: document.getElementById('charCountDisplay'),
        charProgressCircle: document.getElementById('charProgressCircle'),
        copyTweetBtn: document.getElementById('copyTweetBtn'),
        postTweetIntentBtn: document.getElementById('postTweetIntentBtn'),
        hashtagPills: document.getElementById('hashtagPills'),
        templateChips: document.querySelectorAll('.template-chip'),
        
        toastContainer: document.getElementById('toastContainer')
    };

    // Initialize App
    document.addEventListener('DOMContentLoaded', () => {
        setupEventListeners();
        loadFeed(false);
    });

    /**
     * Set up all UI event listeners
     */
    function setupEventListeners() {
        // Refresh Button
        elements.refreshBtn.addEventListener('click', () => {
            if (!state.isRefreshing) {
                loadFeed(true);
            }
        });

        // Search Input
        elements.searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value.trim().toLowerCase();
            elements.clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
            filterAndRender();
        });

        elements.clearSearchBtn.addEventListener('click', () => {
            elements.searchInput.value = '';
            state.searchQuery = '';
            elements.clearSearchBtn.style.display = 'none';
            elements.searchInput.focus();
            filterAndRender();
        });

        // Category Filter Buttons
        elements.categoryFilterContainer.addEventListener('click', (e) => {
            const pill = e.target.closest('.pill');
            if (!pill) return;

            elements.categoryFilterContainer.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            state.activeCategory = pill.getAttribute('data-category');
            filterAndRender();
        });

        // Reset Filters Button
        elements.resetFiltersBtn.addEventListener('click', () => {
            elements.searchInput.value = '';
            state.searchQuery = '';
            elements.clearSearchBtn.style.display = 'none';
            state.activeCategory = 'all';

            elements.categoryFilterContainer.querySelectorAll('.pill').forEach(p => {
                p.classList.toggle('active', p.getAttribute('data-category') === 'all');
            });

            filterAndRender();
        });

        // Selection Bar Actions
        elements.clearSelectionBtn.addEventListener('click', () => {
            state.selectedItems.clear();
            updateSelectionUI();
            renderFeed();
        });

        elements.tweetSelectedBtn.addEventListener('click', () => {
            if (state.selectedItems.size === 0) return;
            const items = Array.from(state.selectedItems.values());
            openTweetModalForMultiple(items);
        });

        // Modal Close Actions
        elements.closeModalBtn.addEventListener('click', closeTweetModal);
        elements.cancelModalBtn.addEventListener('click', closeTweetModal);
        elements.tweetModal.addEventListener('click', (e) => {
            if (e.target === elements.tweetModal) {
                closeTweetModal();
            }
        });

        // Tweet Editor Real-time Input
        elements.tweetTextarea.addEventListener('input', updateCharCount);

        // Copy Tweet Button
        elements.copyTweetBtn.addEventListener('click', copyTweetToClipboard);

        // Post to Twitter / X Intent Button
        elements.postTweetIntentBtn.addEventListener('click', launchTwitterIntent);

        // Template Selection Chips
        elements.templateChips.forEach(chip => {
            chip.addEventListener('click', () => {
                elements.templateChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                state.currentTemplate = chip.getAttribute('data-template');
                generateTweetText();
            });
        });

        // Hashtag Picker Pills
        elements.hashtagPills.addEventListener('click', (e) => {
            const pill = e.target.closest('.hashtag-pill');
            if (!pill) return;

            const tag = pill.getAttribute('data-tag');
            toggleHashtag(tag, pill);
        });

        // Global Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            // Esc closes modal
            if (e.key === 'Escape' && elements.tweetModal.classList.contains('active')) {
                closeTweetModal();
            }
            // '/' focuses search when not typing in an input
            if (e.key === '/' && document.activeElement !== elements.searchInput && document.activeElement !== elements.tweetTextarea) {
                e.preventDefault();
                elements.searchInput.focus();
            }
        });
    }

    /**
     * Fetch feed data from Flask API
     */
    async function loadFeed(forceRefresh = false) {
        state.isRefreshing = true;
        setRefreshButtonLoading(true);

        if (forceRefresh) {
            showToast('Fetching latest BigQuery release notes from Google...', 'info');
        }

        try {
            const url = `/api/feed${forceRefresh ? '?force_refresh=true' : ''}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
            }

            const json = await response.json();
            if (json.status !== 'success' || !json.data) {
                throw new Error(json.message || 'Unknown response structure');
            }

            state.feedData = json.data;
            updateStatsBar(json.data);
            updateCategoryCounts(json.data);
            filterAndRender();

            // Status indication
            const fetchedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            elements.lastUpdatedText.textContent = `Updated ${fetchedTime}`;
            
            if (forceRefresh) {
                showToast(`Feed refreshed: ${json.data.total_entries} release dates (${json.data.total_items} updates)`, 'success');
            }
        } catch (error) {
            console.error('Error fetching release notes:', error);
            showToast(`Failed to load feed: ${error.message}`, 'error');
            elements.lastUpdatedText.textContent = 'Fetch failed';
        } finally {
            state.isRefreshing = false;
            setRefreshButtonLoading(false);
        }
    }

    /**
     * Update header & stats banner
     */
    function updateStatsBar(data) {
        elements.statTotalEntries.textContent = data.total_entries || 0;
        elements.statTotalItems.textContent = data.total_items || 0;
        if (data.entries && data.entries.length > 0) {
            elements.statLatestDate.textContent = data.entries[0].date;
        }
    }

    /**
     * Update category badge counts on filter pills
     */
    function updateCategoryCounts(data) {
        const counts = data.category_counts || {};
        elements.countAll.textContent = data.total_items || 0;
        elements.countFeature.textContent = counts['Feature'] || 0;
        elements.countAnnouncement.textContent = counts['Announcement'] || 0;
        elements.countChange.textContent = counts['Change'] || 0;
        elements.countSecurity.textContent = counts['Security'] || 0;
        elements.countIssue.textContent = counts['Issue'] || 0;
    }

    /**
     * Filter entries based on search query and active category
     */
    function filterAndRender() {
        if (!state.feedData || !state.feedData.entries) return;

        const q = state.searchQuery;
        const cat = state.activeCategory;

        const filtered = [];

        state.feedData.entries.forEach(entry => {
            // Filter items within entry
            const matchingItems = entry.items.filter(item => {
                // Category filter
                const matchesCategory = (cat === 'all' || item.category.toLowerCase() === cat.toLowerCase());
                if (!matchesCategory) return false;

                // Search query filter
                if (!q) return true;
                const searchHaystack = `${entry.date} ${item.category} ${item.text} ${item.tags.join(' ')}`.toLowerCase();
                return searchHaystack.includes(q);
            });

            if (matchingItems.length > 0) {
                filtered.push({
                    ...entry,
                    items: matchingItems
                });
            }
        });

        state.filteredEntries = filtered;
        renderFeed();
    }

    /**
     * Render the filtered release notes to the DOM
     */
    function renderFeed() {
        elements.feedList.innerHTML = '';

        if (state.filteredEntries.length === 0) {
            elements.emptyState.style.display = 'flex';
            return;
        }

        elements.emptyState.style.display = 'none';

        state.filteredEntries.forEach(entry => {
            const dateGroup = document.createElement('div');
            dateGroup.className = 'date-group';

            // Date Header
            const dateHeader = document.createElement('div');
            dateHeader.className = 'date-header';
            dateHeader.innerHTML = `
                <div class="date-header-left">
                    <span class="date-badge">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        ${escapeHtml(entry.date)}
                    </span>
                    <span class="date-item-count">(${entry.items.length} ${entry.items.length === 1 ? 'update' : 'updates'})</span>
                </div>
                <a href="${escapeHtml(entry.link)}" target="_blank" rel="noopener noreferrer" class="doc-permalink" title="View in Google Cloud Docs">
                    <span>Docs Anchor</span>
                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
            `;
            dateGroup.appendChild(dateHeader);

            // Cards Grid for items on this date
            const cardsGrid = document.createElement('div');
            cardsGrid.className = 'update-cards-grid';

            entry.items.forEach(item => {
                const card = createUpdateCard(item, entry);
                cardsGrid.appendChild(card);
            });

            dateGroup.appendChild(cardsGrid);
            elements.feedList.appendChild(dateGroup);
        });
    }

    /**
     * Create individual update card element
     */
    function createUpdateCard(item, entry) {
        const card = document.createElement('div');
        card.className = `update-card ${state.selectedItems.has(item.id) ? 'selected' : ''}`;
        card.setAttribute('data-id', item.id);

        const categoryLower = (item.category || 'update').toLowerCase();
        let badgeClass = 'badge-feature';
        if (categoryLower.includes('announcement')) badgeClass = 'badge-announcement';
        else if (categoryLower.includes('change')) badgeClass = 'badge-change';
        else if (categoryLower.includes('security')) badgeClass = 'badge-security';
        else if (categoryLower.includes('issue')) badgeClass = 'badge-issue';

        // Tags HTML
        let tagsHtml = '';
        if (item.tags && item.tags.length > 0) {
            tagsHtml = item.tags.map(tag => {
                const isGa = tag === 'GA';
                const isPreview = tag === 'Preview';
                const pillClass = isGa ? 'tag-ga' : (isPreview ? 'tag-preview' : '');
                return `<span class="tag-pill ${pillClass}">${escapeHtml(tag)}</span>`;
            }).join('');
        }

        const isChecked = state.selectedItems.has(item.id);

        card.innerHTML = `
            <div class="update-card-header">
                <div class="card-header-left">
                    <label class="custom-checkbox" title="Select to tweet multiple updates">
                        <input type="checkbox" class="item-select-checkbox" ${isChecked ? 'checked' : ''} data-item-id="${item.id}">
                        <span class="checkbox-mark"></span>
                    </label>
                    <span class="category-badge ${badgeClass}">${escapeHtml(item.category)}</span>
                    ${tagsHtml}
                </div>
                <div class="card-actions">
                    <button class="btn btn-tweet btn-xs tweet-single-btn" title="Tweet about this specific update">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        Tweet
                    </button>
                    <button class="btn btn-secondary btn-xs copy-card-text-btn" title="Copy text snippet">
                        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                </div>
            </div>
            <div class="update-card-body">
                ${item.html}
            </div>
        `;

        // Event: Checkbox selection
        const checkbox = card.querySelector('.item-select-checkbox');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                state.selectedItems.set(item.id, item);
                card.classList.add('selected');
            } else {
                state.selectedItems.delete(item.id);
                card.classList.remove('selected');
            }
            updateSelectionUI();
        });

        // Event: Single Tweet button
        const tweetBtn = card.querySelector('.tweet-single-btn');
        tweetBtn.addEventListener('click', () => {
            openTweetModalForSingle(item, entry);
        });

        // Event: Copy text button
        const copyBtn = card.querySelector('.copy-card-text-btn');
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(`${item.date} [${item.category}]: ${item.text} - ${item.doc_link || item.link}`).then(() => {
                showToast('Update text copied to clipboard', 'success');
            });
        });

        return card;
    }

    /**
     * Update selection action bar visibility & count
     */
    function updateSelectionUI() {
        const count = state.selectedItems.size;
        if (count > 0) {
            elements.selectionBar.style.display = 'flex';
            elements.selectedCountBadge.textContent = count;
        } else {
            elements.selectionBar.style.display = 'none';
        }
    }

    /**
     * Open Tweet Modal for a single update item
     */
    function openTweetModalForSingle(item, entry) {
        state.currentTweetItem = {
            isMultiple: false,
            items: [item],
            item: item,
            date: item.date || (entry ? entry.date : ''),
            category: item.category,
            snippet: item.summary || item.text,
            link: item.doc_link || item.link
        };

        elements.modalSourceBadge.textContent = item.category;
        elements.modalSourceBadge.className = `category-badge badge-${item.category.toLowerCase()}`;
        elements.modalSourceDate.textContent = state.currentTweetItem.date;
        elements.modalSourceSnippet.textContent = item.summary || item.text.substring(0, 140) + '...';

        // Reset template chips
        elements.templateChips.forEach(c => c.classList.remove('active'));
        const defaultChip = document.querySelector('.template-chip[data-template="launch"]');
        if (defaultChip) defaultChip.classList.add('active');
        state.currentTemplate = 'launch';

        generateTweetText();
        showTweetModal();
    }

    /**
     * Open Tweet Modal for multiple selected items
     */
    function openTweetModalForMultiple(items) {
        const first = items[0];
        state.currentTweetItem = {
            isMultiple: true,
            items: items,
            item: first,
            date: first.date,
            category: `${items.length} Updates`,
            snippet: items.map(i => `• [${i.category}] ${i.summary}`).join('\n'),
            link: first.link
        };

        elements.modalSourceBadge.textContent = `${items.length} Selected`;
        elements.modalSourceBadge.className = 'category-badge badge-feature';
        elements.modalSourceDate.textContent = `${items.length} updates selected`;
        elements.modalSourceSnippet.textContent = items.map(i => `• ${i.summary}`).slice(0, 3).join(' ') + (items.length > 3 ? '...' : '');

        // Select detailed template for multiple
        elements.templateChips.forEach(c => c.classList.remove('active'));
        const detailChip = document.querySelector('.template-chip[data-template="detailed"]');
        if (detailChip) detailChip.classList.add('active');
        state.currentTemplate = 'detailed';

        generateTweetText();
        showTweetModal();
    }

    /**
     * Generate formatted tweet text based on chosen template
     */
    function generateTweetText() {
        if (!state.currentTweetItem) return;

        const { isMultiple, items, item, date, link } = state.currentTweetItem;
        const activeTags = getActiveHashtags();
        const tagString = activeTags.length > 0 ? '\n\n' + activeTags.join(' ') : '';

        let tweet = '';

        if (isMultiple) {
            // Multiple items template
            const bullets = items.map(i => `• [${i.category}] ${i.summary}`).join('\n');
            tweet = `🚀 Google #BigQuery Updates (${date}):\n\n${bullets}\n\n🔗 ${link}${tagString}`;
        } else {
            const summary = item.summary || item.text;
            const docLink = item.doc_link || link;

            switch (state.currentTemplate) {
                case 'launch':
                    tweet = `🚀 New in Google #BigQuery (${date}):\n\n${summary}\n\n🔗 ${docLink}${tagString}`;
                    break;
                case 'feature':
                    tweet = `⚡ #BigQuery ${item.category} Update:\n\n${summary}\n\nCheck out the docs 👇\n${docLink}${tagString}`;
                    break;
                case 'tldr':
                    tweet = `💡 BigQuery Release (${date}): ${summary} 🔗 ${docLink}${tagString}`;
                    break;
                case 'detailed':
                    tweet = `📋 Google Cloud BigQuery Release Notes (${date}):\n\n• Category: ${item.category}\n• Details: ${summary}\n\nRead more: ${docLink}${tagString}`;
                    break;
                default:
                    tweet = `🚀 Google #BigQuery Update: ${summary} 🔗 ${docLink}${tagString}`;
            }
        }

        elements.tweetTextarea.value = tweet;
        updateCharCount();
        updateHashtagPillStates();
    }

    /**
     * Compute Twitter character count (URLs count as 23 chars on Twitter)
     */
    function calculateTwitterLength(text) {
        // Regex for URLs
        const urlRegex = /https?:\/\/[^\s]+/g;
        const textWithoutUrls = text.replace(urlRegex, '');
        const urlMatches = text.match(urlRegex) || [];
        const urlCount = urlMatches.length;
        
        return textWithoutUrls.length + (urlCount * 23);
    }

    /**
     * Update real-time character counter and SVG progress circle
     */
    function updateCharCount() {
        const text = elements.tweetTextarea.value;
        const length = calculateTwitterLength(text);
        const remaining = 280 - length;

        elements.charCountDisplay.textContent = `${remaining} left`;

        // Progress ring: radius is 10, circumference is 2 * PI * 10 = ~62.83
        const circumference = 62.83;
        const progress = Math.min(Math.max(length / 280, 0), 1);
        const offset = circumference - (progress * circumference);
        elements.charProgressCircle.style.strokeDashoffset = offset;

        // Color coding
        if (remaining < 0) {
            elements.charCountDisplay.className = 'char-count-text danger';
            elements.charProgressCircle.style.stroke = 'var(--cat-security)';
        } else if (remaining < 30) {
            elements.charCountDisplay.className = 'char-count-text warning';
            elements.charProgressCircle.style.stroke = 'var(--cat-change)';
        } else {
            elements.charCountDisplay.className = 'char-count-text';
            elements.charProgressCircle.style.stroke = 'var(--cat-feature)';
        }

        updateHashtagPillStates();
    }

    /**
     * Toggle hashtag in the tweet textarea
     */
    function toggleHashtag(tag, pill) {
        let text = elements.tweetTextarea.value;
        if (text.includes(tag)) {
            // Remove hashtag
            text = text.replace(new RegExp(`\\s*${tag}\\b`, 'g'), '');
            pill.classList.remove('selected');
        } else {
            // Add hashtag
            text = text.trim() + ' ' + tag;
            pill.classList.add('selected');
        }
        elements.tweetTextarea.value = text;
        updateCharCount();
    }

    /**
     * Get list of currently selected hashtags
     */
    function getActiveHashtags() {
        const tags = [];
        elements.hashtagPills.querySelectorAll('.hashtag-pill.selected').forEach(pill => {
            tags.push(pill.getAttribute('data-tag'));
        });
        return tags;
    }

    /**
     * Highlight hashtag pills present in the current tweet text
     */
    function updateHashtagPillStates() {
        const text = elements.tweetTextarea.value;
        elements.hashtagPills.querySelectorAll('.hashtag-pill').forEach(pill => {
            const tag = pill.getAttribute('data-tag');
            pill.classList.toggle('selected', text.includes(tag));
        });
    }

    /**
     * Copy current tweet text to clipboard
     */
    function copyTweetToClipboard() {
        const text = elements.tweetTextarea.value;
        if (!text) return;

        navigator.clipboard.writeText(text).then(() => {
            showToast('Tweet copied to clipboard!', 'success');
            elements.copyTweetBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Copied!</span>
            `;
            setTimeout(() => {
                elements.copyTweetBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    <span>Copy Text</span>
                `;
            }, 2000);
        }).catch(err => {
            console.error('Copy failed:', err);
            showToast('Could not copy to clipboard', 'error');
        });
    }

    /**
     * Open Twitter / X web intent dialog
     */
    function launchTwitterIntent() {
        const text = elements.tweetTextarea.value;
        if (!text.trim()) {
            showToast('Please enter tweet content first', 'error');
            return;
        }

        const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(intentUrl, '_blank', 'width=600,height=450,resizable=yes,scrollbars=yes');
        showToast('Opened Twitter / X share window', 'info');
    }

    /**
     * Show & Hide Modal
     */
    function showTweetModal() {
        elements.tweetModal.classList.add('active');
        elements.tweetModal.setAttribute('aria-hidden', 'false');
        elements.tweetTextarea.focus();
        document.body.style.overflow = 'hidden';
    }

    function closeTweetModal() {
        elements.tweetModal.classList.remove('active');
        elements.tweetModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    /**
     * Refresh Button UI loading state
     */
    function setRefreshButtonLoading(isLoading) {
        if (isLoading) {
            elements.refreshSpinner.classList.add('spinning');
            elements.refreshBtnText.textContent = 'Refreshing...';
            elements.refreshBtn.disabled = true;
        } else {
            elements.refreshSpinner.classList.remove('spinning');
            elements.refreshBtnText.textContent = 'Refresh';
            elements.refreshBtn.disabled = false;
        }
    }

    /**
     * Toast notification utility
     */
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let iconSvg = '';
        if (type === 'success') {
            iconSvg = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--cat-feature)" stroke-width="2.5" fill="none"><polyline points="20 6 9 17 4 12"/></svg>`;
        } else if (type === 'error') {
            iconSvg = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--cat-security)" stroke-width="2.5" fill="none"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
        } else {
            iconSvg = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--brand-blue-light)" stroke-width="2.5" fill="none"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
        }

        toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
        elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
            setTimeout(() => toast.remove(), 250);
        }, 3200);
    }

    /**
     * Helper: Escape HTML string
     */
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

})();
