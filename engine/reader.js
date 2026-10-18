/* How To Trade — the reader. Classic script (works when opened from a file). Needs: page-flip (St.PageFlip),
   data/book.js (window.BOOK) and art.js (window.ART).
   Rules it follows (plan §9, §11, D27, D28):
   - every clickable thing is an <a> or <button>; children ignore pointer events (touch screens);
   - hovering a page corner does nothing; pages turn on a press-and-drag, the arrows, the keys or a swipe;
   - every page reference is a link that jumps to its page;
   - pages are laid out live from the screen size and settings; a fixed-height text box sits above a
     separate footer, so text never runs into the page number;
   - the book opens after the first chapters are laid out; the rest is laid out behind. */
(function () {
  "use strict";
  var B = window.BOOK, root = document.documentElement, body = document.body;
  var errors = [];
  window.addEventListener("error", function (e) { errors.push(String(e.message || e)); });
  if (!B || !window.St || !window.ART) { document.body.innerHTML = "<p style='color:#ecdcbc;padding:2em;font-family:Georgia,serif'>The book's files are incomplete. Keep index.html together with the engine and data folders.</p>"; return; }

  // ---------- storage (each viewer's own browser; may be unavailable) ----------
  var LS = {
    get: function (k) { try { return localStorage.getItem("howtotrade:" + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem("howtotrade:" + k, v); return true; } catch (e) { return false; } },
    del: function (k) { try { localStorage.removeItem("howtotrade:" + k); } catch (e) { } },
    json: function (k, d) { try { var v = JSON.parse(LS.get(k)); return v == null ? d : v; } catch (e) { return d; } }
  };

  // ---------- settings ----------
  var OPTIONS = {
    theme: [["antique", "Antique"], ["antique-light", "Antique light"], ["clean", "Clean paper"], ["sepia", "Sepia"], ["night", "Night"]],
    charts: [["classic", "Green / red"], ["teal", "Teal / red"], ["cb", "Colour-blind safe"], ["mono", "Monochrome"]],
    font: [["garamond", "Old-style book"], ["source", "Modern serif"], ["inter", "Clean sans"], ["atkinson", "Easy-read"], ["dyslexic", "Dyslexia-friendly"]],
    size: [["1", "A−−"], ["2", "A−"], ["3", "A"], ["4", "A+"], ["5", "A++"]],
    spacing: [["compact", "Compact"], ["normal", "Normal"], ["relaxed", "Relaxed"]],
    view: [["auto", "Auto"], ["two", "Two pages"], ["one", "One page"]],
    anim: [["realistic", "Realistic"], ["quick", "Quick"], ["off", "Off"]],
    pop: [["hover", "Hover + tap"], ["click", "Click / tap only"]],
    underline: [["first", "First use per page"], ["every", "Every use"], ["off", "Off"]]
  };
  var LABELS = { theme: "Page theme", charts: "Chart colours", font: "Font", size: "Text size", spacing: "Line spacing", view: "Page view", anim: "Page-turn animation", pop: "Pop-ups open on", underline: "Underline terms" };
  var DEFAULTS = { theme: "antique", charts: "classic", font: "garamond", size: "3", spacing: "normal", view: "auto", anim: "realistic", pop: "hover", underline: "first" };
  var RELAYOUT = { font: 1, size: 1, spacing: 1, view: 1 };
  var SIZE_MULT = { "1": 0.86, "2": 0.93, "3": 1, "4": 1.14, "5": 1.3 };
  var S = (function () {
    var saved = LS.json("settings", {}), s = {};
    Object.keys(DEFAULTS).forEach(function (k) { var v = saved[k] != null ? String(saved[k]) : DEFAULTS[k]; s[k] = OPTIONS[k].some(function (o) { return o[0] === v; }) ? v : DEFAULTS[k]; });
    return s;
  })();
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function flipTime() { if (S.anim === "off" || reduceMotion) return 1; return S.anim === "quick" ? 350 : 800; }
  function applyLook() {
    root.dataset.theme = S.theme; root.dataset.charts = S.charts; root.dataset.font = S.font; root.dataset.spacing = S.spacing; root.dataset.underline = S.underline;
    var age = S.theme === "antique" ? "medium" : S.theme === "antique-light" ? "light" : S.theme === "sepia" ? "sepia" : null;
    root.style.setProperty("--paper-img", age ? ART.paper(age, 11) : "none");
    root.style.setProperty("--paper-img-b", age ? ART.paper(age, 29) : "none");
  }

  // ---------- sizes ----------
  var W, H, SPREAD, SMALL;
  // the page size for a window size, without changing anything
  function sizeFor(vw, vh) {
    var small = vw < 820, spread = S.view === "two" ? vw >= 700 : S.view === "one" ? false : !small, w, h;
    if (spread) { w = Math.min(540, Math.floor((vw - 150) / 2)); h = Math.min(Math.round(w * 1.42), vh - 112); w = Math.round(h / 1.42); }
    else if (small) { w = Math.min(vw - 24, 480); h = Math.min(Math.round(w * 1.75), vh - 112); w = Math.min(w, Math.round(h / 1.36)); }
    else { w = Math.min(600, vw - 160); h = Math.min(Math.round(w * 1.42), vh - 112); w = Math.round(h / 1.42); }
    return { W: w, H: h, SPREAD: spread, SMALL: small };
  }
  function measure() {
    var n = sizeFor(window.innerWidth, window.innerHeight);
    W = n.W; H = n.H; SPREAD = n.SPREAD; SMALL = n.SMALL;
    root.style.setProperty("--pw", W + "px"); root.style.setProperty("--ph", H + "px");
    root.style.setProperty("--bt", Math.max(18, Math.round(W * 0.075)) + "px");
    root.style.setProperty("--fs", (Math.max(11.5, Math.min(17, W * 0.036)) * SIZE_MULT[S.size]).toFixed(2) + "px");
    var o = document.getElementById("open"); o.style.width = (SPREAD ? W * 2 : W) + "px"; o.style.height = H + "px";
    body.classList.toggle("small", SMALL);
  }

  // ---------- helpers ----------
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function $(id) { return document.getElementById(id); }
  var toastT;
  function toast(msg, ms) { var t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, ms || 2600); }

  // ---------- the flow: every block in reading order, with a stable position number ----------
  // Positions do not depend on the screen or the settings, so bookmarks, Back and "keep my place" survive a re-layout.
  var FLOW = [], SECS = [];
  (function buildFlow() {
    var toc = ["<h1 data-anchor='contents-top'>Contents</h1>", ART.flourish];
    var groups = [], cur = null;
    B.sections.forEach(function (sec) {
      var t = sec.toc; if (!t) return;
      if (t.level === "part" || !cur || (t.level === "back" && cur.kind !== "back")) { cur = { kind: t.level, lines: [] }; groups.push(cur); }
      cur.lines.push(tocLine(t.level, sec.id, t.label, t.planned));
      (sec.secs || []).forEach(function (s) { cur.lines.push(tocLine("sec", s.anchor, s.label)); });
    });
    groups.forEach(function (g) { toc.push("<ul class='toc'>" + g.lines.join("") + "</ul>"); });
    var contents = { id: "contents", kind: "contents", runL: B.title, runR: "Contents", recto: true, blocks: toc };
    SECS = [contents].concat(B.sections);
    SECS.forEach(function (sec, si) { sec.si = si; sec.blocks.forEach(function (html, bi) { FLOW.push({ si: si, html: html, first: bi === 0 }); }); });
  })();
  function tocLine(level, anchor, label, planned) {
    return "<li class='" + level + "'><button class='row' data-go='" + esc(anchor) + "'><span class='t'>" + label +
      (planned ? "<span class='planned'>· being written</span>" : "") + "</span><span class='lead'></span><span class='n'>…</span></button></li>";
  }

  // ---------- layout ----------
  // pb = the current page's text box (fixed height, used for measuring); ctn = where nodes go (pb, or a box
  // continued from the previous page).
  var measureEl = $("measure"), pages = [], meta = [], anchorPage = {}, pb = null, ctn = null, finished = document.createDocumentFragment();
  var layout = { done: false, startedMs: 0, firstMs: 0, doneMs: 0, gen: 0, memory: "", log: [] }, FLOW_POS = 0;
  function figureFill(node) {
    if (node.nodeType !== 1) return;
    var figs = node.matches("figure[data-fig]") ? [node] : node.querySelectorAll("figure[data-fig]");
    Array.prototype.forEach.call(figs, function (f) {
      var fr = f.querySelector(".plate-frame"), F = B.figures[f.dataset.fig];
      if (fr && F && !fr.dataset.filled) { fr.insertAdjacentHTML("beforeend", F.svg); fr.dataset.filled = "1"; }
    });
  }
  // ---------- page numbers that are only known after the layout ----------
  // Contents lines and "p. N" links get their numbers once the whole book is laid out. They are measured holding
  // the widest number possible (the widest digit in their own typeface, as many digits as the book can need), so
  // putting the real number in can only shorten a line and never push text past the bottom of a page (17 Oct: the
  // "…" placeholder was narrower, and filled-in numbers overflowed up to 10 contents pages).
  var NUM_DIGITS = 3, WIDE = null, NUM_CTX = ["part", "ch", "sec", "front", "back"];
  function digitsFor(n) { return Math.max(3, String(Math.max(1, Math.ceil(n))).length); }
  function probeWide() {
    var rep = function (d) { var t = ""; for (var k = 0; k < NUM_DIGITS; k++) t += d; return t; }, h = "<ul class='toc'>", d;
    NUM_CTX.forEach(function (c) { for (d = 0; d < 10; d++) h += "<li class='" + c + "'><button class='row'><span class='t'>x</span><span class='lead'></span><span class='n' data-c='" + c + "' data-d='" + d + "'>" + rep(d) + "</span></button></li>"; });
    h += "</ul><p>";
    for (d = 0; d < 10; d++) h += "<button class='pref' data-c='pref' data-d='" + d + "'>p. " + rep(d) + "</button> <em><button class='pref' data-c='pref-i' data-d='" + d + "'>p. " + rep(d) + "</button></em> ";
    var el = document.createElement("div"); el.className = "page paper odd"; el.style.width = W + "px"; el.style.height = H + "px";
    el.innerHTML = "<div class='pg'><div class='body'>" + h + "</p></div></div>"; measureEl.appendChild(el);
    var best = {};
    Array.prototype.forEach.call(el.querySelectorAll("[data-c]"), function (x) { var w = x.getBoundingClientRect().width, c = x.dataset.c; if (!best[c] || w > best[c].w) best[c] = { w: w, d: x.dataset.d }; });
    measureEl.removeChild(el);
    var out = {}; Object.keys(best).forEach(function (c) { out[c] = rep(best[c].d); }); return out;
  }
  function widen(node) {
    if (node.nodeType !== 1 || !WIDE) return;
    Array.prototype.forEach.call(node.querySelectorAll("button[data-go] .n"), function (x) { var li = x.closest("li"), c = li && NUM_CTX.filter(function (k) { return li.classList.contains(k); })[0]; x.textContent = WIDE[c || "ch"]; });
    Array.prototype.forEach.call(node.querySelectorAll("button.pref"), function (x) { x.textContent = "p. " + WIDE[x.closest("em, i, figcaption") ? "pref-i" : "pref"]; });
  }
  var posStart = [];
  function closePage() {
    if (!pb) return;
    var pg = pages[pages.length - 1], seen = {}, pi = pages.length - 1;
    Array.prototype.forEach.call(pg.querySelectorAll("button[data-go] .n"), function (x) { x.textContent = "…"; });
    Array.prototype.forEach.call(pg.querySelectorAll("button.pref"), function (x) { x.textContent = "p. …"; });
    Array.prototype.forEach.call(pb.querySelectorAll('[data-bp]'), function (n) { var q = +n.dataset.bp; if (posStart[q] === undefined) posStart[q] = pi; });
    // where each link target is: the first finished page that holds it (17 Oct review: recording it while placing
    // pointed glossary links one page early when an entry's empty start was moved to the next page)
    Array.prototype.forEach.call(pb.querySelectorAll('[data-anchor]'), function (n) { if (anchorPage[n.dataset.anchor] === undefined) anchorPage[n.dataset.anchor] = pi; });
    Array.prototype.forEach.call(pg.querySelectorAll("button.term"), function (b) { if (!seen[b.dataset.term]) { seen[b.dataset.term] = 1; b.classList.add("first"); } });
    if (pg.parentNode === measureEl) finished.appendChild(pg); // finished pages leave the measuring area (engine test: 15 s -> 2.5 s)
    pb = ctn = null;
  }
  function setRunheads(pg, idx, sec) {
    var rh = pg.querySelectorAll(".runhead span"); if (!rh.length) return;
    var left = SPREAD && idx % 2 === 1;
    rh[0].textContent = sec && left ? sec.runL || "" : ""; rh[1].textContent = sec && !left ? sec.runR || "" : "";
  }
  function newPage(kind, sec) {
    closePage();
    var el = document.createElement("div"), idx = pages.length;
    el.className = "page " + kind; el.style.width = W + "px"; el.style.height = H + "px";
    if (kind.indexOf("hard") === 0) el.dataset.density = "hard";
    pages.push(el); meta.push({ kind: kind, si: sec ? sec.si : -1, firstPos: FLOW_POS });
    if (kind === "paper") {
      el.classList.add(SPREAD ? (idx % 2 ? "odd" : "even") : "odd");
      el.innerHTML = "<div class='pg'><div class='runhead'><span></span><span></span></div><div class='body'></div><div class='folio'></div></div>";
      setRunheads(el, idx, sec);
      measureEl.appendChild(el);
      pb = ctn = el.querySelector(".body");
    }
    return el;
  }
  function fits() { return memBit(function () { return pb.scrollHeight <= pb.clientHeight + 0.5; }); }
  function pageEmpty() { return !pb.firstChild || (pb.childNodes.length === 1 && pb.firstChild === ctn && !ctn.firstChild); }
  // Sentence boundaries in a paragraph's HTML: after . ! ? ; or : (optionally followed by a closing quote or
  // bracket), then whitespace, then a capital, digit, opening quote, bracket or tag. Only between complete elements:
  // never inside a link, a glossary word or italics (17 Oct review: a split inside "p. 000" left "000" on the next
  // page), and never after an HTML entity such as &amp;.
  function sentences(html) { return cutAt(html, function (before, next) { return /[.!?;:]["”’)]?$/.test(before) && !/&[a-z0-9#]+;$/i.test(before) && /[A-Z0-9“"(‘<]/.test(next); }); }
  function cutAt(html, ok) {
    var out = [], depth = 0, i = 0, a = 0, L = html.length;
    while (i < L) {
      var c = html.charAt(i);
      if (c === "<") {
        var j = html.indexOf(">", i); if (j < 0) break;
        var tag = html.slice(i + 1, j);
        if (tag.charAt(0) === "/") depth--; else if (!/\/$/.test(tag) && !/^(br|img|wbr|hr)\b/i.test(tag)) depth++;
        i = j + 1; continue;
      }
      if (depth === 0 && /\s/.test(c)) {
        var k = i; while (k < L && /\s/.test(html.charAt(k))) k++;
        if (i > a && k < L && ok(html.slice(a, i), html.charAt(k))) { out.push(html.slice(a, i)); a = k; }
        i = k; continue;
      }
      i++;
    }
    out.push(html.slice(a));
    return out;
  }
  function emptyLike(node) { return node.cloneNode(false); } // keeps data-anchor: the first finished page holding it wins
  // move to a fresh page; if we are inside a box, continue the box there
  function nextPage(sec, box) {
    if (ctn !== pb && !ctn.firstChild) ctn.parentNode.removeChild(ctn);
    // A box must not leave only its title behind ("Key idea" alone at the foot of a page, chapter 8 screenshots):
    // the box starts on the next page instead, with a heading that sat right above it. Only when the page keeps
    // other text, so a box that cannot fit on a fresh page is never moved twice.
    var carry = [];
    if (box && ctn !== pb && ctn.parentNode === pb && onlyTitle(ctn)) {
      var prev = ctn.previousElementSibling, withHead = prev && (HEAD[prev.tagName] || prev.classList.contains("letter-head"));
      var keep = pb.childElementCount - 1 - (withHead ? 1 : 0);
      if (keep > 0) { if (withHead) carry.push(prev); carry.push(ctn); carry.forEach(function (n) { pb.removeChild(n); }); }
    }
    newPage("paper", sec);
    if (carry.length) { carry.forEach(function (n) { pb.appendChild(n); }); ctn = carry[carry.length - 1]; return; }
    if (box) { var b = emptyLike(box); b.classList.add("cont"); pb.appendChild(b); ctn = b; }
  }
  function onlyTitle(el) {
    for (var k = el.firstChild; k; k = k.nextSibling) {
      if (k.nodeType === 1 && !k.classList.contains("box-title")) return false;
      if (k.nodeType === 3 && k.textContent.trim()) return false;
    }
    return !!el.firstElementChild;
  }
  var HEAD = { H2: 1, H3: 1, H4: 1 };
  function usedHeight(node) { return node.getBoundingClientRect().bottom - pb.getBoundingClientRect().top; }
  // Place one node, splitting it across pages where possible.
  function place(node, sec, box) {
    ctn.appendChild(node);
    if (fits()) {
      if ((HEAD[node.tagName] || node.classList.contains("letter-head")) && !pageEmpty() && node !== pb.firstChild && memBit(function () { return pb.clientHeight - usedHeight(node) < parseFloat(getComputedStyle(pb).lineHeight) * 2.6; })) {
        ctn.removeChild(node); nextPage(sec, box); ctn.appendChild(node); // keep a heading with the text after it
      }
      return;
    }
    ctn.removeChild(node);
    var tag = node.tagName;
    if (tag === "P") return splitP(node, sec, box, true);
    if ((tag === "UL" || tag === "OL") && node.children.length) return splitList(node, sec, box);
    if (tag === "TABLE" && node.tBodies.length && node.tBodies[0].rows.length > 1) return splitTable(node, sec, box);
    if (tag === "DIV" && (node.classList.contains("box") || node.classList.contains("gloss-entry")) && node.children.length > 1) return splitBox(node, sec); // a long glossary entry splits like a box
    if (pageEmpty()) { ctn.appendChild(node); if (!fits()) shrinkToFit(node); return; } // taller than an empty page
    nextPage(sec, box); ctn.appendChild(node); if (!fits()) shrinkToFit(node);
  }
  function shrinkToFit(node) { var svg = node.querySelector && node.querySelector("svg"); if (svg) svg.style.maxHeight = memNum(function () { var room = pb.clientHeight - (pb.scrollHeight - svg.getBoundingClientRect().height); return Math.max(80, room - 4); }) + "px"; }
  // Split a paragraph at sentence boundaries. A halving search finds how many sentences fit, so a split costs a
  // few measurements instead of one per sentence (stress test). `knownTooBig`: the caller already saw the whole
  // paragraph overflow this page. `brk`: how to move to the next page (a list item continues inside a list).
  // A sentence taller than a whole page is cut finer (at semicolons, then commas, then spaces) instead of overflowing.
  function splitP(node, sec, box, knownTooBig, brk) {
    brk = brk || function () { nextPage(sec, box); };
    var parts = sentences(node.innerHTML), start = 0, first = true, skipWhole = !!knownTooBig, brokeAt = -1;
    while (start < parts.length) {
      var emptyBefore = pageEmpty(); // measured BEFORE our own placeholder is added
      var p = first ? node.cloneNode(false) : emptyLike(node);
      if (!first) { p.classList.add("cont"); p.classList.remove("dropcap"); }
      ctn.appendChild(p);
      if (!skipWhole) { p.innerHTML = parts.slice(start).join(" "); if (fits()) return; }
      skipWhole = false; // only a check made on this same page with this same text can be reused
      var lo = 0, hi = parts.length - start - 1; // the whole rest is known not to fit here
      while (lo < hi) { var mid = (lo + hi + 1) >> 1; p.innerHTML = parts.slice(start, start + mid).join(" "); if (fits()) lo = mid; else hi = mid - 1; }
      var n = lo;
      if (n === 0) {
        if (emptyBefore || brokeAt === start) {
          var finer = refine(parts[start]);
          if (finer.length > 1) { ctn.removeChild(p); parts.splice.apply(parts, [start, 1].concat(finer)); skipWhole = true; continue; }
          n = 1; // one word taller than an empty page: keep it; the overflow test flags it
        } else { ctn.removeChild(p); brk(); brokeAt = start; continue; }
      }
      p.innerHTML = parts.slice(start, start + n).join(" ");
      first = false; start += n;
      if (start < parts.length) { brk(); brokeAt = start; }
    }
  }
  // Finer cut points in a piece of HTML, only between complete elements (never inside a tag or a link): after
  // semicolons if there are any, else after commas, else at spaces.
  function refine(html) {
    var semi = cutAt(html, function (b) { return /;$/.test(b) && !/&[a-z0-9#]+;$/i.test(b); });
    if (semi.length > 1) return semi;
    var comma = cutAt(html, function (b) { return /,$/.test(b); });
    if (comma.length > 1) return comma;
    return cutAt(html, function () { return true; });
  }
  function splitList(node, sec, box) {
    var items = Array.prototype.slice.call(node.children), l = node.cloneNode(false), start = node.start || 1;
    function freshList(i) { nextPage(sec, box); l = emptyLike(node); if (node.tagName === "OL") l.start = start + i; ctn.appendChild(l); }
    ctn.appendChild(l);
    for (var i = 0; i < items.length; i++) {
      l.appendChild(items[i]);
      if (!fits()) {
        l.removeChild(items[i]); if (!l.children.length) ctn.removeChild(l);
        freshList(i); l.appendChild(items[i]);
        if (!fits()) { // this one item is taller than a whole page: split it at sentences, continuing in the list
          l.removeChild(items[i]); ctn = l;
          splitP(items[i], sec, box, true, (function (k) { return function () { freshList(k); ctn = l; }; })(i));
          ctn = l.parentNode;
        }
      }
    }
  }
  function splitTable(node, sec, box) {
    var head = node.tHead, rows = Array.prototype.slice.call(node.tBodies[0].rows);
    var labels = head && head.rows.length ? Array.prototype.map.call(head.rows[0].cells, function (c) { return c.innerHTML; }) : [];
    function fresh(first) { var t = first ? node.cloneNode(false) : emptyLike(node); if (!first) t.classList.add("cont"); if (head) t.appendChild(head.cloneNode(true)); var tb = document.createElement("tbody"); t.appendChild(tb); ctn.appendChild(t); return tb; }
    // A row taller than a whole page cannot be split as a row; it is set instead as a box of labelled paragraphs
    // ("Fact: …", "Value: …"), which can split across pages like any box (17 Oct: a long facts-table row at the
    // largest dyslexia-font size was taller than the page).
    function card(row) {
      var d = document.createElement("div"); d.className = "box box-rowcard";
      if (node.hasAttribute("data-bp")) d.setAttribute("data-bp", node.getAttribute("data-bp"));
      Array.prototype.forEach.call(row.cells, function (c, k) { var p = document.createElement("p"); p.innerHTML = (labels[k] ? "<span class='rc-h'>" + labels[k] + ": </span>" : "") + c.innerHTML; d.appendChild(p); });
      return d;
    }
    var tb = fresh(true), kept = false; // kept: a part of the table with rows has been left on an earlier page
    for (var i = 0; i < rows.length; i++) {
      tb.appendChild(rows[i]);
      if (fits()) continue;
      tb.removeChild(rows[i]);
      if (!tb.rows.length) ctn.removeChild(tb.parentNode); else kept = true;
      nextPage(sec, box); tb = fresh(!kept); tb.appendChild(rows[i]); // no part left behind: this is still the table's start
      if (fits()) continue;
      ctn.removeChild(tb.parentNode); // too tall even alone on an empty page
      place(card(rows[i]), sec, box);
      kept = true; tb = fresh(false);
    }
    if (!tb.rows.length && tb.parentNode.parentNode) tb.parentNode.parentNode.removeChild(tb.parentNode); // no empty table left behind
  }
  function splitBox(node, sec) {
    var kids = Array.prototype.slice.call(node.childNodes).filter(function (k) { return k.nodeType === 1 || k.textContent.trim(); });
    var b = node.cloneNode(false); ctn.appendChild(b); ctn = b;
    for (var i = 0; i < kids.length; i++) { if (kids[i].nodeType === 3) { ctn.appendChild(kids[i]); continue; } place(kids[i], sec, node); }
    ctn = pb;
  }
  function hard(kind, html) { var el = newPage("hard " + kind, null); el.innerHTML = html || ""; finished.appendChild(el); return el; }
  // Each section starts on a fresh page; on a two-page spread, sections marked "recto" start on a right-hand page.
  function startSection(sec) {
    if (!pb || !pageEmpty()) newPage("paper", sec);
    else { var i = pages.length - 1; meta[i].si = sec.si; meta[i].firstPos = FLOW_POS; setRunheads(pages[i], i, sec); }
    if (SPREAD && sec.recto && (pages.length - 1) % 2 === 1) {
      var i2 = pages.length - 1; setRunheads(pages[i2], i2, null); pages[i2].classList.add("blank"); pb.innerHTML = "<div class='blank-note' aria-hidden='true'>❦</div>";
      newPage("paper", sec);
    }
  }

  // ---------- layout memory (plan section 11) ----------
  // Page breaks depend only on: the book and engine files (B.layout, set by the build), the layout settings, the
  // page and text size, the screen's pixel ratio, whether the fonts loaded, and the browser. The first time, every
  // measurement the layout takes is recorded in order: does it fit (1/0), does a heading move to the next page (1/0),
  // how tall a shrunk figure is (a number). The next time the same layout is needed, the same code runs but takes
  // each answer from the record instead of making the browser lay text out, which is where the time goes.
  // Safety: the record must be used up exactly, give the same number of pages, and a sample of pages is re-measured
  // and must match. Any difference throws the record away and the book is measured afresh.
  var MEM_MAX = 8, mem = null, replayedKey = null, B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_", B64I = {};
  for (var b64i = 0; b64i < 64; b64i++) B64I[B64[b64i]] = b64i;
  function hashStr(t) { var h = 2166136261; for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }
  function memKey(fontsOk) {
    return "lay:" + hashStr([B.layout || B.version, S.font, S.size, S.spacing, SPREAD ? 1 : 0, SMALL ? 1 : 0, W, H,
      getComputedStyle(root).getPropertyValue("--fs").trim(), window.devicePixelRatio || 1, fontsOk ? 1 : 0, navigator.userAgent, textPrint()].join("|"));
  }
  // How this browser sets text, measured: the width of one long unbroken line of sample text in every kind of block the
  // book uses, and the height of a wrapped one. A browser update, a font that loads differently, a user's font setting
  // or injected styles that change text metrics change this print, so a remembered layout is measured afresh
  // (17 Oct review: a tiny letter-spacing change was replayed with 38 cut-off pages under the old key).
  var PRINT_TEXT = "Futures 21,000.25 — the quick brown fox jumps over “wizard” glyphs; 0123456789 · ABCDEFGHIJKLM nopqrstuvwxyz…";
  function textPrint() {
    var line = "<span data-p style='white-space:nowrap'>" + PRINT_TEXT + "</span>", wrap = "<span data-q>" + PRINT_TEXT + " " + PRINT_TEXT + " " + PRINT_TEXT + "</span>";
    var boxes = ["key", "learn", "points", "check", "answers", "note", "varies", "evidence", "rule", "status", "warn", "related", "rowcard"].map(function (k) {
      return "<div class='box box-" + k + "'><span class='box-title'>" + line + "</span><p>" + line + "</p><p>" + wrap + "</p></div>"; }).join("");
    var h = "<h1>" + line + "</h1><h2>" + line + "</h2><h3>" + line + "</h3><p>" + line + "</p><p>" + wrap + "</p><p class='cont'>" + wrap + "</p><p><em>" + line + "</em></p><p><strong>" + line +
      "</strong></p><p><button class='term first'>" + line + "</button> <button class='pref'>" + line + "</button> <button class='go'>" + line + "</button> <button class='src'>" + line + "</button></p>" +
      "<ul><li>" + line + "</li><li>" + wrap + "</li></ul><ol><li>" + line + "</li></ol><table class='ref'><thead><tr><th>" + line + "</th></tr></thead><tbody><tr><td>" + line + "</td></tr><tr><td>" + wrap + "</td></tr></tbody></table>" +
      boxes + "<figure class='plate'><figcaption>" + line + "</figcaption></figure><ul class='toc'>" + NUM_CTX.map(function (c) { return "<li class='" + c + "'><button class='row'><span class='t'>" + line + "</span><span class='lead'></span><span class='n'>0</span></button></li>"; }).join("") +
      "</ul><div class='gloss-entry'><span class='gt'>" + line + "</span> <span class='badge'>" + line + "</span><p class='small'>" + line + "</p></div><div class='chap-no'>" + line + "</div><div class='chap-level'>" + line + "</div><div class='part-no'>" + line + "</div><div class='part-title'>" + line + "</div><div class='letter-head'>" + line + "</div><p class='mono'>" + line + "</p>";
    var el = document.createElement("div"); el.className = "page paper odd"; el.style.width = W + "px"; el.style.height = "60000px";
    el.innerHTML = "<div class='pg'><div class='body'>" + h + "</div></div>"; measureEl.appendChild(el);
    var out = [];
    Array.prototype.forEach.call(el.querySelectorAll("[data-p]"), function (x) { out.push(Math.round(x.getBoundingClientRect().width * 64)); });
    Array.prototype.forEach.call(el.querySelectorAll("[data-q]"), function (x) { out.push(Math.round(x.getBoundingClientRect().height * 64)); });
    measureEl.removeChild(el);
    return hashStr(out.join(","));
  }
  function packBits(a) { var out = ""; for (var i = 0; i < a.length; i += 6) { var v = 0; for (var j = 0; j < 6; j++) v = (v << 1) | (a[i + j] || 0); out += B64[v]; } return out; }
  function unpackBits(t, n) { var a = new Uint8Array(n); for (var i = 0; i < n; i++) a[i] = (B64I[t[(i / 6) | 0]] >> (5 - i % 6)) & 1; return a; }
  function memOpen(fontsOk) {
    var key = memKey(fontsOk), rec = LS.json(key, null);
    if (rec && rec.v === 1 && typeof rec.b === "string" && rec.b.length === Math.ceil(rec.n / 6))
      return { key: key, mode: "replay", rec: rec, bits: unpackBits(rec.b, rec.n), bi: 0, nums: rec.x || [], ni: 0, bad: false };
    return { key: key, mode: "record", bits: [], nums: [], bad: false };
  }
  function memBit(measureIt) {
    var m = mem;
    if (m && m.mode === "replay") { if (m.bi < m.bits.length) return m.bits[m.bi++] === 1; m.bad = true; m.mode = "measure"; }
    var r = !!measureIt(); if (m && m.mode === "record") m.bits.push(r ? 1 : 0); return r;
  }
  function memNum(measureIt) {
    var m = mem;
    if (m && m.mode === "replay") { if (m.ni < m.nums.length) return m.nums[m.ni++]; m.bad = true; m.mode = "measure"; }
    var v = measureIt(); if (m && m.mode === "record") m.nums.push(v); return v;
  }
  // A measurable copy of a page. Once a page is in the flip book, the library gives it its own classes (stf__item has
  // display:none until shown) and inline styles, so a plain copy measures as zero height; strip them.
  function pageCopy(pg) {
    var c = pg.cloneNode(true);
    c.className = pg.className.split(/\s+/).filter(function (k) { return k && k.indexOf("stf__") !== 0 && k.indexOf("--") !== 0; }).join(" ");
    c.style.cssText = "width:" + W + "px;height:" + H + "px"; measureEl.appendChild(c); return c;
  }
  // re-measure a sample of pages: the first 24 and every 50th. "1" fits, "0" overflows, "x" could not be measured.
  function sampleFits() {
    var out = "";
    for (var i = 0; i < pages.length; i++) {
      if (!(i < 24 || i % 50 === 0) || !pages[i].classList.contains("paper")) continue;
      var c = pageCopy(pages[i]), bd = c.querySelector(".body");
      out += bd.clientHeight < 40 ? "x" : bd.scrollHeight <= bd.clientHeight + 0.5 ? "1" : "0"; measureEl.removeChild(c);
    }
    return out;
  }
  function memSave(key, rec) {
    var idx = LS.json("lay-index", []), txt = JSON.stringify(rec);
    if (!Array.isArray(idx)) idx = [];
    idx = idx.filter(function (k) { return k !== key; }); idx.unshift(key);
    for (;;) {
      while (idx.length > MEM_MAX) LS.del(idx.pop());
      if (LS.set(key, txt)) { LS.set("lay-index", JSON.stringify(idx)); return true; }
      if (idx.length <= 1) return false;
      LS.del(idx.pop()); // storage full: forget the oldest layout and try again
    }
  }
  function memDrop(key) { LS.del(key); var idx = LS.json("lay-index", []); if (Array.isArray(idx)) LS.set("lay-index", JSON.stringify(idx.filter(function (k) { return k !== key; }))); }
  // at the end of a layout: save a new record, or check a replayed one. false = the replay must be thrown away.
  function memClose() {
    var m = mem; mem = null; if (!m) return true;
    var sample = sampleFits();
    if (m.mode === "record") { layout.memory = memSave(m.key, { v: 1, b: packBits(m.bits), n: m.bits.length, x: m.nums, p: pages.length, s: sample, d: NUM_DIGITS }) ? "measured, saved" : "measured, not saved"; layout.log.push(layout.memory); return true; }
    var r = m.rec, ok = !m.bad && m.bi === r.n && m.ni === (r.x || []).length && pages.length === r.p && sample === r.s && sample.indexOf("x") < 0;
    layout.memory = ok ? "replayed" : "replay rejected"; layout.log.push(layout.memory);
    replayedKey = ok ? m.key : null;
    if (ok) memSave(m.key, r); else memDrop(m.key);
    return ok;
  }
  // run the next layout slice without the browser's 4 ms minimum timer delay
  var soonQ = [], soonCh = typeof MessageChannel === "function" ? new MessageChannel() : null;
  if (soonCh) soonCh.port1.onmessage = function () { var f = soonQ.shift(); if (f) f(); };
  function soon(f) { if (soonCh) { soonQ.push(f); soonCh.port2.postMessage(0); } else setTimeout(f, 0); }
  function paginate(fontsOk, keepPos, onStart, onDone) {
    var gen = ++layout.gen; layout.done = false; layout.startedMs = performance.now(); layout.memory = "";
    pages = []; meta = []; anchorPage = {}; posStart = []; pb = ctn = null; finished = document.createDocumentFragment(); measureEl.innerHTML = ""; FLOW_POS = 0;
    hard("cover", "<div class='cover-page'>" + ART.coverHTML(B.title, B.subtitle, B.byline) + "</div>");
    if (SPREAD) hard("endpaper", "<div class='bookplate'><div class='ex'>Ex Libris</div><div class='nm'>" + esc(B.title) + "</div><div class='small'>" + esc(B.subtitle) + "</div><div class='ex' style='margin-top:.6em'>" + esc(B.byline) + "</div></div>");
    var startAfter = Math.min(FLOW.length, firstChunkEnd()), started = false, lastSi = -1, chapterPage0 = -1;
    // First layout: open the book once the contents, the front matter and the first two chapters are laid out, or 40
    // pages into the first chapter, whichever comes first (stress test: two long chapters took 2.0 s on a 4x-slowed
    // phone). Re-layout (a text-size change): open it again only once the reader's own place is laid out, plus a few
    // pages, so they never see another part of the book in the meantime.
    function startNow() {
      if (keepPos != null) return posStart[keepPos] !== undefined && pages.length - 1 - posStart[keepPos] >= 4;
      return FLOW_POS >= startAfter || chapterPage0 >= 0 && pages.length - chapterPage0 >= FIRST_PAGES;
    }
    mem = memOpen(fontsOk); replayedKey = mem.mode === "replay" ? mem.key : null;
    NUM_DIGITS = mem.mode === "replay" ? mem.rec.d || 3 : Math.max(NUM_DIGITS, digitsFor((B.chars || 0) / 500)); WIDE = probeWide();
    (function chunk() {
      if (gen !== layout.gen) return; // a newer layout replaced this one
      var until = performance.now() + 28;
      while (FLOW_POS < FLOW.length && performance.now() < until) {
        var f = FLOW[FLOW_POS], sec = SECS[f.si];
        if (f.si !== lastSi) { startSection(sec); lastSi = f.si; if (chapterPage0 < 0 && sec.kind === "chapter") chapterPage0 = pages.length - 1; }
        var tmp = document.createElement("div"); tmp.innerHTML = f.html;
        var nodes = Array.prototype.slice.call(tmp.childNodes);
        for (var i = 0; i < nodes.length; i++) { var n = nodes[i]; if (n.nodeType === 3) { if (!n.textContent.trim()) continue; var pw = document.createElement("p"); pw.textContent = n.textContent; n = pw; } n.setAttribute("data-bp", FLOW_POS); figureFill(n); widen(n); place(n, sec, null); }
        FLOW_POS++;
        if (!started && startNow()) break;
      }
      if (!started && (startNow() || FLOW_POS >= FLOW.length)) {
        started = true; layout.firstMs = Math.round(performance.now() - layout.startedMs);
        numberPages(); fillNumbers();
        onStart(pages.slice(0, pages.length - 1));
        if (gen !== layout.gen) return; // the start callback began a new layout (a shown page did not fit): this one stops here
      }
      if (FLOW_POS < FLOW.length) return soon(chunk);
      closePage();
      if (SPREAD) { hard("endpaper", ""); if (pages.length % 2 === 1) hard("endpaper", ""); }
      hard("backcover", "<div class='back-cover-face'></div>");
      numberPages(); fillNumbers();
      var lastFolio = folio.reduce(function (a, b) { return b > a ? b : a; }, 0), tooNarrow = digitsFor(lastFolio) > NUM_DIGITS;
      if (tooNarrow) { if (mem && mem.mode !== "record") memDrop(mem.key); NUM_DIGITS = digitsFor(lastFolio); mem = null; } // more pages than the numbers were measured for: lay out again (and never replay that record)
      var memOk = memClose() && !tooNarrow;
      layout.done = true; layout.doneMs = Math.round(performance.now() - layout.startedMs);
      onDone();
      if (!memOk) relayout(currentPos()); // a remembered layout that did not match, or numbers measured too narrow: lay out afresh, keep the place
    })();
  }
  var FIRST_PAGES = 40;
  // the flow position where the third chapter starts (the book opens before it at the latest)
  function firstChunkEnd() { var n = 0, ch = 0; for (var i = 0; i < FLOW.length; i++) { var s = SECS[FLOW[i].si]; if (s.kind === "chapter" && FLOW[i].first) { ch++; if (ch > 2) return i; } n = i + 1; } return n; }

  var folio = [], folioIndex = {};
  function numberPages() {
    folio = []; folioIndex = {}; var n = 0;
    pages.forEach(function (pg, i) { if (pg.classList.contains("paper")) { n++; folio[i] = n; folioIndex[n] = i; var f = pg.querySelector(".folio"); if (f) f.textContent = n; } else folio[i] = null; });
  }
  function pageOfAnchor(a) { return anchorPage[a]; }
  function folioOfAnchor(a) { var p = anchorPage[a]; return p === undefined ? null : folio[p]; }
  function fillNumbers() {
    pages.forEach(function (pg) {
      if (pg.parentNode === measureEl) return; // still being laid out: keeps its widest-number placeholders
      Array.prototype.forEach.call(pg.querySelectorAll("button[data-go] .n, button.pref"), function (n) {
        var btn = n.classList.contains("pref") ? n : n.parentNode, f = folioOfAnchor(btn.dataset.go);
        if (n.classList.contains("pref")) n.textContent = f ? "p. " + f : "p. …"; else n.textContent = f ? f : "…";
      });
    });
  }
  // the page where block `pos` starts (exact, recorded during layout); falls back to a search while layout runs
  function pageOfPos(pos) { if (posStart[pos] !== undefined) return posStart[pos]; var lo = 0, hi = meta.length - 1, best = 0; while (lo <= hi) { var mid = (lo + hi) >> 1; if (meta[mid].firstPos <= pos) { best = mid; lo = mid + 1; } else hi = mid - 1; } return best; }

  // ---------- the flip book ----------
  var pf = null, openEl = $("open"), closedEl = $("closed"), book3d = $("book3d"), hint = $("hint");
  function isOpen() { return !openEl.classList.contains("off"); }
  function host() { var h = $("flip"); if (!h) { h = document.createElement("div"); h.id = "flip"; openEl.appendChild(h); } return h; }
  function makeFlip(list, startIndex) {
    if (pf) { try { pf.destroy(); } catch (e) { } pf = null; } // destroy() removes the container; host() recreates it
    var h = host(); h.innerHTML = "";
    pf = new St.PageFlip(h, { width: W, height: H, size: "fixed", showCover: true, usePortrait: !SPREAD, startPage: startIndex || 0,
      disableFlipByClick: true, showPageCorners: false, clickEventForward: true, mobileScrollSupport: false,
      maxShadowOpacity: 0.55, flippingTime: flipTime(), drawShadow: true });
    pf.loadFromHTML(list);
    patchTurns(pf); patchRender(pf);
    if (window.__book) window.__book.flips = (window.__book.flips || 0) + 1;
    pf.on("flip", onFlip);
    syncClosed();
  }
  // Library bug (engine test round 2): in one-page view, flipNext/flipPrev aim two page-widths across and our
  // no-flip-on-click setting rejects that point, so arrows and swipes did nothing. Lift the setting for the instant
  // of the command. Patching the instance also fixes the library's own swipe handler, which calls these methods.
  function patchTurns(f) {
    var s = f.getSettings();
    // The library treats a touch as a swipe only if it ends within 250 ms; a longer swipe becomes a drag whose
    // direction is read from where the finger is after 250 ms, so a fast-starting swipe could turn BACK.
    // 600 ms lets a normal swipe count as a swipe (direction from its movement); a deliberate drag starts later.
    try { f.getUI().swipeTimeout = 600; } catch (e) { }
    // In one-page view the library completes a drag only if the finger crosses the page's LEFT EDGE (it treats that
    // edge as the spine). On a phone that edge is the screen edge, so slow drags sprang back. Complete the turn
    // once the drag has passed the middle of the page; otherwise use the library's own rule.
    var fc = f.flipController;
    if (fc && typeof fc.stopMove === "function") {
      var origStop = fc.stopMove.bind(fc);
      fc.stopMove = function () {
        try {
          if (f.getOrientation() === "portrait" && fc.calc) {
            var p = fc.calc.getPosition(), r = fc.getBoundsRect();
            if (p.x > 0 && p.x < r.pageWidth * 0.5) { fc.animateFlippingTo(p, { x: -r.pageWidth, y: fc.calc.getCorner() === "bottom" ? r.height : 0 }, true); return; }
          }
        } catch (e) { }
        origStop();
      };
    }
    ["flipNext", "flipPrev"].forEach(function (m) { var orig = f[m].bind(f); f[m] = function (c) { s.disableFlipByClick = false; try { orig(c); } finally { s.disableFlipByClick = true; } }; });
  }
  // Library flaw: on EVERY animation frame its HTML renderer sets style.cssText = "display: none" on every page that is
  // not showing (render.clear()). With thousands of pages that is hundreds of thousands of style writes a second and
  // the browser never rests (stress test: page turn 2.9 s, any command ~0.9 s). Replacement: hide only the pages that
  // were showing on the previous frame and no longer are; do one full pass when the page set changes.
  function patchRender(f) {
    var r = f.getRender && f.getRender(); if (!r || typeof r.clear !== "function") return;
    var shown = null, list = null;
    r.clear = function () {
      var keep = [this.leftPage, this.rightPage, this.flippingPage, this.bottomPage], all = this.app.getPageCollection().getPages(), i, t;
      if (shown === null || all !== list) {
        for (i = 0; i < all.length; i++) { t = all[i]; if (keep.indexOf(t) < 0) t.getElement().style.cssText = "display: none"; if (t.getTemporaryCopy() !== this.flippingPage) t.hideTemporaryCopy(); }
        list = all;
      } else {
        var self = this;
        shown.forEach(function (p) { if (keep.indexOf(p) < 0) p.getElement().style.cssText = "display: none"; if (p.getTemporaryCopy() !== self.flippingPage) p.hideTemporaryCopy(); });
      }
      shown = new Set(keep.filter(Boolean));
    };
  }
  function turn(dir) { if (!pf) return; if (dir > 0) pf.flipNext(); else pf.flipPrev(); }
  function syncClosed() { var f = $("flip"); if (f) f.classList.toggle("closed", !!pf && pf.getCurrentPageIndex() === 0 && SPREAD); }
  function currentIndex() { return pf ? pf.getCurrentPageIndex() : 0; }
  function currentPos() {
    var i = currentIndex(), m = meta[i], r = meta[i + 1];
    if (SPREAD && i > 0 && r && r.kind === "paper" && (!m || m.kind !== "paper" || pages[i].classList.contains("blank") || m.si !== r.si)) return r.firstPos;
    return m ? m.firstPos : 0;
  }
  function onFlip() { syncClosed(); hideTip(); var i = currentIndex(); if (folio[i] || folio[i + 1]) LS.set("last", String(currentPos())); updateResume(); checkShown(); }
  // Backstop for the layout memory: every page the reader actually looks at in a replayed layout is measured; if one
  // does not fit, the record is deleted and the book is laid out afresh at the same place.
  function checkShown() {
    if (!replayedKey || !pf) return;
    var i = currentIndex(), list = [i].concat(SPREAD ? [i + 1] : []);
    for (var k = 0; k < list.length; k++) {
      var pg = pages[list[k]]; if (!pg || !pg.classList.contains("paper")) continue;
      var c = pageCopy(pg), bd = c.querySelector(".body"), bad = bd.scrollHeight > bd.clientHeight + 0.5; measureEl.removeChild(c);
      if (bad) { memDrop(replayedKey); replayedKey = null; layout.log.push("shown page did not fit: memory dropped"); toast("Re-laying out the pages…", 1500); relayout(currentPos()); return; }
    }
  }

  // ---------- navigation (D28: every reference jumps) ----------
  var history = [], pending = null;
  function goIndex(i, noHistory) {
    if (!pf || i == null) return;
    if (!noHistory) { history.push(currentPos()); if (history.length > 60) history.shift(); $("backBtn").disabled = false; }
    pf.turnToPage(Math.max(0, Math.min(i, pf.getPageCount() - 1))); syncClosed(); onFlip();
  }
  function goAnchor(a) {
    var p = pageOfAnchor(a);
    if (p !== undefined && pf && p < pf.getPageCount()) return goIndex(p);
    if (!layout.done) { pending = { anchor: a }; toast("Preparing that page… it opens as soon as it's laid out."); return; }
    toast("That page is not in this edition yet.");
  }
  function goPos(pos) {
    var p = pageOfPos(pos);
    if (!layout.done && (!pf || p >= pf.getPageCount() - 1 || pos > meta[meta.length - 1].firstPos)) { pending = { pos: pos }; toast("Preparing that page… it opens as soon as it's laid out."); return; }
    goIndex(p);
  }
  function back() { if (!history.length) return; var pos = history.pop(); goIndex(pageOfPos(pos), true); $("backBtn").disabled = !history.length; }

  // ---------- open / close ----------
  var ready = false, openRequested = false;
  function openBook() {
    if (book3d.dataset.busy === "1") return; book3d.dataset.busy = "1";
    book3d.classList.add("facing"); hint.hidden = true;
    setTimeout(function () { openRequested = true; if (ready) reveal(); else toast("Opening…", 1500); }, reduceMotion ? 0 : 1000);
  }
  function reveal() {
    openEl.classList.remove("off"); openEl.style.opacity = "0";
    requestAnimationFrame(function () {
      openEl.style.opacity = "1"; closedEl.style.opacity = "0";
      setTimeout(function () {
        closedEl.hidden = true; var f = $("flip"); if (f) f.classList.remove("closed");
        if (currentIndex() === 0) turn(1);
        $("prev").hidden = false; $("next").hidden = false; $("topbar").hidden = false; idle();
      }, reduceMotion ? 0 : 380);
    });
  }
  function closeBook() {
    hideTip(); closeDrawer(); $("prev").hidden = true; $("next").hidden = true; $("topbar").hidden = true;
    closedEl.hidden = false; closedEl.style.opacity = "0"; openEl.style.opacity = "0";
    setTimeout(function () { openEl.classList.add("off"); closedEl.style.opacity = "1"; book3d.classList.remove("facing"); book3d.dataset.busy = "0"; hint.hidden = false; openRequested = false; if (pf) pf.turnToPage(0); syncClosed(); }, reduceMotion ? 0 : 380);
  }

  // ---------- full layout (first time, and after a layout setting changes) ----------
  function relayout(keepPos) {
    layout.gen++; // stop any layout still running before the page size changes (17 Oct review)
    measure();
    var fam = { garamond: "EB Garamond", source: "Source Serif 4", inter: "Inter", atkinson: "Atkinson Hyperlegible Next", dyslexic: "OpenDyslexic" }[S.font];
    // load EVERY face of the fonts the pages can use (regular, italic, bold, bold italic, the display fonts, the
    // monospace font) before measuring, so no measurement depends on a font still loading (17 Oct review)
    var fams = [fam, "JetBrains Mono"].concat(S.font === "garamond" ? ["IM Fell English", "IM Fell English SC"] : []), faces = [];
    if (document.fonts && document.fonts.forEach) document.fonts.forEach(function (ff) { if (fams.indexOf(String(ff.family).replace(/^["']|["']$/g, "")) >= 0) faces.push(ff); });
    Promise.all(faces.map(function (ff) { return ff.load().catch(function () { }); })).then(function () {
      ready = false;
      var fontsOk = faces.length > 0 && faces.every(function (ff) { return ff.status === "loaded"; });
      paginate(fontsOk, keepPos, function (first) {
        var start = keepPos != null ? Math.min(pageOfPos(keepPos), first.length - 1) : 0;
        makeFlip(first, start); ready = true; checkShown();
        if (openRequested && !isOpen()) reveal(); // the reader clicked the cover before the pages were ready
        window.__book.firstReadyMs = Math.round(performance.now() - T0);
      }, function () {
        var keep = keepPos != null ? keepPos : currentPos(), idx = pf ? currentIndex() : 0;
        if (pf) { pf.updateFromHtml(pages); pf.turnToPage(keepPos != null ? pageOfPos(keep) : Math.min(idx, pages.length - 1)); syncClosed(); }
        if (pending) { var p = pending; pending = null; if (p.anchor) goAnchor(p.anchor); else goPos(p.pos); }
        window.__book.readyMs = Math.round(performance.now() - T0);
        updateResume(); renderBookmarks();
      });
    });
  }

  // ---------- pop-up definitions ----------
  var tip = $("tip"), tipFor = null, hoverCapable = window.matchMedia("(hover: hover)").matches;
  function placeTip(btn) {
    var r = btn.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    var left = Math.min(Math.max(12, r.left + r.width / 2 - tw / 2), window.innerWidth - tw - 12), top = r.bottom + 8;
    if (top + th > window.innerHeight - 12) top = Math.max(12, r.top - th - 8);
    tip.style.left = left + "px"; tip.style.top = top + "px";
  }
  function showTip(btn) {
    var g = B.glossary[btn.dataset.term]; if (!g) return; tipFor = btn;
    var f = g.thumb && B.figures[g.thumb], target = g.anchor || ("g-" + btn.dataset.term), pg = folioOfAnchor(target);
    tip.innerHTML = "<span class='lv badge'>" + esc(g.lv) + "</span><div class='tt'></div>" + (f ? "<div class='thumb'>" + f.svg + "</div>" : "") +
      "<div class='dd'></div><button class='more' data-go='" + esc(target) + "'>Read more → " + (pg ? "p. " + pg : "glossary") + "</button>";
    tip.querySelector(".tt").textContent = g.t; tip.querySelector(".dd").textContent = g.s;
    tip.hidden = false; placeTip(btn);
  }
  function hideTip() { tip.hidden = true; tipFor = null; }
  document.addEventListener("mouseover", function (e) { if (!hoverCapable || S.pop !== "hover") return; var t = e.target.closest && e.target.closest("button.term"); if (t && t !== tipFor) showTip(t); });
  document.addEventListener("mouseout", function (e) { if (!hoverCapable || S.pop !== "hover") return; var t = e.target.closest && e.target.closest("button.term"); if (t && !(e.relatedTarget && tip.contains(e.relatedTarget))) setTimeout(function () { if (!tip.matches(":hover") && !(tipFor && tipFor.matches(":hover"))) hideTip(); }, 250); });
  tip.addEventListener("mouseleave", function () { if (hoverCapable && S.pop === "hover") hideTip(); });

  // one click handler for every in-book link
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("button.term");
    if (t) { e.preventDefault(); if (tipFor === t) hideTip(); else showTip(t); return; }
    var g = e.target.closest && e.target.closest("[data-go]");
    if (g) { e.preventDefault(); hideTip(); if (g.closest("#drawer") && SMALL) closeDrawer(); goAnchor(g.dataset.go); return; }
    var p = e.target.closest && e.target.closest("[data-pos]");
    if (p) { e.preventDefault(); hideTip(); if (SMALL) closeDrawer(); goPos(+p.dataset.pos); return; }
    if (!tip.hidden && !tip.contains(e.target)) hideTip();
  });
  document.addEventListener("keydown", function (e) {
    if (!isOpen() || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
    if (e.key === "ArrowRight") turn(1); else if (e.key === "ArrowLeft") turn(-1); else if (e.key === "Escape") { hideTip(); closeDrawer(); }
  });

  // ---------- drawer: search, bookmarks, settings ----------
  var drawer = $("drawer"), dTitle = $("drawerTitle"), dBody = $("drawerBody"), drawerMode = null;
  function openDrawer(mode) {
    if (drawerMode === mode && !drawer.hidden) return closeDrawer();
    drawerMode = mode; drawer.hidden = false; dTitle.textContent = { search: "Search", bookmarks: "Bookmarks", settings: "Settings", menu: "Menu" }[mode];
    ["searchBtn", "bmBtn", "setBtn", "menuBtn"].forEach(function (id) { $(id).setAttribute("aria-pressed", "false"); });
    $({ search: "searchBtn", bookmarks: "bmBtn", settings: "setBtn", menu: "menuBtn" }[mode]).setAttribute("aria-pressed", "true");
    if (mode === "search") renderSearch(); else if (mode === "bookmarks") renderBookmarks(); else if (mode === "menu") renderMenu(); else renderSettings();
  }
  function closeDrawer() { drawer.hidden = true; drawerMode = null; ["searchBtn", "bmBtn", "setBtn", "menuBtn"].forEach(function (id) { var b = $(id); if (b) b.setAttribute("aria-pressed", "false"); }); }

  // search: plain text of every block, built on first use
  var TEXT = null;
  function plain(html) { var d = document.createElement("div"); d.innerHTML = html; return (d.textContent || "").replace(/\s+/g, " ").trim(); }
  function renderSearch() {
    dBody.innerHTML = "<input id='searchInput' type='search' placeholder='Search the book' autocomplete='off' aria-label='Search the book'><div class='note' id='searchNote'>Type a word or phrase. Click a result to go to its page.</div><div id='hits'></div>";
    var inp = $("searchInput"), deb; inp.focus();
    inp.addEventListener("input", function () { clearTimeout(deb); deb = setTimeout(function () { runSearch(inp.value); }, 160); });
    if (lastQuery) { inp.value = lastQuery; runSearch(lastQuery); }
  }
  var lastQuery = "";
  function runSearch(q) {
    lastQuery = q; q = q.trim().toLowerCase(); var out = $("hits"), note = $("searchNote");
    if (q.length < 2) { out.innerHTML = ""; note.textContent = "Type a word or phrase. Click a result to go to its page."; return; }
    if (!TEXT) TEXT = FLOW.map(function (f) { return SECS[f.si].kind === "contents" ? "" : plain(f.html); });
    var words = q.split(/\s+/), hits = [];
    for (var i = 0; i < TEXT.length && hits.length < 200; i++) {
      var low = TEXT[i].toLowerCase(), ok = true;
      for (var w = 0; w < words.length; w++) if (low.indexOf(words[w]) < 0) { ok = false; break; }
      if (ok) hits.push(i);
    }
    note.textContent = hits.length ? hits.length + (hits.length >= 200 ? "+" : "") + " results" + (layout.done ? "" : " (page numbers still filling in)") : "No results.";
    out.innerHTML = hits.map(function (pos) {
      var t = TEXT[pos], at = t.toLowerCase().indexOf(q.indexOf(" ") > 0 && t.toLowerCase().indexOf(q) >= 0 ? q : words[0]);
      var s = Math.max(0, at - 60), snip = (s ? "…" : "") + t.slice(s, at + 110) + (at + 110 < t.length ? "…" : "");
      var hl = esc(snip).replace(new RegExp("(" + words.map(function (x) { return x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")", "ig"), "<mark>$1</mark>");
      var sec = SECS[FLOW[pos].si], pg = layout.done || pos <= (meta[meta.length - 1] || {}).firstPos ? folio[pageOfPos(pos)] : null;
      return "<button class='hit' data-pos='" + pos + "'><span class='hh'><span>" + esc(sec.runR || sec.title || "") + "</span><span>" + (pg ? "p. " + pg : "…") + "</span></span><span class='hs'>" + hl + "</span></button>";
    }).join("");
  }

  // phone menu: everything that does not fit in the compact bar
  function renderMenu() {
    var last = $("resumeBtn");
    dBody.innerHTML = "<div class='menu-list'><button class='ui-btn' id='mGloss'>Glossary</button><button class='ui-btn' id='mBm'>Bookmarks</button><button class='ui-btn' id='mSet'>Settings</button>" +
      (!last.hidden ? "<button class='ui-btn' data-pos='" + last.dataset.pos + "'>" + esc(last.textContent) + "</button>" : "") +
      "<form id='mGoto' style='display:flex;gap:8px'><input id='mGotoInput' inputmode='numeric' placeholder='Page number' aria-label='Go to page' style='flex:1;padding:.5em;border-radius:6px;border:1px solid var(--ui-line);background:rgba(0,0,0,.25);color:var(--ui-fg);font:16px \"EB Garamond\",serif'><button class='ui-btn' type='submit'>Go</button></form>" +
      "<button class='ui-btn' id='mClose'>Close the book</button></div>";
    $("mGloss").onclick = function () { closeDrawer(); goAnchor("glossary"); };
    $("mBm").onclick = function () { openDrawer("bookmarks"); };
    $("mSet").onclick = function () { openDrawer("settings"); };
    $("mClose").onclick = function () { closeDrawer(); closeBook(); };
    $("mGoto").onsubmit = function (e) { e.preventDefault(); var n = parseInt($("mGotoInput").value, 10); if (folioIndex[n] !== undefined) { closeDrawer(); goIndex(folioIndex[n]); } else toast(layout.done ? "There is no page " + n + "." : "Page " + n + " isn't laid out yet."); };
  }

  // bookmarks
  function bookmarks() { return LS.json("bookmarks", []); }
  function renderBookmarks() {
    if (drawerMode !== "bookmarks") return;
    var list = bookmarks(), here = currentPos();
    var html = "<button class='ui-btn' id='bmAdd'>Bookmark this page</button><div class='lbl'>Your bookmarks</div>";
    html += list.length ? list.map(function (b, i) { var pg = folio[pageOfPos(b.pos)]; return "<div style='display:flex;gap:6px;align-items:center'><button class='hit' data-pos='" + b.pos + "'><span class='hh'><span>" + esc(b.label) + "</span><span>" + (pg ? "p. " + pg : "") + "</span></span></button><button class='ui-btn' data-bmdel='" + i + "' aria-label='Remove bookmark'>✕</button></div>"; }).join("") : "<div class='note'>No bookmarks yet.</div>";
    dBody.innerHTML = html + "<div class='note' style='margin-top:12px'>Bookmarks are kept in this browser on this device.</div>";
    $("bmAdd").onclick = function () { var l = bookmarks(), sec = SECS[(meta[currentIndex()] || {}).si] || {}; l.push({ pos: here, label: (sec.runR || sec.title || "Page") + " · p. " + (folio[currentIndex()] || folio[currentIndex() + 1] || "") }); LS.set("bookmarks", JSON.stringify(l)); renderBookmarks(); };
    Array.prototype.forEach.call(dBody.querySelectorAll("[data-bmdel]"), function (b) { b.onclick = function () { var l = bookmarks(); l.splice(+b.dataset.bmdel, 1); LS.set("bookmarks", JSON.stringify(l)); renderBookmarks(); }; });
  }

  // settings
  function renderSettings() {
    var html = "";
    Object.keys(OPTIONS).forEach(function (k) {
      html += "<div class='lbl'>" + LABELS[k] + "</div><div class='opts' data-key='" + k + "'>" + OPTIONS[k].map(function (o) { return "<button data-v='" + o[0] + "' aria-pressed='" + (S[k] === o[0]) + "'>" + o[1] + "</button>"; }).join("") + "</div>";
    });
    html += "<div class='lbl'>Reset</div><button class='ui-btn' id='resetBtn'>Restore all defaults</button><div class='note' style='margin-top:10px'>Settings are kept in this browser on this device.</div>";
    dBody.innerHTML = html;
    Array.prototype.forEach.call(dBody.querySelectorAll(".opts button"), function (b) { b.onclick = function () { setOption(b.parentNode.dataset.key, b.dataset.v); }; });
    $("resetBtn").onclick = function () { var re = Object.keys(RELAYOUT).some(function (k) { return S[k] !== DEFAULTS[k]; }); Object.keys(DEFAULTS).forEach(function (k) { S[k] = DEFAULTS[k]; }); saveSettings(); applyLook(); if (pf) pf.getSettings().flippingTime = flipTime(); if (re) relayout(currentPos()); renderSettings(); };
  }
  function saveSettings() { LS.set("settings", JSON.stringify(S)); }
  function setOption(k, v) {
    if (S[k] === v) return; S[k] = v; saveSettings(); applyLook();
    if (k === "anim" && pf) pf.getSettings().flippingTime = flipTime();
    if (RELAYOUT[k]) { var keep = currentPos(); toast("Re-laying out the pages…", 1500); relayout(keep); }
    renderSettings();
  }

  // ---------- top bar ----------
  function updateResume() {
    var last = +LS.get("last"), r = $("resumeBtn");
    if (!r) return;
    if (!last || !layout.done && last > (meta[meta.length - 1] || {}).firstPos) { r.hidden = !last; r.textContent = "Resume"; r.dataset.pos = last || 0; return; }
    var p = folio[pageOfPos(last)]; r.hidden = !p || Math.abs(pageOfPos(last) - currentIndex()) <= 1; r.textContent = "Resume p. " + p; r.dataset.pos = last;
  }
  var idleT;
  function idle() { var tb = $("topbar"); tb.classList.remove("idle"); clearTimeout(idleT); if (!SMALL) idleT = setTimeout(function () { tb.classList.add("idle"); }, 3500); }
  document.addEventListener("mousemove", idle, { passive: true });
  $("contentsBtn").onclick = function () { goAnchor("contents-top"); };
  $("glossBtn").onclick = function () { goAnchor("glossary"); };
  $("searchBtn").onclick = function () { openDrawer("search"); };
  $("bmBtn").onclick = function () { openDrawer("bookmarks"); };
  $("setBtn").onclick = function () { openDrawer("settings"); };
  $("menuBtn").onclick = function () { openDrawer("menu"); };
  $("backBtn").onclick = back;
  $("closeBtn").onclick = closeBook;
  $("drawerClose").onclick = closeDrawer;
  $("gotoForm").onsubmit = function (e) { e.preventDefault(); var n = parseInt($("gotoInput").value, 10); if (folioIndex[n] !== undefined) goIndex(folioIndex[n]); else toast(layout.done ? "There is no page " + n + "." : "Page " + n + " isn't laid out yet."); };
  $("prev").onclick = function () { turn(-1); };
  $("next").onclick = function () { turn(1); };
  book3d.addEventListener("click", openBook);
  book3d.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openBook(); } });
  // a resize re-lays out only when the page size really changes; a small change (a phone's address bar) changes nothing
  var rz; window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { var n = sizeFor(window.innerWidth, window.innerHeight); if (n.SPREAD !== SPREAD || Math.abs(n.W - W) > 8 || Math.abs(n.H - H) > 8) relayout(currentPos()); }, 250); });

  // ---------- start ----------
  var T0 = performance.now();
  window.__book = { errors: errors, layout: layout, settings: S, pf: function () { return pf; }, pages: function () { return pages; }, meta: function () { return meta; },
    anchorPage: function () { return anchorPage; }, folio: function () { return folio; }, flow: FLOW, secs: SECS, goAnchor: goAnchor, goPos: goPos, setOption: setOption,
    currentIndex: currentIndex, currentPos: currentPos, pageOfPos: pageOfPos, open: openBook };
  root.style.setProperty("--leather", ART.LEATHER);
  root.style.setProperty("--leather-img", ART.leather(ART.LEATHER));
  root.style.setProperty("--wood", ART.wood);
  root.style.setProperty("--marble", ART.marble);
  applyLook(); measure();
  $("front3d").innerHTML = ART.coverHTML(B.title, B.subtitle, B.byline);
  $("hint").textContent = SMALL ? "Tap the book to open it" : "Click the book to open it";
  relayout(null);
})();
