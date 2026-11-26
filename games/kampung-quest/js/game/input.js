/* ============================================================================
 * FILE: input.js
 * PURPOSE: Keyboard, touch joystick, run toggle and camera-drag input for Kampung Quest.
 *          Produces a movement vector, camera look deltas and shortcut callbacks.
 * BUSINESS CONTEXT: AC-2 (WASD/arrows, Shift run, touch joystick + run toggle, mouse /
 *   two-finger camera) and AC-15 (fully playable by keyboard; shortcuts E, 1-4, M, J, P, Esc).
 * DEPENDENCIES: util.js. DOM elements are passed to attach(); nothing is global but KQ.Game.Input.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const MOVE_KEYS = {
    KeyW: [0, 1],
    ArrowUp: [0, 1],
    KeyS: [0, -1],
    ArrowDown: [0, -1],
    KeyA: [-1, 0],
    ArrowLeft: [-1, 0],
    KeyD: [1, 0],
    ArrowRight: [1, 0],
  };
  const SHORTCUTS = {
    KeyE: "interact",
    KeyM: "map",
    KeyJ: "missions",
    KeyP: "pray",
    KeyB: "bag",
    Escape: "escape",
    Digit1: "tile1",
    Digit2: "tile2",
    Digit3: "tile3",
    Digit4: "tile4",
    Comma: "camLeft",
    Period: "camRight",
  };
  const JOY_RADIUS = 44;

  const keys = new Set();
  const virtual = new Set();
  const state = { joyX: 0, joyY: 0, runToggle: false, lookX: 0, lookY: 0, zoom: 0 };
  const pointers = new Map();
  let handler = null;
  let lastKeyboard = false;

  function axis(neg, pos) {
    return (pos ? 1 : 0) - (neg ? 1 : 0);
  }

  function held(code) {
    return keys.has(code) || virtual.has(code);
  }

  /** Current movement intent: x = right, y = forward, each -1..1, plus the run flag. */
  function move() {
    let x = 0;
    let y = 0;
    Object.keys(MOVE_KEYS).forEach(function (code) {
      if (!held(code)) return;
      x += MOVE_KEYS[code][0];
      y += MOVE_KEYS[code][1];
    });
    x += state.joyX;
    y += state.joyY;
    const mag = Math.min(1, Math.hypot(x, y));
    const len = Math.hypot(x, y) || 1;
    const run = held("ShiftLeft") || held("ShiftRight") || state.runToggle;
    return { x: (x / len) * mag, y: (y / len) * mag, mag, run };
  }

  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    lastKeyboard = true;
    document.body.classList.add("kq-kbd");
    keys.add(e.code);
    const name = SHORTCUTS[e.code];
    if (MOVE_KEYS[e.code] || name === "interact") {
      if (!(e.target && e.target.closest && e.target.closest("input, select, textarea"))) {
        e.preventDefault();
      }
    }
    if (name && !e.repeat && handler) handler(name, e);
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  function onPointerDownLook(e) {
    if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2) return;
    document.body.classList.remove("kq-kbd");
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId);
  }

  function pinchStep(a, b, prevA, prevB) {
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const pd = Math.hypot(prevA.x - prevB.x, prevA.y - prevB.y);
    state.zoom += (pd - d) * 0.02;
    const ang = Math.atan2(b.y - a.y, b.x - a.x) - Math.atan2(prevB.y - prevA.y, prevB.x - prevA.x);
    state.lookX += ang * 120;
  }

  function onPointerMoveLook(e) {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const was = { x: prev.x, y: prev.y };
    prev.x = e.clientX;
    prev.y = e.clientY;
    if (pointers.size === 1) {
      state.lookX += e.clientX - was.x;
      state.lookY += e.clientY - was.y;
      return;
    }
    const ids = Array.from(pointers.keys());
    if (e.pointerId !== ids[0]) return;
    const other = pointers.get(ids[1]);
    pinchStep(prev, other, was, other);
  }

  function onPointerUpLook(e) {
    pointers.delete(e.pointerId);
  }

  function setJoy(el, knob, e) {
    const r = el.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > JOY_RADIUS) {
      dx = (dx / len) * JOY_RADIUS;
      dy = (dy / len) * JOY_RADIUS;
    }
    knob.style.transform = "translate(" + dx + "px," + dy + "px)";
    const dead = len < 6 ? 0 : 1;
    state.joyX = (dx / JOY_RADIUS) * dead;
    state.joyY = (-dy / JOY_RADIUS) * dead;
  }

  function attachJoystick(el, knob) {
    let id = null;
    el.addEventListener("pointerdown", function (e) {
      id = e.pointerId;
      el.setPointerCapture(id);
      setJoy(el, knob, e);
      e.preventDefault();
    });
    el.addEventListener("pointermove", function (e) {
      if (e.pointerId === id) setJoy(el, knob, e);
    });
    const end = function (e) {
      if (e.pointerId !== id) return;
      id = null;
      state.joyX = state.joyY = 0;
      knob.style.transform = "translate(0px,0px)";
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  /** Wire the DOM: the stage (camera drag), the joystick and the run toggle. */
  function attach(opts) {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", () => keys.clear());
    const st = opts.stage;
    st.addEventListener("pointerdown", onPointerDownLook);
    st.addEventListener("pointermove", onPointerMoveLook);
    st.addEventListener("pointerup", onPointerUpLook);
    st.addEventListener("pointercancel", onPointerUpLook);
    st.addEventListener("contextmenu", (e) => e.preventDefault());
    st.addEventListener(
      "wheel",
      function (e) {
        state.zoom += U.clamp(e.deltaY, -120, 120) * 0.004;
        e.preventDefault();
      },
      { passive: false },
    );
    attachJoystick(opts.joystick, opts.knob);
  }

  G.Input = {
    attach,
    move,
    held,
    axis,
    setHandler(fn) {
      handler = fn;
    },
    /** Camera look deltas since the last call (pixels) and zoom, then reset. */
    takeLook() {
      const out = { x: state.lookX, y: state.lookY, zoom: state.zoom };
      state.lookX = state.lookY = state.zoom = 0;
      return out;
    },
    toggleRun(on) {
      state.runToggle = on === undefined ? !state.runToggle : Boolean(on);
      return state.runToggle;
    },
    isRunToggled: () => state.runToggle,
    usedKeyboard: () => lastKeyboard,
    /** Test / assistive hook: hold or release a named action ("up", "left", "run", "interact"...). */
    virtual(action, on) {
      const map = {
        up: "ArrowUp",
        down: "ArrowDown",
        left: "ArrowLeft",
        right: "ArrowRight",
        run: "ShiftLeft",
      };
      const code = map[action];
      if (code) {
        if (on) virtual.add(code);
        else virtual.delete(code);
        return true;
      }
      if (SHORTCUTS[action] === undefined && Object.values(SHORTCUTS).indexOf(action) === -1) {
        return false;
      }
      if (on && handler) handler(action, null);
      return true;
    },
    clearVirtual() {
      virtual.clear();
    },
  };
})((window.KQ = window.KQ || {}));
