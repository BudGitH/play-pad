/* ============================================================================
 * FILE: map-icons.js
 * PURPOSE: The extra map icons (24 x 24 viewBox path constants, our own drawings) for the
 *          establishment registry (js/data/places.js): cart, cross, gate, Kaaba, swing, tree, bus, flats,
 *          hotel, hill, tent, palm, camel and horse. They join KQ.Game.Pictures.ICONS, so the radar
 *          (canvas Path2D) and the legend (inline SVG) draw them the same way. Holes are wound the
 *          other way round, as in the existing icons.
 * BUSINESS CONTEXT: playability round AC-P1: every kind of place has its own icon.
 * DEPENDENCIES: pictures.js (loaded before this file).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});

  const ICONS = {
    cart: "M2 3h3l.8 3H21l-2.2 8H8.2L5 5H2zM8.5 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm8 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
    cross: "M9 3h6v6h6v6h-6v6H9v-6H3V9h6z",
    gate: "M3 21V9a9 9 0 0 1 18 0v12h-5v-6a4 4 0 0 0-8 0v6z",
    kaaba: "M4 4h16v16H4zM4 8v2h16V8z",
    // map controls: zoom in, zoom out, centre on me, the places list
    plus: "M10.5 4h3v6.5H20v3h-6.5V20h-3v-6.5H4v-3h6.5z",
    minus: "M4 10.5h16v3H4z",
    locate:
      "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2.4a2.600 2.600 0 1 1 0 5.200 2.600 2.600 0 0 1 0-5.200zM11 2h2v4h-2zM11 18h2v4h-2zM2 11h4v2H2zM18 11h4v2h-4z",
    list: "M3 5h3v3H3zm5 .5h13v2H8zM3 10.500h3v3H3zm5 .5h13v2H8zM3 16h3v3H3zm5 .5h13v2H8z",
    swing:
      "M2 3h20v2.2H2zM3.5 4h2L3.7 21H1.5zM18.5 4h2l2 17h-2.2zM9 5h1.5v10h3V5H15v10h1.5v2.3h-9V15H9z",
    tree: "M12 2a6 6 0 0 0-5.7 7.9A4.5 4.5 0 0 0 7.5 18.9H11V22h2v-3.1h3.5a4.5 4.5 0 0 0 1.2-9A6 6 0 0 0 12 2z",
    bus: "M5 3h14a2 2 0 0 1 2 2v12a2 2 0 0 1-1 1.7V21h-3v-2H7v2H4v-2.3A2 2 0 0 1 3 17V5a2 2 0 0 1 2-2zM5 6v5h14V6zm2 8.5v2h2v-2zm8 0v2h2v-2z",
    flats:
      "M4 21V5l9-2v6h7v12zM6.5 7v2h2V7zm0 4.2v2h2v-2zm0 4.2v2h2v-2zm8 -3.900v2h2v-2zm0 4v2h2v-2z",
    hotel: "M5 21V4h14v17zM8 7v2h2V7zm6 0v2h2V7zm-6 5v2h2v-2zm6 0v2h2v-2zm-3.500 5v4h3v-4z",
    hill: "M1 20 9 6l3.5 6 2.5-3.500L23 20z",
    tent: "M12 3 2 20h20zM12 11l3.600 7H8.400z",
    palm: "M11 22v-9.500h2V22zM12 12.500Q6 4 1 9.500 7 8.500 12 12.500zM12 12.500Q18 4 23 9.500 17 8.500 12 12.500zM12 12.500Q8.500 2.500 12 1 15.500 2.500 12 12.500z",
    camel:
      "M5 11a2.500 3.200 0 0 1 5 0zM10.500 11a2.500 3.200 0 0 1 5 0zM4 11h12.500v4.200H4zM15 11.500 17.200 5.200 19.400 6 17.600 12.500zM17.200 5.200 17.400 3.300 22.500 3.600 22.800 5.200 20 5.600zM5 15h1.800v6H5zM8 15h1.800v6H8zM11.500 15h1.800v6h-1.800zM14.500 15h1.800v6h-1.800zM4 11.500 2.400 14.800 4.500 14z",
    horse:
      "M4 10h12.500v4.500H4zM14 10.500 15.500 3.500 18.200 3 18.600 4.400 16.800 11zM16 3.800l-.1-1.500 1.600-1 2.200 1.800 2.300 2.700-.3 1.700-2.300.3-1.300-1zM5 14.500h1.800v6.500H5zM8.200 14.500H10V21H8.200zM12 14.500h1.800V21H12zM14.800 14.500h1.700V21h-1.700zM4 10.500 1.800 15.500l1.800-.5 1.400-3.500z",
  };

  Object.assign(G.Pictures.ICONS, ICONS);
  G.MapIcons = { ICONS };
})((window.KQ = window.KQ || {}));
