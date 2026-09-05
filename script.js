/* ==========================================================================
   LUNAREADS — interactivity
   Independent, self-contained behaviours. All state (wishlist, active
   filter, search text) lives in memory only — there is no backend, no
   storage, and no fake "processing" of any purchase or account action.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const bookIndex = buildBookIndex();
  let wishlistedIds = new Set();
  let activeMoodFilter = null;

  initMobileNav();
  initScrolledHeader();
  initScrollReveal();
  initCoverTilt();
  initYear();

  initWishlist(bookIndex, wishlistedIds);
  initMoodFilter(bookIndex);
  initSearchOverlay(bookIndex, wishlistedIds);
  initBookModal(bookIndex, wishlistedIds);
  initTonightsRead(bookIndex);

  initGlobalEscapeHandler();
});

/* ---- Read the four book cards already in the DOM into a lookup object,
   so the rest of the script never has to duplicate that data by hand ---- */
function buildBookIndex() {
  const index = {};
  document.querySelectorAll(".book-card").forEach((card) => {
    const id = card.dataset.bookId;
    const coverEl = card.querySelector(".book-cover");
    const coverClass = Array.from(coverEl.classList).find((cls) =>
      cls.startsWith("cover-")
    );
    const starsEl = card.querySelector(".stars");

    index[id] = {
      id,
      title: card.dataset.title,
      author: card.dataset.author,
      genre: card.dataset.genre,
      price: card.querySelector(".book-price").textContent.trim(),
      rating: starsEl.style.getPropertyValue("--rating").trim(),
      coverClass,
      cardEl: card,
    };
  });
  return index;
}

function getBlurb(id) {
  const template = document.querySelector(`template[data-book-id="${id}"]`);
  return template ? template.content.cloneNode(true) : document.createTextNode("");
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/* ---- 1. Mobile navigation ---- */

function initMobileNav() {
  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("primaryNav");
  const backdrop = document.getElementById("navBackdrop");
  if (!toggle || !nav || !backdrop) return;

  const openMenu = () => {
    nav.classList.add("is-open");
    backdrop.classList.add("is-visible");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
    document.body.style.overflow = "hidden";
  };
  const closeMenu = () => {
    nav.classList.remove("is-open");
    backdrop.classList.remove("is-visible");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    document.body.style.overflow = "";
  };

  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    isOpen ? closeMenu() : openMenu();
  });
  backdrop.addEventListener("click", closeMenu);
  nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  window.addEventListener("resize", () => {
    if (window.innerWidth > 760) closeMenu();
  });

  // exposed so the global Escape handler can close it too
  window.__closeMobileNav = closeMenu;
  window.__isMobileNavOpen = () => toggle.getAttribute("aria-expanded") === "true";
}

/* ---- 2. Header background once scrolled ---- */

function initScrolledHeader() {
  const header = document.getElementById("siteHeader");
  if (!header) return;
  const update = () => header.classList.toggle("is-scrolled", window.scrollY > 12);
  update();
  window.addEventListener("scroll", update, { passive: true });
}

/* ---- 3. Scroll-triggered reveal for sections, cards and quotes ---- */

function initScrollReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  items.forEach((el) => observer.observe(el));
}

/* ---- 4. Subtle tilt on book covers, following the cursor ---- */

function initCoverTilt() {
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!canHover || reduceMotion) return;

  const MAX_TILT = 6; // degrees — kept small so it reads as premium, not gimmicky

  document.querySelectorAll(".book-card").forEach((card) => {
    const cover = card.querySelector(".book-cover");

    card.addEventListener("mousemove", (event) => {
      const rect = cover.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      cover.style.transform = `perspective(700px) rotateY(${x * MAX_TILT}deg) rotateX(${-y * MAX_TILT}deg) translateY(-2px)`;
    });

    card.addEventListener("mouseleave", () => {
      cover.style.transform = "";
    });
  });
}

/* ---- 5. Footer year ---- */

