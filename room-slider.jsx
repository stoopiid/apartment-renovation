/* global React */
// RoomSlider — the phase-scrubber for one room.
//
// Internally tracks `pos`, a float in [0, N-1]. As the user drags, adjacent
// phase images crossfade based on (pos - floor(pos)). The current phase
// (round(pos)) drives the caption and is the only slot accepting drops.
//
// Interaction: drag the handle, drag the track, click a tick to jump, or
// arrow-key to step. On release we snap to the nearest integer unless
// "Free scrub" is on (tweaks).

const { useState, useRef, useEffect, useCallback } = React;

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function RoomSlider({ room, phases, t, snap = true, showCaptions = true }) {
  const N = phases.length;
  const last = N - 1;
  // A future (planned) phase is locked for this room unless a preview photo
  // has already been added for it. maxIdx is the furthest reachable phase.
  const isLocked = useCallback((i) => !!phases[i].future && !room.images?.[i], [phases, room]);
  const maxIdx = (() => {
    let m = 0;
    for (let i = 0; i < phases.length; i++) {
      if (isLocked(i)) break;
      m = i;
    }
    return m;
  })();
  const [pos, setPos] = useState(0); // start at first phase
  const [dragging, setDragging] = useState(false);
  const [phaseRatios, setPhaseRatios] = useState({});
  const trackRef = useRef(null);
  const frameRef = useRef(null);

  const currentIdx = Math.round(pos);
  const currentPhase = phases[currentIdx];
  const currentCaption = room.captions[currentIdx];
  const photoRatio = phaseRatios[currentIdx] || null;

  useEffect(() => {
    setPhaseRatios({});
  }, [room.id]);

  // Map a clientX to a pos in [0, maxIdx] along the track.
  const xToPos = useCallback((clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    const u = clamp((clientX - r.left) / r.width, 0, 1);
    return clamp(u * last, 0, maxIdx);
  }, [last, maxIdx]);

  // Pointer drag on track or handle.
  const startDrag = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const tgt = trackRef.current;
    tgt.setPointerCapture && tgt.setPointerCapture(e.pointerId);
    setDragging(true);
    setPos(xToPos(e.clientX));

    const move = (ev) => setPos(xToPos(ev.clientX));
    const up = (ev) => {
      try { tgt.releasePointerCapture(ev.pointerId); } catch {}
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setDragging(false);
      if (snap) {
        setPos((p) => Math.round(p));
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  // Keyboard
  const onKey = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      setPos((p) => Math.max(0, Math.round(p) - 1));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      setPos((p) => Math.min(maxIdx, Math.round(p) + 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setPos(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setPos(maxIdx);
    }
  };

  const tickPct = (i) => (i / last) * 100;
  const handlePct = (pos / last) * 100;

  // Drag directly on the photo area to scrub phases (mobile-friendly).
  const onFramePointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!frameRef.current) return;

    const tgt = frameRef.current;
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = pos;
    let horizontal = false;

    tgt.setPointerCapture && tgt.setPointerCapture(e.pointerId);

    const move = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!horizontal) {
        const startedHorizontal = Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.15;
        if (!startedHorizontal) return;
        horizontal = true;
        setDragging(true);
      }

      if (ev.cancelable) ev.preventDefault();
      const w = Math.max(1, tgt.getBoundingClientRect().width);
      const delta = (dx / w) * last;
      setPos(clamp(startPos - delta, 0, maxIdx));
    };

    const up = (ev) => {
      try { tgt.releasePointerCapture(ev.pointerId); } catch {}
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (horizontal) setDragging(false);
      if (snap) setPos((p) => Math.round(p));
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const frameClass = [
    "phase-frame",
    photoRatio && photoRatio < 0.95 ? "is-photo-portrait" : "",
    photoRatio && photoRatio > 1.05 ? "is-photo-landscape" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className="scrub" aria-label={`${room.name} — ${t.site.phaseLabel}`}>
      {/* Phase frame with stacked, crossfading slots */}
      <div
        ref={frameRef}
        className={frameClass}
        style={{ "--room-aspect": room.aspect }}
        onPointerDown={onFramePointerDown}
      >
        <div className="phase-stack">
          {phases.map((p, i) => {
            const isCurrent = i === currentIdx;
            return (
              <div
                key={p.id}
                className="phase-image"
                style={{
                  opacity: isCurrent ? 1 : 0,
                  pointerEvents: isCurrent ? "auto" : "none",
                  zIndex: isCurrent ? 2 : 1,
                }}
                aria-hidden={!isCurrent}
              >
                {room.images?.[i] ? (
                  <img
                    src={room.images[i]}
                    alt={`${room.name} · ${p.short}`}
                    onLoad={(e) => {
                      const { naturalWidth, naturalHeight } = e.currentTarget;
                      if (!naturalWidth || !naturalHeight) return;
                      setPhaseRatios((prev) => {
                        const nextRatio = naturalWidth / naturalHeight;
                        if (prev[i] && Math.abs(prev[i] - nextRatio) < 0.001) return prev;
                        return { ...prev, [i]: nextRatio };
                      });
                    }}
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                ) : (
                  <div className="phase-placeholder">
                    {p.future ? t.site.workInProgress : `${room.name} · ${p.short}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="phase-badge" aria-live="polite">
          <span className="n">{currentPhase.n}</span>
          <span>{currentPhase.chip}</span>
        </div>
      </div>

      {/* Scrub track */}
      <div
        ref={trackRef}
        className="scrub-track-wrap"
        data-dragging={dragging ? "true" : "false"}
        onPointerDown={startDrag}
        role="slider"
        tabIndex={0}
        aria-valuemin={1}
        aria-valuemax={N}
        aria-valuenow={currentIdx + 1}
        aria-valuetext={`${t.site.phaseLabel} ${currentPhase.n} — ${currentPhase.full}`}
        onKeyDown={onKey}
      >
        <div className="scrub-track">
          <div className="scrub-fill" style={{ width: `${handlePct}%` }} />
          {phases.map((p, i) => {
            const isCurrent = i === currentIdx;
            const passed = i < pos - 0.01;
            return (
              <React.Fragment key={p.id}>
                <button
                  type="button"
                  className={`scrub-tick${isCurrent ? " is-current" : ""}${p.future ? " is-future" : ""}`}
                  data-passed={passed ? "true" : "false"}
                  style={{ left: `${tickPct(i)}%` }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isLocked(i)) setPos(i);
                  }}
                  disabled={isLocked(i)}
                  aria-label={`${t.site.phaseLabel} ${p.n} — ${p.full}`}
                />
                <span
                  className={`scrub-label${isCurrent ? " is-current" : ""}${p.future ? " is-future" : ""}`}
                  style={{
                    left: `${tickPct(i)}%`,
                    transform: i === 0 ? "translateX(0)" : (i === last ? "translateX(-100%)" : undefined),
                  }}
                >
                  {p.short}
                </span>
              </React.Fragment>
            );
          })}
          <div
            className="scrub-handle"
            style={{ left: `${handlePct}%` }}
            aria-hidden="true"
          >
            {currentPhase.n}
          </div>
        </div>
      </div>

      {showCaptions && (
        <div className="caption">
          <div className="caption-meta">
            <div>
              {t.site.phaseLabel} {currentPhase.n} {t.site.ofLabel} {String(N).padStart(2, "0")}
              <span className="full">{currentPhase.full}</span>
            </div>
          </div>
          <p className="caption-text">{currentCaption}</p>
        </div>
      )}
    </div>
  );
}

window.RoomSlider = RoomSlider;
