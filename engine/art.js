/* How To Trade — artwork drawn in code (no copied images): leather, desk wood, marbled endpapers, aged paper,
   and the gold-stamped cover. Classic script; exposes window.ART. */
(function () {
  "use strict";
  function svgURL(svg) { return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")'; }

  function leather(hex) {
    return svgURL("<svg xmlns='http://www.w3.org/2000/svg' width='560' height='800'><filter id='f' x='0' y='0' width='100%' height='100%'>" +
      "<feTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' seed='3' result='n'/>" +
      "<feDiffuseLighting in='n' lighting-color='#ffffff' surfaceScale='1.4' result='b'><feDistantLight azimuth='225' elevation='62'/></feDiffuseLighting>" +
      "<feTurbulence type='fractalNoise' baseFrequency='0.011' numOctaves='3' seed='11' result='m'/>" +
      "<feColorMatrix in='m' type='matrix' values='0.45 0 0 0 0.6  0.45 0 0 0 0.6  0.45 0 0 0 0.6  0 0 0 0 1' result='mg'/>" +
      "<feBlend in='b' in2='mg' mode='multiply' result='t'/><feBlend in='SourceGraphic' in2='t' mode='multiply'/></filter>" +
      "<rect width='100%' height='100%' fill='" + hex + "' filter='url(#f)'/></svg>");
  }

  var wood = svgURL("<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='1000'><filter id='w'>" +
    "<feTurbulence type='fractalNoise' baseFrequency='0.0022 0.055' numOctaves='4' seed='7'/>" +
    "<feColorMatrix type='matrix' values='0.34 0 0 0 0.10  0.22 0 0 0 0.06  0.13 0 0 0 0.035  0 0 0 0 1'/></filter>" +
    "<rect width='100%' height='100%' filter='url(#w)'/></svg>");

  var marble = svgURL("<svg xmlns='http://www.w3.org/2000/svg' width='520' height='740'><filter id='m' x='-20%' y='-20%' width='140%' height='140%'>" +
    "<feTurbulence type='turbulence' baseFrequency='0.006 0.022' numOctaves='5' seed='14' result='t'/>" +
    "<feDisplacementMap in='SourceGraphic' in2='t' scale='70' xChannelSelector='R' yChannelSelector='B' result='d'/>" +
    "<feGaussianBlur in='d' stdDeviation='0.6'/></filter>" +
    "<g filter='url(#m)'>" + (function () {
      var c = ["#6e2c22", "#d8c39b", "#33405a", "#9c7a44", "#ead9b6", "#4a2a20", "#b9935a", "#d8c39b"], s = "", y = -60, i = 0;
      while (y < 820) { var h = 3 + (i * 5) % 9; s += "<rect x='-80' y='" + y + "' width='680' height='" + h + "' fill='" + c[i % c.length] + "'/>"; y += h; i++; }
      return s;
    })() + "</g><rect width='100%' height='100%' fill='#2a1a12' fill-opacity='0.12'/></svg>");

  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // Paper ages. Heavy aging is not offered: Wayne found it hard to read (plan D9/D26).
  var AGES = {
    light: { base: [243, 233, 207], grain: 0.035, blot: 3, fox: 8, burn: 0.13 },
    medium: { base: [236, 220, 182], grain: 0.06, blot: 6, fox: 22, burn: 0.27 },
    sepia: { base: [238, 222, 188], grain: 0.03, blot: 2, fox: 4, burn: 0.10 }
  };
  var paperCache = {};
  function paper(age, seed) {
    var key = age + ":" + seed;
    if (paperCache[key]) return paperCache[key];
    var a = AGES[age], w = 560, h = 800, cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    var x = cv.getContext("2d"), r = rng(seed);
    x.fillStyle = "rgb(" + a.base.join(",") + ")"; x.fillRect(0, 0, w, h);
    if (a.grain > 0) {
      var img = x.getImageData(0, 0, w, h), d = img.data, amp = a.grain * 255;
      for (var i = 0; i < d.length; i += 4) { var n = (r() - 0.5) * amp; d[i] += n; d[i + 1] += n * 0.95; d[i + 2] += n * 0.85; }
      x.putImageData(img, 0, 0);
      x.globalAlpha = a.grain * 1.4; x.strokeStyle = "rgb(150,120,80)"; x.lineWidth = 0.6;
      for (var f = 0; f < 260; f++) { var fx = r() * w, fy = r() * h, an = r() * Math.PI, L = 4 + r() * 14; x.beginPath(); x.moveTo(fx, fy); x.lineTo(fx + Math.cos(an) * L, fy + Math.sin(an) * L); x.stroke(); }
      x.globalAlpha = 1;
    }
    for (var b = 0; b < a.blot; b++) { var bx = r() * w, by = r() * h, br = 40 + r() * 140, g = x.createRadialGradient(bx, by, 0, bx, by, br); g.addColorStop(0, "rgba(150,105,55," + (0.05 + r() * 0.07) + ")"); g.addColorStop(1, "rgba(150,105,55,0)"); x.fillStyle = g; x.fillRect(0, 0, w, h); }
    for (var s = 0; s < a.fox; s++) { var sx = r() * w, sy = r() * h, k = 1 + Math.floor(r() * 4); for (var j = 0; j < k; j++) { x.fillStyle = "rgba(145,90,40," + (0.10 + r() * 0.22) + ")"; x.beginPath(); x.arc(sx + (r() - .5) * 12, sy + (r() - .5) * 12, 0.6 + r() * 2.6, 0, 7); x.fill(); } }
    if (a.burn > 0) {
      var e = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.72);
      e.addColorStop(0, "rgba(120,75,30,0)"); e.addColorStop(1, "rgba(110,65,25," + a.burn + ")"); x.fillStyle = e; x.fillRect(0, 0, w, h);
      [[0, 0, 14, 0], [w, 0, w - 14, 0], [0, 0, 0, 14], [0, h, 0, h - 14]].forEach(function (q) { var lg = x.createLinearGradient(q[0], q[1], q[2], q[3]); lg.addColorStop(0, "rgba(100,60,25," + a.burn * 0.8 + ")"); lg.addColorStop(1, "rgba(100,60,25,0)"); x.fillStyle = lg; x.fillRect(0, 0, w, h); });
    }
    paperCache[key] = 'url("' + cv.toDataURL("image/jpeg", 0.86) + '")';
    return paperCache[key];
  }

  var emblemN = 0;
  function emblem() {
    var id = "gg" + (++emblemN); // a unique gradient name per copy (a duplicate name hid the emblem in the prototype)
    return "<svg class='emblem' viewBox='0 0 60 60' aria-hidden='true'><defs><linearGradient id='" + id + "' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#f6dc94'/><stop offset='.5' stop-color='#b98a35'/><stop offset='1' stop-color='#f0d38a'/></linearGradient></defs>" +
      "<g fill='url(#" + id + ")' stroke='url(#" + id + ")'><line x1='14' y1='8' x2='14' y2='50' stroke-width='2'/><rect x='9' y='18' width='10' height='22'/><line x1='30' y1='4' x2='30' y2='44' stroke-width='2'/><rect x='25' y='10' width='10' height='26' fill='none' stroke-width='2'/><line x1='46' y1='14' x2='46' y2='56' stroke-width='2'/><rect x='41' y='22' width='10' height='24'/></g></svg>";
  }
  function coverHTML(title, subtitle, byline) {
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
    return "<span class='cover-face'><span class='frame'></span><span class='gilt'>" + emblem() + "<span class='g t1'>" + esc(title) +
      "</span><span class='rule'></span><span class='g t2'>" + esc(subtitle) + "</span><span class='g by'>" + esc(byline) + "</span></span></span>";
  }
  var flourish = "<svg class='flourish' viewBox='0 0 200 20' aria-hidden='true'><path d='M5 10 C40 10 55 2 80 10 C90 13 95 13 100 10 C105 7 110 7 120 10 C145 18 160 10 195 10' fill='none' stroke='currentColor' stroke-width='1.1'/><circle cx='100' cy='10' r='2.2' fill='currentColor'/></svg>";

  window.ART = { leather: leather, wood: wood, marble: marble, paper: paper, coverHTML: coverHTML, flourish: flourish, LEATHER: "#a24735" };
})();
