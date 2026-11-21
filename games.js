/* ============================================================================
   PlayPad — game registry
   ----------------------------------------------------------------------------
   The catalog (index.html) renders one card per entry below, so adding a game
   is a ONE-OBJECT change: append an object here and drop the game's files in
   games/<id>/.

   Loaded with a classic <script src> tag (NOT fetch / NOT an ES module) so the
   site works straight from the file system (file://), where fetching local
   JSON is blocked.

   Entry shape (required fields):
     id          stable slug; matches the folder under games/
     title       display name
     description full blurb (shown in full only on the wide featured card)
     tags        array of short labels (kept for the registry; not shown on cards)
     path        relative link to the game (trailing slash → its index.html)
     accent      brand colour for the card tile, as a hex colour (#rgb … #rrggbbaa)
     icon        emoji/glyph shown on the card tile
     players     "1" = Solo; anything else (e.g. "2–4") = play together. Drives
                 the Solo / Play together filter and the mode badge.
     status      "live" (playable) | "soon" (dimmed placeholder, not a link)

   Optional fields (all fall back sensibly when left out — PLAY-006):
     tagline     card copy, one short line (≤ 40 chars). Falls back to
                 description, clamped to two lines.
     added       ISO date ("2026-11-10"). Shows a "New" badge for 30 days, until
                 the player launches the game from the hub or has a best score.
     best        { key, field, label? } — where the game keeps its best score:
                 localStorage key + the numeric field inside that JSON object.
                 Shows a "Best 12,480" badge once the stored value is a finite
                 number from 1 to 1e9. label defaults to "Best". The field must be a
                 TOP-LEVEL number: a game that keeps a best per mode also saves a
                 `bestOverall` (the max) for the hub to read.
   ========================================================================== */
window.GAMES = [
  {
    id: "colour-rush",
    title: "Colour Rush",
    tagline: "Tap your colour before it vanishes.",
    description:
      "Coloured dots scatter across the screen — tap your own colour before it vanishes. Quickest, most selective hands win.",
    tags: ["Multiplayer", "Reflex", "Local"],
    path: "games/colour-rush/",
    accent: "#ff375f",
    icon: "🎯",
    players: "2–4",
    status: "live",
  },
  {
    id: "snap",
    title: "Snap",
    tagline: "Spot the match — slap first!",
    description:
      "Two cards flip face-up. If they match, slap your button before anyone else. Sharpest eyes and fastest hands win.",
    tags: ["Multiplayer", "Reflex", "Local"],
    path: "games/snap/",
    accent: "#bf5af2",
    icon: "🃏",
    players: "2–4",
    status: "live",
  },
  {
    id: "claw-catch",
    title: "Claw Catch",
    tagline: "Swing, drop and snag the rare prize.",
    description:
      "Steer the claw, time its swing, and drop to snag themed prizes from the bin. Rarer prizes pay more — but grip the worst. Beat the clock solo.",
    tags: ["Solo", "Arcade", "Skill"],
    path: "games/claw-catch/",
    accent: "#64d2ff",
    icon: "🕹️",
    players: "1",
    status: "live",
    best: { key: "playpad.clawCatch.v1", field: "bestOverall", label: "Best" },
  },
  {
    id: "super-decoder",
    title: "Super Decoder",
    tagline: "Crack the secret colour code.",
    description:
      "Crack a hidden 4-colour code in up to 10 guesses. Solid dot = right spot, ring = right colour but wrong spot. Solve a streak before your luck runs out.",
    tags: ["Solo", "Logic", "Code-breaking"],
    path: "games/super-decoder/",
    accent: "#30d158",
    icon: "🔐",
    players: "1",
    status: "live",
    best: { key: "playpad.superDecoder.v1", field: "bestOverall", label: "Best" },
  },
  {
    id: "sunset-stride",
    title: "Sunset Stride",
    tagline: "A golden-hour jog with the dogs on your heels.",
    description:
      "Jog through a sunlit town in 3D — swap lanes, hop hurdles, skid under bars and dodge vans while a pack of dogs chases you from behind. Trip once and they catch up; trip again in quick succession and you're caught. Coins buy new outfits in the shop.",
    tags: ["Solo", "3D", "Runner"],
    path: "games/sunset-stride/",
    accent: "#ff8a3d",
    icon: "🌇",
    players: "1",
    status: "live",
    added: "2026-11-21",
    best: { key: "playpad.sunsetStride.v1", field: "highScore", label: "Best" },
  },
];
