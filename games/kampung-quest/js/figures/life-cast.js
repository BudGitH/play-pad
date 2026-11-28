// Kampung Quest — the extra faces of the town's little moments: the two Makkah / Madinah guides who
// give missions, and the people who appear in world events (a wedding party, a volunteer, a
// family, kids with a ball, an ice-cream seller). All modestly dressed, same toy style as the cast
// (they are copies of cast specs with new colours, so the figure builder needs nothing new).
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const C = F.CAST;

  /** A copy of a cast spec with some fields replaced (id and name are always new). */
  function like(base, id, name, over) {
    return Object.assign({}, C[base], { id, name }, over || {});
  }

  /** A kid in a plain tee, with their own shirt, shorts and hair colour. */
  function kid(id, base, tee, legs, hair) {
    return like(base, id, "Kid", {
      torso: tee,
      arms: tee,
      legs,
      head: Object.assign({}, C[base].head, { colour: hair }),
    });
  }

  const thobe = (id, name, tone) =>
    like("imam_hakim", id, name, {
      torso: tone,
      arms: tone,
      legs: tone,
      skirt: { top: tone, upper: tone, lower: tone },
    });

  const EXTRA = {
    guide_makkah: like("imam_hakim", "guide_makkah", "Ustaz Bilal", {
      head: { type: "kopiah", colour: "#fbfaf5", accent: "#2f8f5a" },
    }),
    guide_madinah: like("librarian_farah", "guide_madinah", "Ustazah Mariam", {
      torso: "#2f7466",
      arms: "#2f7466",
      legs: "#2f7466",
      skirt: { top: "#2f7466", upper: "#2f7466", lower: "#25594f" },
      head: { type: "tudung", colour: "#f4f1e8", accent: "#2f8f5a" },
      face: { mouth: "smile", lashes: true, blush: true },
    }),
    ev_kid_red: kid("ev_kid_red", "kid_irfan", "#e45b5b", "#2d5aa0", "#1d1410"),
    ev_kid_blue: kid("ev_kid_blue", "kid_wei", "#3f74e8", "#3a6e3a", "#141012"),
    ev_kid_green: kid("ev_kid_green", "kid_irfan", "#4bb36a", "#3b3f4a", "#2a1a12"),
    ev_kid_girl: like("kid_aisyah", "ev_kid_girl", "Kid", {
      torso: "#e8789a",
      arms: "#e8789a",
      legs: "#e8789a",
      skirt: { top: "#e8789a", upper: "#e8789a", lower: "#c85f80" },
    }),
    ev_seller: like("uncle_lim", "ev_seller", "Ice-cream seller", {
      torso: "#f4f1e8",
      arms: "#f4f1e8",
      head: { type: "cap", colour: "#e8453c", peak: "#c9372f", badge: "#f6c945", hair: "#3a2416" },
    }),
    ev_groom: like("atuk", "ev_groom", "Groom", {
      torso: "#c9a13a",
      arms: "#c9a13a",
      legs: "#c9a13a",
      skirt: { upper: "#7a1f3a" },
      head: { type: "songkok", colour: "#1c1c22", hair: "#2a1c14" },
      face: { mouth: "smile", hairColour: "#2a1c14" },
    }),
    ev_bride: like("makcik_siti", "ev_bride", "Bride", {
      torso: "#f2d8e4",
      arms: "#f2d8e4",
      legs: "#f2d8e4",
      skirt: { top: "#f2d8e4", upper: "#f2d8e4", lower: "#e6b8cf" },
      head: { type: "tudung", colour: "#fbf3f7", accent: "#d9b04a" },
    }),
    ev_drummer1: like("pakcik_rahman", "ev_drummer1", "Drummer", {
      torso: "#2f7466",
      arms: "#2f7466",
      legs: "#2f7466",
    }),
    ev_drummer2: like("kid_irfan", "ev_drummer2", "Drummer", { torso: "#d9822b", arms: "#d9822b" }),
    ev_umbrella1: like("aunty_mei", "ev_umbrella1", "Passer-by"),
    ev_umbrella2: like("atuk", "ev_umbrella2", "Passer-by", { torso: "#4a6fa5", arms: "#4a6fa5" }),
    ev_volunteer: thobe("ev_volunteer", "Volunteer", "#f3f1ea"),
    ev_dad: like("pakcik_rahman", "ev_dad", "Visitor", { torso: "#f3f1ea", arms: "#f3f1ea" }),
    ev_mum: like("dr_nurul", "ev_mum", "Visitor", {
      torso: "#6f5aa8",
      arms: "#6f5aa8",
      legs: "#6f5aa8",
      skirt: { top: "#6f5aa8", upper: "#6f5aa8", lower: "#5a4890" },
      head: { type: "tudung", colour: "#e8d8f4", accent: "#ffffff" },
    }),
    ev_child: kid("ev_child", "kid_irfan", "#f0c419", "#2d5aa0", "#1d1410"),
  };
  Object.keys(EXTRA).forEach((id) => (C[id] = EXTRA[id]));
  F.LIFE_CAST = Object.keys(EXTRA);
})((window.KQ = window.KQ || {}));
