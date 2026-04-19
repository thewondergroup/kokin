/* ==========================================================
   KOKIN · Live content loader
   ----------------------------------------------------------
   Shared script used by every page that reads live content
   from the Kokin Google Sheet tabs.
   
   Each tab is published as a separate CSV endpoint. This
   module exposes helpers for fetching + parsing CSVs and
   a small set of page-specific renderers.
   
   Base sheet ID is shared; each tab URL differs only by gid.
   Configure the URLs below to match your published sheet.
   
   If a fetch fails for any reason, the hardcoded HTML
   fallback remains visible — no errors shown to visitors.
   ========================================================== */

(function () {
  'use strict';
  
  // ---- CONFIG: replace each URL with the published CSV URL for that tab ----
  // To publish a tab: File → Share → Publish to web → select tab → CSV → Publish
  const SHEET_URLS = {
    hours:        'https://docs.google.com/spreadsheets/d/e/2PACX-1vTy0U0nxlKNRnDDf3X1kxJAM11wXWX2U1YJfx-wIe2epbxXGBd_JeOOUNFk7kbaby9LxUfbk1YLVjnh/pub?gid=1559040231&single=true&output=csv',
    contact:      'https://docs.google.com/spreadsheets/d/e/2PACX-1vTy0U0nxlKNRnDDf3X1kxJAM11wXWX2U1YJfx-wIe2epbxXGBd_JeOOUNFk7kbaby9LxUfbk1YLVjnh/pub?gid=2138542153&single=true&output=csv',
    events:       'https://docs.google.com/spreadsheets/d/e/2PACX-1vTy0U0nxlKNRnDDf3X1kxJAM11wXWX2U1YJfx-wIe2epbxXGBd_JeOOUNFk7kbaby9LxUfbk1YLVjnh/pub?gid=1868984358&single=true&output=csv',
    tunaCourses:  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTy0U0nxlKNRnDDf3X1kxJAM11wXWX2U1YJfx-wIe2epbxXGBd_JeOOUNFk7kbaby9LxUfbk1YLVjnh/pub?gid=1071491185&single=true&output=csv',
    brunchMenu:   'https://docs.google.com/spreadsheets/d/e/2PACX-1vTy0U0nxlKNRnDDf3X1kxJAM11wXWX2U1YJfx-wIe2epbxXGBd_JeOOUNFk7kbaby9LxUfbk1YLVjnh/pub?gid=747801009&single=true&output=csv',
    brunchDrinks: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTy0U0nxlKNRnDDf3X1kxJAM11wXWX2U1YJfx-wIe2epbxXGBd_JeOOUNFk7kbaby9LxUfbk1YLVjnh/pub?gid=1371178894&single=true&output=csv',
    faqs:         'https://docs.google.com/spreadsheets/d/e/2PACX-1vTy0U0nxlKNRnDDf3X1kxJAM11wXWX2U1YJfx-wIe2epbxXGBd_JeOOUNFk7kbaby9LxUfbk1YLVjnh/pub?gid=2090065718&single=true&output=csv'
  };

  // ---- CSV parsing (RFC-4180-ish, handles quoted fields) ----
  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], next = text[i + 1];
      if (inQuotes) {
        if (c === '"' && next === '"') { field += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else { field += c; }
      } else {
        if (c === '"') { inQuotes = true; }
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c === '\r') { /* skip */ }
        else { field += c; }
      }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function csvToObjects(text) {
    const rows = parseCSV(text).filter(r => r.some(c => c !== ''));
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).map(cols => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = (cols[i] || '').trim());
      return obj;
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function fetchCSV(key) {
    const url = SHEET_URLS[key];
    if (!url || url.indexOf('REPLACE_WITH_') === 0) return null;
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const text = await r.text();
      return csvToObjects(text);
    } catch (err) {
      console.warn('[Kokin] Failed to load', key, err);
      return null;
    }
  }

  // ---- Hours renderer (renders rows into the existing 3-col table) ----
  async function renderHours() {
    const target = document.querySelector('[data-live="hours"]');
    if (!target) return;
    const rows = await fetchCSV('hours');
    if (!rows || !rows.length) return;
    
    let html = '';
    rows.forEach(r => {
      const day = escapeHtml(r.Day);
      const isActive = r.Active && r.Active.toUpperCase() !== 'FALSE';
      const lunch = isActive && r.Lunch ? escapeHtml(r.Lunch) : 'Closed';
      const dinner = isActive && r.Dinner ? escapeHtml(r.Dinner) : 'Closed';
      const closedClass = !isActive ? ' closed' : '';
      html += '<div class="hours-row' + closedClass + '">' +
              '<div class="day">' + day + '</div>' +
              '<div class="time">' + lunch + '</div>' +
              '<div class="time">' + dinner + '</div>' +
              '</div>';
    });
    target.innerHTML = html;
  }

  // ---- Contact renderer (populates [data-live-contact="KeyName"] spans) ----
  async function renderContact() {
    const hasTargets = document.querySelector('[data-live-contact]');
    if (!hasTargets) return;
    const rows = await fetchCSV('contact');
    if (!rows || !rows.length) return;
    
    const values = {};
    rows.forEach(r => { values[r.Key] = r.Value; });
    
    document.querySelectorAll('[data-live-contact]').forEach(el => {
      const key = el.dataset.liveContact;
      if (values[key] != null) {
        // For <a> elements, also update href
        if (el.tagName === 'A') {
          if (key === 'Phone') el.href = 'tel:' + String(values[key]).replace(/\s/g, '');
          else if (key === 'Email') el.href = 'mailto:' + values[key];
          else if (key === 'BookingURL') el.href = values[key];
        }
        if (key !== 'BookingURL') el.textContent = values[key];
      }
    });
  }

  // ---- Events renderer (Tuna + Brunch top-level specs) ----
  async function renderEvents() {
    const hasTargets = document.querySelector('[data-live-event]');
    if (!hasTargets) return;
    const rows = await fetchCSV('events');
    if (!rows || !rows.length) return;
    
    const values = {};  // { 'Tuna.Price': '£107 pp', ... }
    rows.forEach(r => { 
      if (r.Event && r.Key) values[r.Event + '.' + r.Key] = r.Value; 
    });
    
    document.querySelectorAll('[data-live-event]').forEach(el => {
      const key = el.dataset.liveEvent;
      if (values[key] != null) el.textContent = values[key];
    });
  }

  // ---- Tuna courses list ----
  async function renderTunaCourses() {
    const target = document.querySelector('[data-live="tuna-courses"]');
    if (!target) return;
    const rows = await fetchCSV('tunaCourses');
    if (!rows || !rows.length) return;
    
    rows.sort((a, b) => (parseInt(a.Order) || 0) - (parseInt(b.Order) || 0));
    let html = '';
    rows.forEach(r => {
      html += '<li class="ts-course reveal">' +
              '<div class="ts-course-num">' + escapeHtml(r.Kanji) + '</div>' +
              '<div class="ts-course-body">' +
              '<h3>' + escapeHtml(r.Name) + '</h3>' +
              '<p>' + escapeHtml(r.Description) + '</p>' +
              '</div></li>';
    });
    target.innerHTML = html;
  }

  // ---- Brunch menu (3 courses) ----
  async function renderBrunchMenu() {
    const target = document.querySelector('[data-live="brunch-menu"]');
    if (!target) return;
    const rows = await fetchCSV('brunchMenu');
    if (!rows || !rows.length) return;
    
    rows.sort((a, b) => (parseInt(a.Order) || 0) - (parseInt(b.Order) || 0));
    let html = '';
    rows.forEach(r => {
      html += '<li class="ts-course reveal">' +
              '<div class="ts-course-num">' + escapeHtml(r.Kanji) + '</div>' +
              '<div class="ts-course-body">' +
              '<h3>' + escapeHtml(r.Name) + '</h3>' +
              '<p>' + escapeHtml(r.Description) + '</p>' +
              '</div></li>';
    });
    target.innerHTML = html;
  }

  // ---- Brunch drinks (two columns: Included + Premium) ----
  async function renderBrunchDrinks() {
    const includedTarget = document.querySelector('[data-live="brunch-drinks-included"]');
    const premiumTarget = document.querySelector('[data-live="brunch-drinks-premium"]');
    if (!includedTarget && !premiumTarget) return;
    const rows = await fetchCSV('brunchDrinks');
    if (!rows || !rows.length) return;
    
    const included = rows
      .filter(r => r.Category === 'Included')
      .sort((a, b) => (parseInt(a.Order) || 0) - (parseInt(b.Order) || 0));
    const premium = rows
      .filter(r => r.Category === 'Premium')
      .sort((a, b) => (parseInt(a.Order) || 0) - (parseInt(b.Order) || 0));
    
    function renderList(items) {
      return items.map(r => {
        const tag = r.IsMocktail && r.IsMocktail.toUpperCase() === 'TRUE'
          ? ' <span class="mocktail-tag">(mocktail)</span>'
          : '';
        return '<li>' + escapeHtml(r.Name) + tag + '</li>';
      }).join('');
    }
    
    if (includedTarget) includedTarget.innerHTML = renderList(included);
    if (premiumTarget) premiumTarget.innerHTML = renderList(premium);
  }

  // ---- FAQs ----
  async function renderFAQs() {
    const targets = document.querySelectorAll('[data-live="faqs"]');
    if (!targets.length) return;
    const rows = await fetchCSV('faqs');
    if (!rows || !rows.length) return;
    
    targets.forEach(target => {
      const page = target.dataset.faqPage;  // "Tuna" or "Brunch"
      const items = rows
        .filter(r => r.Page === page)
        .sort((a, b) => (parseInt(a.Order) || 0) - (parseInt(b.Order) || 0));
      if (!items.length) return;
      
      let html = '';
      items.forEach((r, i) => {
        const open = i === 0 ? ' open' : '';
        // Process answer: convert email addresses to mailto links
        const answer = escapeHtml(r.Answer).replace(
          /([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
          '<a href="mailto:$1">$1</a>'
        );
        html += '<details class="ts-faq-item"' + open + '>' +
                '<summary>' + escapeHtml(r.Question) + '</summary>' +
                '<p>' + answer + '</p></details>';
      });
      target.innerHTML = html;
    });
  }

  // ---- Run all on DOM ready ----
  function init() {
    renderHours();
    renderContact();
    renderEvents();
    renderTunaCourses();
    renderBrunchMenu();
    renderBrunchDrinks();
    renderFAQs();
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
