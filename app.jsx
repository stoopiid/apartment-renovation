/* global React, ReactDOM, RoomSlider */

const { useState, useEffect } = React;

function Header({ lang, setLang, t }) {
  return (
    <header className="topbar">
      <div className="mark">
        <strong>{t.site.title}</strong>
      </div>
      <div className="lang" role="group" aria-label={t.site.languageLabel}>
        <button
          type="button"
          aria-pressed={lang === "en"}
          onClick={() => setLang("en")}
        >
          EN
        </button>
        <button
          type="button"
          aria-pressed={lang === "nl"}
          onClick={() => setLang("nl")}
        >
          NL
        </button>
      </div>
    </header>
  );
}

function Hero({ t }) {
  // Splits the title at first space and italicises the tail — gives the
  // serif display a touch of motion. NL falls back gracefully.
  const title = t.site.title;
  const parts = title.split(" ");
  const head = parts.shift();
  const tail = parts.join(" ");
  return (
    <section className="hero">
      <div className="eyebrow">
        <span>{t.site.lastUpdated} · {t.site.lastUpdatedDate}</span>
      </div>
      <h1>
        {head}
        {tail && <> <em>{tail}</em></>}
      </h1>

      <div className="hero-meta">
        <div>
          ··· <span>{t.site.currentlyAt}</span>
        </div>
      </div>
    </section>
  );
}

function Legend({ t }) {
  return (
    <section className="legend" aria-labelledby="legend-h">
      <h2 id="legend-h">{t.site.legendLabel}</h2>
      <ol>
        {t.phases.map((p) => (
          <li key={p.id} className={p.future ? "is-future" : ""}>
            <div className="n">{p.n}</div>
            <div className="name">{p.full}</div>
            {p.date && <div className="blurb">{p.date}</div>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Room({ room, phases, t, snap, showCaptions }) {
  return (
    <section className="room" aria-labelledby={`room-${room.id}-h`}>
      <div className="room-head">
        <div>
          <div className="room-num">
            <span>Room {room.n}</span>
          </div>
          <h2 className="room-name" id={`room-${room.id}-h`}>{room.name}</h2>
        </div>
      </div>
      <RoomSlider
        room={room}
        phases={phases}
        t={t}
        snap={snap}
        showCaptions={showCaptions}
      />
    </section>
  );
}

function Footer({ t }) {
  return (
    <footer className="foot">
      <span className="sig">{t.site.lastUpdated} · {t.site.lastUpdatedDate}</span>
    </footer>
  );
}

function App() {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("reno_lang") || "nl"; }
    catch { return "nl"; }
  });
  useEffect(() => { try { localStorage.setItem("reno_lang", lang); } catch {} }, [lang]);

  const t = window.CONTENT[lang];

  return (
    <>
      <Header lang={lang} setLang={setLang} t={t} />
      <Hero t={t} />
      <Legend t={t} />
      {t.rooms.map((room) => (
        <Room
          key={room.id}
          room={room}
          phases={t.phases}
          t={t}
          snap={true}
          showCaptions={false}
        />
      ))}
      <Footer t={t} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