function initYear() {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

/* ---- 6. Wishlist toggle (in-memory only, no persistence) ---- */

function initWishlist(bookIndex, wishlistedIds) {
  const countEl = document.getElementById("wishlistCount");

  function refreshButton(id) {
    const isSaved = wishlistedIds.has(id);
    const book = bookIndex[id];
    if (book) {
      const btn = book.cardEl.querySelector(".wishlist-toggle");
      btn.setAttribute("aria-pressed", String(isSaved));
      btn.classList.add("just-toggled");
      window.setTimeout(() => btn.classList.remove("just-toggled"), 200);
    }
    countEl.textContent = String(wishlistedIds.size);

    const modalBtn = document.getElementById("modalWishlistBtn");
    if (modalBtn && modalBtn.dataset.bookId === id) {
      modalBtn.textContent = isSaved ? "Remove from Wishlist" : "Add to Wishlist";
    }
  }

  function toggle(id) {
    wishlistedIds.has(id) ? wishlistedIds.delete(id) : wishlistedIds.add(id);
    refreshButton(id);
  }

  document.querySelectorAll(".wishlist-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest(".book-card").dataset.bookId;
      toggle(id);
    });
  });

  // exposed for the modal's own wishlist button
  window.__toggleWishlist = toggle;
  window.__isWishlisted = (id) => wishlistedIds.has(id);
}

/* ---- 7. Mood filter (Explore by Mood cards + matching footer links) ---- */

function initMoodFilter(bookIndex) {
  const pillRow = document.getElementById("filterPillRow");
  const pillLabel = document.getElementById("filterPillLabel");
  const clearBtn = document.getElementById("clearFilterBtn");
  const noResults = document.getElementById("noResults");
  const featuredSection = document.getElementById("featured-books");

  function applyFilter(genre) {
    let anyVisible = false;
    Object.values(bookIndex).forEach(({ genre: bookGenre, cardEl }) => {
      const visible = !genre || bookGenre === genre;
      cardEl.hidden = !visible;
      if (visible) anyVisible = true;
    });
    noResults.hidden = anyVisible;
  }

  function setFilter(genre) {
    applyFilter(genre);
    pillLabel.textContent = genre;
    pillRow.hidden = false;
  }

  function clearFilter() {
    applyFilter(null);
    pillRow.hidden = true;
  }

  document.querySelectorAll("[data-mood-filter]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      setFilter(el.dataset.moodFilter);
      featuredSection.scrollIntoView({ behavior: "smooth" });
    });
  });

  clearBtn.addEventListener("click", clearFilter);
}

/* ---- 8. Search overlay: live filter over the four featured titles ---- */

function initSearchOverlay(bookIndex, wishlistedIds) {
  const overlay = document.getElementById("searchOverlay");
  const toggleBtn = document.getElementById("searchToggle");
  const closeBtn = document.getElementById("searchClose");
  const input = document.getElementById("searchInput");
  const resultsEl = document.getElementById("searchResults");
  let lastFocused = null;

  function renderResults(query) {
    const q = query.trim().toLowerCase();
    resultsEl.innerHTML = "";

    const matches = Object.values(bookIndex).filter(
      (book) =>
        !q ||
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q)
    );

    if (!q) {
      const hint = document.createElement("li");
      hint.className = "search-hint";
      hint.textContent = "Start typing to search all titles";
      resultsEl.appendChild(hint);
    }

    if (q && matches.length === 0) {
      const empty = document.createElement("li");
      empty.className = "search-empty";
      empty.textContent = `No stories found for "${query.trim()}".`;
      resultsEl.appendChild(empty);
      return;
    }

    matches.forEach((book) => {
      const li = document.createElement("li");
      li.className = "search-result-item";

      const info = document.createElement("div");
      info.className = "search-result-info";
      const title = document.createElement("p");
      title.className = "search-result-title";
      title.textContent = book.title;
      const author = document.createElement("p");
      author.className = "search-result-author";
      author.textContent = `${book.author} · ${book.price}`;
      info.append(title, author);

      const viewBtn = document.createElement("button");
      viewBtn.type = "button";
      viewBtn.textContent = "View";
      viewBtn.addEventListener("click", () => {
        closeOverlay();
        window.__openBookModal(book.id);
      });

      li.append(info, viewBtn);
      resultsEl.appendChild(li);
    });
  }

  function openOverlay() {
    lastFocused = document.activeElement;
    overlay.hidden = false;
    input.value = "";
    renderResults("");
    document.body.style.overflow = "hidden";
    window.setTimeout(() => input.focus(), 10);
  }

  function closeOverlay() {
    overlay.hidden = true;
    document.body.style.overflow = "";
    if (lastFocused) lastFocused.focus();
  }

  toggleBtn.addEventListener("click", openOverlay);
  closeBtn.addEventListener("click", closeOverlay);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeOverlay();
  });
  input.addEventListener("input", () => renderResults(input.value));

  window.__closeSearchOverlay = closeOverlay;
  window.__isSearchOverlayOpen = () => !overlay.hidden;
}

