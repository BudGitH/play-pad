/* ============================================================================
   PlayPad — game registry
   ----------------------------------------------------------------------------
   The catalog (index.html) renders one card per entry below, so adding a game
   is a ONE-OBJECT change: append an object here and drop the game's files in
   games/<id>/.

   Loaded with a classic <script src> tag (NOT fetch / NOT an ES module) so the
   site works straight from the file system (file://), where fetching local
   JSON is blocked.

   Entry shape:
     id          stable slug; matches the folder under games/
     title       display name
     description short blurb (~1–3 lines on the card)
     tags        array of short labels → rendered as chips
     path        relative link to the game (trailing slash → its index.html)
     accent      brand-coloured tile for the card header
     icon        emoji/glyph shown on the card tile
     players     optional metadata line (e.g. "2–4")
     status      "live" (playable) | "soon" (dimmed placeholder)
   ========================================================================== */
window.GAMES = [
  {
    id: "colour-rush",
    title: "Colour Rush",
    description:
      "Coloured dots scatter across the screen — tap your own colour before it vanishes. Quickest, most selective hands win.",
    tags: ["Multiplayer", "Reflex", "Local"],
    path: "games/colour-rush/",
    accent: "#ff375f",
    icon: "🎯",
    players: "2–4",
    status: "live"
  },
  {
    id: "snap",
    title: "Snap",
    description:
      "Two cards flip face-up. If they match, slap your button before anyone else. Sharpest eyes and fastest hands win.",
    tags: ["Multiplayer", "Reflex", "Local"],
    path: "games/snap/",
    accent: "#bf5af2",
    icon: "🃏",
    players: "2–4",
    status: "live"
  },
  {
    id: "claw-catch",
    title: "Claw Catch",
    description:
      "Steer the claw, time its swing, and drop to snag themed prizes from the bin. Rarer prizes pay more — but grip the worst. Beat the clock solo.",
    tags: ["Solo", "Arcade", "Skill"],
    path: "games/claw-catch/",
    accent: "#64d2ff",
    icon: "🕹️",
    players: "1",
    status: "live"
  },
  {
    id: "super-decoder",
    title: "Super Decoder",
    description:
      "Crack a hidden 4-colour code in up to 10 guesses. Black peg = right colour, right spot. White peg = right colour, wrong spot. Solve a streak before your luck runs out.",
    tags: ["Solo", "Logic", "Code-breaking"],
    path: "games/super-decoder/",
    accent: "#30d158",
    icon: "🔐",
    players: "1",
    status: "live"
  },
  {
    id: "neon-rush",
    title: "Neon Rush",
    description:
      "Sprint through a neon city in 3D — swap lanes, jump barriers and slide under them, dodge trains, grab coins, and outrun the patrol drone. Coins buy new runners in the shop.",
    tags: ["Solo", "3D", "Runner"],
    path: "games/neon-rush/",
    accent: "#ff2d95",
    icon: "🏃",
    players: "1",
    status: "live"
  }
];
