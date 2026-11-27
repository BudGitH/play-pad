/* ============================================================================
 * FILE: region.js
 * PURPOSE: The region picker (big picture cards on the title screen and in the pause menu),
 *          switching region (save, then reload with ?region=), and the few per-region boot
 *          facts: where the hero starts, the welcome line and the title-screen camera.
 * BUSINESS CONTEXT: features/kampung-quest-haramain/requirements.md (region contract); the owner
 *   wants regions as variety: the kampung stays exactly as it was, each region has its own save
 *   slot (KQ.Sim.Save keys it by KQ.region) and new regions are one entry in KQ.Region.LIST.
 * DEPENDENCIES: util.js, ui-core.js, KQ.Region (data/region.js), KQ.Holy (world, optional).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const SVG_NS = "http://www.w3.org/2000/svg";

  /** The picture of a region card (our own SVG constants, never player text). */
  function art(entry) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 160 100");
    svg.setAttribute("class", "kq-region-art");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = entry.art;
    return svg;
  }

  /** Go to another region: save the game, then reload with ?region= (which also remembers it). */
  function switchTo(id) {
    if (id === KQ.region || KQ.Region.IDS.indexOf(id) === -1) return false;
    const s = G.S;
    if (s && s.started) {
      G.Loop.save();
      s.started = false; // no autosave after this point (the page is about to reload)
    }
    KQ.Region.writeSaved(id);
    const url = new URL(window.location.href);
    url.searchParams.set("region", id);
    window.location.replace(url.toString());
    return true;
  }

  /** One big picture card: the picture, the name, a short line, and "You are here" on the current region. */
  function card(entry, onPick) {
    const here = entry.id === KQ.region;
    return U.el(
      "button",
      {
        type: "button",
        cls: "kq-region-card" + (here ? " is-here" : ""),
        "data-region": entry.id,
        "aria-pressed": here ? "true" : "false",
        "aria-label": entry.name + ". " + entry.tagline + (here ? ". You are here." : ""),
        on: { click: () => onPick(entry.id) },
      },
      art(entry),
      U.el("b", { text: entry.name }),
      U.el("span", { cls: "kq-small", text: entry.tagline }),
      here ? U.el("i", { cls: "kq-tag", text: "You are here" }) : null,
    );
  }

  /** The row of region cards. `onPick(id)` runs on a tap (default: switch region). */
  function picker(onPick) {
    const pick = onPick || ((id) => switchTo(id));
    return U.el(
      "div",
      { cls: "kq-regions", role: "group", "aria-label": "Choose where to play" },
      KQ.Region.LIST.map((entry) => card(entry, pick)),
    );
  }

  /** Pause menu: a sheet with the cards; "Keep playing here" returns to the pause menu. */
  function openSheet(o) {
    const box = U.el(
      "div",
      { cls: "kq-menu kq-card" },
      G.UI.header("Change region"),
      U.el("p", { cls: "kq-story", text: "Each place keeps its own saved game." }),
      picker((id) => (id === KQ.region ? h.close("same") : switchTo(id))),
      U.el(
        "div",
        { cls: "kq-bubble-actions" },
        G.UI.btn("Stay here", { cls: "primary", onClick: () => h.close("same") }),
      ),
    );
    const h = G.UI.openSheet({ el: box, label: "Change region", onClose: o && o.onClose, focus: ".kq-region-card" });
    return h;
  }

  /** The title screen: card row, the region's own one-line lead and its loading-step names. */
  function applyTitle(host, lead) {
    const entry = KQ.Region.get();
    if (host) host.appendChild(picker());
    if (lead) lead.textContent = entry.lead;
    return entry.steps || null;
  }

  /** Where a haramain game starts: the saved spot when there is one, else the hotel forecourt. */
  function holyStart(simPos) {
    const sp = KQ.HOLY.spawn;
    const pos = simPos || { x: sp.x, z: sp.z };
    return { x: pos.x, z: pos.z, heading: simPos ? 0 : 0, fresh: !simPos };
  }

  /** The first-visit line for a region (null = the kampung's own Nenek line stays). */
  function welcome() {
    return KQ.region === "haramain"
      ? "Welcome to Makkah. Walk to the Kaaba, or open the map. Take your time."
      : null;
  }

  /** Title-screen camera (orbit angle a) for a region, or null for the kampung's own. */
  function titleCamera(a) {
    if (KQ.region !== "haramain" || !KQ.Holy || !KQ.Holy.titleCamera) return null;
    return KQ.Holy.titleCamera(a);
  }

  G.Region = { picker, openSheet, switchTo, applyTitle, holyStart, welcome, titleCamera };
})((window.KQ = window.KQ || {}));