/* ---- 9. Book preview modal ---- */

function initBookModal(bookIndex, wishlistedIds) {
  const modal = document.getElementById("bookModal");
  const backdrop = document.getElementById("modalBackdrop");
  const closeBtn = document.getElementById("modalClose");
  const coverEl = document.getElementById("modalCover");
  const genreEl = document.getElementById("modalGenre");
  const titleEl = document.getElementById("modalTitle");
  const authorEl = document.getElementById("modalAuthor");
  const ratingEl = document.getElementById("modalRating");
  const blurbEl = document.getElementById("modalBlurb");
  const priceEl = document.getElementById("modalPrice");
  const wishlistBtn = document.getElementById("modalWishlistBtn");
  let lastFocused = null;

  function open(id) {
    const book = bookIndex[id];
    if (!book) return;

    coverEl.className = `modal-cover ${book.coverClass}`;
    genreEl.textContent = capitalize(book.genre);
    titleEl.textContent = book.title;
    authorEl.textContent = book.author;
    priceEl.textContent = book.price;

    ratingEl.innerHTML = "";
    const stars = document.createElement("span");
    stars.className = "stars";
    stars.style.setProperty("--rating", book.rating);
    const ratingNumber = document.createElement("span");
    ratingNumber.className = "rating-number";
    ratingNumber.textContent = book.rating;
    ratingEl.append(stars, ratingNumber);

    blurbEl.innerHTML = "";
    blurbEl.appendChild(getBlurb(id));

    wishlistBtn.dataset.bookId = id;
    wishlistBtn.textContent = window.__isWishlisted(id)
      ? "Remove from Wishlist"
      : "Add to Wishlist";

    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  }

  function close() {
    modal.hidden = true;
    document.body.style.overflow = "";
    if (lastFocused) lastFocused.focus();
  }

  document.querySelectorAll("[data-open-modal]").forEach((btn) => {
    btn.addEventListener("click", () => open(btn.dataset.openModal));
  });

  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  wishlistBtn.addEventListener("click", () => {
    window.__toggleWishlist(wishlistBtn.dataset.bookId);
  });

  window.__openBookModal = open;
  window.__closeBookModal = close;
  window.__isBookModalOpen = () => !modal.hidden;
}

/* ---- 10. Hero "Discover Tonight's Read" — opens a random book's preview ---- */

function initTonightsRead(bookIndex) {
  const btn = document.getElementById("tonightsReadBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const ids = Object.keys(bookIndex);
    const randomId = ids[Math.floor(Math.random() * ids.length)];
    window.__openBookModal(randomId);
  });
}

/* ---- 11. One Escape key closes whichever overlay is currently open ---- */

function initGlobalEscapeHandler() {
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    if (window.__isBookModalOpen && window.__isBookModalOpen()) {
      window.__closeBookModal();
    } else if (window.__isSearchOverlayOpen && window.__isSearchOverlayOpen()) {
      window.__closeSearchOverlay();
    } else if (window.__isMobileNavOpen && window.__isMobileNavOpen()) {
      window.__closeMobileNav();
    }
  });
}
