/* metaspike — LISTS view: events index + expandable individual decklists.
   Exports window.MSLists = { ListsView }.  Loaded after shared.jsx. */
(function () {
  const { useState } = React;
  const M = window.MTG;
  const { Pips, fmtPct } = window.MSShared;
  const TOTAL = M.TOTAL;

  const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtDate = (iso) => { const [, m, d] = iso.split("-").map(Number); return `${MO[m - 1]} ${d}`; };
  const short = (n) => n.split(" // ")[0];
  const rankTier = (r) => (r === 1 ? "t1" : r <= 3 ? "t3" : r <= 8 ? "t8" : "t16");

  // ---- per-card "how common across the field" indicator --------------------
  function Field({ pct, spice }) {
    return (
      <span className={"msl-field" + (spice ? " sp" : "")} title={`${fmtPct(pct)}% of ${TOTAL} field lists run this card`}>
        <span className="msl-fbar"><span style={{ width: fmtPct(pct) + "%" }} /></span>
        <span className="msl-fpct">{fmtPct(pct)}<i>%</i></span>
      </span>
    );
  }

  function Export({ deck }) {
    const [done, setDone] = useState(false);
    const go = (e) => {
      e.stopPropagation();
      const txt = M.exportDeckMTGO(deck);
      if (navigator.clipboard) navigator.clipboard.writeText(txt);
      setDone(true); setTimeout(() => setDone(false), 1400);
    };
    return <button className="ms-export msl-export" onClick={go}><span>⎘</span> {done ? "COPIED" : "EXPORT MTGO"}</button>;
  }

  function DetailHeader({ deck }) {
    return (
      <div className="msl-dh">
        <div className="msl-dhl">
          <span className={"msl-dhrank " + rankTier(deck.rank)}>{deck.rank_label}</span>
          <div className="msl-dhwho">
            <div className="msl-dhplayer">{deck.player}</div>
            <div className="msl-dhmeta">
              <span>{deck.event_name}</span><b className="msl-sc">{deck.event_scope}</b>
              <i>·</i><span>{fmtDate(deck.event_date)}</span>
              <i>·</i><span className="msl-rec">{deck.record}</span>
              <i>·</i><span>{deck.entrants} entrants</span>
            </div>
          </div>
        </div>
        <Export deck={deck} />
      </div>
    );
  }

  // ===== Treatment A — classic type-grouped columns =========================
  function DetailColumns({ deck, showSpice, onHover, onLeave }) {
    const Line = (l, key) => (
      <div key={key}
        className={"msl-line" + (showSpice && l.spice ? " is-spice" : "")}
        onMouseEnter={(e) => onHover(l, e)} onMouseMove={(e) => onHover(l, e)} onMouseLeave={onLeave}>
        <span className="msl-qty">{l.qty}</span>
        <span className="msl-cn">{short(l.card)}{showSpice && l.spice && <span className="msl-spdot" />}</span>
        <Field pct={l.field_pct} spice={showSpice && l.spice} />
      </div>
    );
    const Group = (g, zoneKey) => (
      <div className="msl-grp" key={zoneKey + g.type}>
        <div className="msl-grphd"><span>{g.type}</span><b>{g.count}</b></div>
        {g.cards.map((l, i) => Line(l, zoneKey + g.type + i))}
      </div>
    );
    return (
      <div className="msl-cols">
        <div className="msl-colmain">
          <div className="msl-zhd">MAINDECK<b>{deck.main_count}</b></div>
          <div className="msl-grpgrid">{deck.groups_main.map((g) => Group(g, "m"))}</div>
        </div>
        <div className="msl-colside">
          <div className="msl-zhd">SIDEBOARD<b>{deck.side_count}</b></div>
          <div className="msl-sblist">{deck.side.map((l, i) => Line(l, "s" + i))}</div>
        </div>
      </div>
    );
  }

  // ===== Treatment B — field rows (art + meters) ============================
  function DetailRows({ deck, showSpice, showArt, onHover, onLeave }) {
    const Row = (l, key) => (
      <div key={key}
        className={"msl-brow" + (showSpice && l.spice ? " is-spice" : "")}
        onMouseEnter={(e) => onHover(l, e)} onMouseMove={(e) => onHover(l, e)} onMouseLeave={onLeave}>
        <span className="msl-bqty">{l.qty}<i>×</i></span>
        {showArt && <span className="ms-thumb"><img src={l.art_url} alt="" loading="lazy" /></span>}
        <span className="ms-name">
          <span className="ms-nm">{short(l.card)}</span>
          <span className="ms-meta"><Pips colors={l.colors} /><span className="ms-ty">{l.type_line}</span></span>
        </span>
        <span className="msl-bfield">
          <span className="ms-meter"><span style={{ width: fmtPct(l.field_pct) + "%" }} /></span>
          <span className="ms-pct">{fmtPct(l.field_pct)}<i>%</i></span>
        </span>
        {showSpice && l.spice ? <span className="msl-btag">SPICE</span> : <span className="msl-btag-x" />}
      </div>
    );
    return (
      <div className="msl-rows">
        <div className="msl-rowscol">
          <div className="msl-zhd">MAINDECK<b>{deck.main_count}</b></div>
          {deck.main.map((l, i) => Row(l, "m" + i))}
        </div>
        <div className="msl-rowscol">
          <div className="msl-zhd">SIDEBOARD<b>{deck.side_count}</b></div>
          {deck.side.map((l, i) => Row(l, "s" + i))}
        </div>
      </div>
    );
  }

  // ===== Treatment C — spice-forward ========================================
  function DetailSpice({ deck, onHover, onLeave }) {
    const compactCol = (groups) =>
      groups.map((g) => (
        <div className="msl-cgrp" key={g.type}>
          <span className="msl-cglabel">{g.type} · {g.count}</span>
          {g.cards.map((l, i) => (
            <span key={i} className={"msl-cline" + (l.spice ? " is-spice" : "")}
              onMouseEnter={(e) => onHover(l, e)} onMouseMove={(e) => onHover(l, e)} onMouseLeave={onLeave}>
              <b>{l.qty}</b> {short(l.card)}
            </span>
          ))}
        </div>
      ));
    return (
      <div className="msl-spv">
        <div className="msl-spstrip">
          <div className="msl-ss-hd"><span className="msl-spdot lg" /> WHAT MAKES THIS LIST DIFFERENT</div>
          {deck.spice.length ? (
            <div className="msl-ss-cards">
              {deck.spice.map((l, i) => (
                <div key={i} className="msl-spcard"
                  onMouseEnter={(e) => onHover(l, e)} onMouseMove={(e) => onHover(l, e)} onMouseLeave={onLeave}>
                  <span className="msl-spart"><img src={l.art_url} alt="" loading="lazy" /></span>
                  <div className="msl-spinfo">
                    <div className="msl-spline">
                      <span className="msl-spqty">{l.qty}×</span>
                      <span className="msl-spname">{short(l.card)}</span>
                    </div>
                    <span className="msl-spsub">
                      {l.zone === "side" && <b className="msl-sbtag">SB</b>}
                      only <b>{fmtPct(l.field_pct)}%</b> of the field
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="msl-ss-none">Stock list — nothing off-consensus.</div>}
        </div>
        <div className="msl-restcols">
          <div><div className="msl-resthd">MAINDECK<b>{deck.main_count}</b></div>{compactCol(deck.groups_main)}</div>
          <div><div className="msl-resthd">SIDEBOARD<b>{deck.side_count}</b></div>{compactCol(deck.groups_side)}</div>
        </div>
      </div>
    );
  }

  const DETAIL = { columns: DetailColumns, rows: DetailRows, spice: DetailSpice };

  // ---- one expandable list row + its detail --------------------------------
  function ListRow({ deck, open, onToggle, detailStyle, showSpice, showArt, onHover, onLeave }) {
    const Detail = DETAIL[detailStyle] || DetailColumns;
    const chips = deck.spice.slice(0, 2);
    const extra = deck.spice.length - chips.length;
    return (
      <div className={"msl-item" + (open ? " open" : "")}>
        <div className="msl-row" onClick={onToggle}>
          <span className={"msl-rank " + rankTier(deck.rank)}>{deck.rank_label}</span>
          <span className="msl-player">
            <b>{deck.player}</b>
            <span className="msl-psub">60 main · 15 side</span>
          </span>
          <span className="msl-record">{deck.record}</span>
          <span className="msl-spicecol">
            {showSpice && deck.spice.length ? (
              <>
                {chips.map((l, i) => <span key={i} className="msl-chip"><span className="msl-spdot" />{short(l.card)}</span>)}
                {extra > 0 && <span className="msl-chip more">+{extra}</span>}
              </>
            ) : <span className="msl-stock">{deck.spice.length ? `${deck.spice.length} off-meta` : "stock"}</span>}
          </span>
          <span className="msl-chev">{open ? "▾" : "▸"}</span>
        </div>
        {open && (
          <div className="msl-detail">
            <DetailHeader deck={deck} />
            <Detail deck={deck} showSpice={showSpice} showArt={showArt} onHover={onHover} onLeave={onLeave} />
          </div>
        )}
      </div>
    );
  }

  function ListsView({ detailStyle, showSpice, showArt, onHover, onLeave }) {
    const events = M.list_events();
    const [open, setOpen] = useState(events[0].decks[0].deck_id); // first list open by default
    const toggle = (id) => setOpen((cur) => (cur === id ? null : id));

    return (
      <div className="msl">
        <style>{LIST_CSS}</style>
        <div className="msl-colhd">
          <span>FINISH</span><span>PLAYER</span><span>RECORD</span>
          <span>SPICE — OFF-CONSENSUS CARDS</span><span></span>
        </div>
        {events.map((ev) => (
          <section key={ev.id} className="msl-ev">
            <div className="msl-evhd">
              <span className="msl-evtick" />
              <span className="msl-evname">{ev.name}</span>
              <span className="msl-evtag">{ev.scope}</span>
              <span className="msl-evdate">{fmtDate(ev.date)}</span>
              <span className="msl-evdot">·</span>
              <span className="msl-event">{ev.entrants} entrants</span>
              <span className="msl-evcount">{ev.n_decks} Boros Energy lists · top {ev.top_finish}</span>
            </div>
            {ev.decks.map((deck) => (
              <ListRow key={deck.deck_id} deck={deck} open={open === deck.deck_id}
                onToggle={() => toggle(deck.deck_id)}
                detailStyle={detailStyle} showSpice={showSpice} showArt={showArt}
                onHover={onHover} onLeave={onLeave} />
            ))}
          </section>
        ))}
      </div>
    );
  }

  const LIST_CSS = `
  .msl{--rankw:78px;}
  .msl-colhd{display:grid;grid-template-columns:var(--rankw) 1fr 80px 320px 44px;align-items:center;gap:18px;padding:0 26px;height:34px;
    font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:1.5px;color:var(--dim);border-bottom:1px solid var(--line);
    position:sticky;top:62px;background:var(--bg);z-index:20;}
  .msl-colhd>span{white-space:nowrap;overflow:hidden;}

  .msl-evhd{display:flex;align-items:center;gap:12px;padding:12px 26px 10px;background:var(--pan2);
    border-top:1px solid var(--line);border-bottom:1px solid var(--line);position:sticky;top:96px;z-index:15;}
  .msl-evtick{width:9px;height:9px;border-radius:2px;background:var(--acc);}
  .msl-evname{font-family:'IBM Plex Mono',monospace;font-weight:700;letter-spacing:.5px;font-size:14px;color:var(--ink);}
  .msl-evtag{font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:1.5px;color:var(--acc);border:1px solid var(--acc);border-radius:3px;padding:1px 7px;opacity:.85;}
  .msl-evdate{font-size:12.5px;color:var(--ink2);font-family:'IBM Plex Mono',monospace;}
  .msl-evdot{color:#444;} .msl-event{font-size:12px;color:var(--dim);}
  .msl-evcount{margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--dim);}

  .msl-item{border-bottom:1px solid #181a1f;}
  .msl-item.open{background:var(--pan2);}
  .msl-row{display:grid;grid-template-columns:var(--rankw) 1fr 80px 320px 44px;align-items:center;gap:18px;padding:0 26px;height:54px;cursor:pointer;transition:background .08s;}
  .msl-row:hover{background:var(--pan);}
  .msl-item.open>.msl-row{background:transparent;}

  .msl-rank{font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:15px;letter-spacing:-.5px;display:inline-flex;align-items:center;justify-content:center;
    height:28px;border-radius:5px;}
  .msl-rank.t1{background:var(--acc);color:var(--acc-ink);}
  .msl-rank.t3{color:var(--acc);border:1px solid var(--acc);}
  .msl-rank.t8{color:var(--ink2);border:1px solid var(--line);}
  .msl-rank.t16{color:var(--dim);border:1px solid #1e2026;}
  .msl-player{display:flex;flex-direction:column;gap:2px;min-width:0;}
  .msl-player b{font-size:14.5px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .msl-psub{font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--dim);letter-spacing:.5px;}
  .msl-record{font-family:'IBM Plex Mono',monospace;font-size:14px;color:var(--ink2);}
  .msl-spicecol{display:flex;align-items:center;gap:6px;flex-wrap:wrap;overflow:hidden;}
  .msl-chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--ink2);background:#16171b;border:1px solid var(--line);border-radius:20px;padding:3px 9px;white-space:nowrap;max-width:150px;overflow:hidden;text-overflow:ellipsis;}
  .msl-chip.more{color:var(--dim);background:transparent;}
  .msl-stock{font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:#5a5e67;letter-spacing:.5px;}
  .msl-spdot{width:6px;height:6px;border-radius:50%;background:var(--acc);flex:0 0 auto;box-shadow:0 0 8px var(--acc);}
  .msl-spdot.lg{width:8px;height:8px;}
  .msl-chev{font-size:12px;color:var(--dim);text-align:center;}

  /* ---- expanded detail shared ---- */
  .msl-detail{padding:4px 26px 26px;animation:mslin .16s ease;}
  @keyframes mslin{from{transform:translateY(-4px);}to{transform:none;}}
  .msl-dh{display:flex;align-items:center;gap:18px;padding:14px 0 16px;margin-bottom:14px;border-bottom:1px solid var(--line);}
  .msl-dhl{display:flex;align-items:center;gap:14px;}
  .msl-dhrank{font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:20px;height:40px;min-width:46px;padding:0 8px;display:inline-flex;align-items:center;justify-content:center;border-radius:7px;}
  .msl-dhrank.t1{background:var(--acc);color:var(--acc-ink);}
  .msl-dhrank.t3{color:var(--acc);border:1.5px solid var(--acc);}
  .msl-dhrank.t8,.msl-dhrank.t16{color:var(--ink2);border:1.5px solid var(--line);}
  .msl-dhplayer{font-size:22px;font-weight:700;letter-spacing:-.3px;}
  .msl-dhmeta{display:flex;align-items:center;gap:8px;margin-top:3px;font-size:12.5px;color:var(--dim);flex-wrap:wrap;}
  .msl-dhmeta i{font-style:normal;color:#444;} .msl-dhmeta b{font-weight:400;}
  .msl-dhmeta span{white-space:nowrap;}
  .msl-sc{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:1.5px;color:var(--acc);border:1px solid var(--acc);border-radius:3px;padding:1px 6px;opacity:.8;}
  .msl-rec{font-family:'IBM Plex Mono',monospace;color:var(--ink2);}
  .msl-export{margin-left:auto;align-self:flex-start;white-space:nowrap;}

  .msl-zhd{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--dim);margin-bottom:10px;display:flex;align-items:center;gap:8px;}
  .msl-zhd b{color:var(--ink2);background:#16171b;border:1px solid var(--line);border-radius:4px;padding:1px 7px;font-size:11px;letter-spacing:0;}

  /* Field indicator */
  .msl-field{display:inline-flex;align-items:center;gap:7px;margin-left:auto;flex:0 0 auto;}
  .msl-fbar{width:46px;height:4px;background:#1c1e24;border-radius:2px;overflow:hidden;}
  .msl-fbar span{display:block;height:100%;background:#3a3e48;border-radius:2px;}
  .msl-fpct{font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--dim);min-width:30px;text-align:right;}
  .msl-fpct i{font-style:normal;font-size:8px;}
  .msl-field.sp .msl-fbar span{background:var(--acc);} .msl-field.sp .msl-fpct{color:var(--acc);}

  /* Treatment A — columns */
  .msl-cols{display:grid;grid-template-columns:1fr 300px;gap:34px;}
  .msl-grpgrid{columns:2;column-gap:34px;}
  .msl-grp{break-inside:avoid;margin-bottom:16px;}
  .msl-grphd{display:flex;justify-content:space-between;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:1.5px;color:var(--acc);border-bottom:1px solid var(--line);padding-bottom:5px;margin-bottom:5px;}
  .msl-grphd b{color:var(--dim);font-weight:400;}
  .msl-line{display:flex;align-items:center;gap:10px;padding:4px 0;font-size:13.5px;}
  .msl-line:hover{color:#fff;}
  .msl-qty{font-family:'IBM Plex Mono',monospace;color:var(--ink2);min-width:14px;}
  .msl-cn{color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:7px;}
  .msl-line.is-spice .msl-cn{color:var(--acc);}
  .msl-line .msl-spdot{box-shadow:none;}
  .msl-colside{border-left:1px solid var(--line);padding-left:30px;}
  .msl-sblist .msl-line{border-bottom:1px dashed #1a1c21;}

  /* Treatment B — rows */
  .msl-rows{display:grid;grid-template-columns:1fr 1fr;gap:30px;align-items:start;}
  .msl-rowscol{min-width:0;}
  .msl-brow{display:grid;grid-template-columns:34px 40px 1fr 150px 54px;align-items:center;gap:12px;height:46px;border-bottom:1px solid #181a1f;padding:0 4px;}
  .ms-noart .msl-brow{grid-template-columns:34px 1fr 150px 54px;}
  .msl-brow:hover{background:var(--pan);}
  .msl-brow.is-spice{background:rgba(255,79,139,.05);}
  .msl-bqty{font-family:'IBM Plex Mono',monospace;font-size:15px;color:var(--ink);} .msl-bqty i{font-style:normal;font-size:10px;color:var(--dim);}
  .msl-bfield{display:flex;align-items:center;gap:9px;}
  .msl-bfield .ms-meter{width:80px;flex:0 0 auto;} .msl-bfield .ms-meter span{background:#3a3e48;}
  .msl-brow.is-spice .ms-meter span{background:var(--acc);}
  .msl-bfield .ms-pct{font-size:12px;min-width:34px;}
  .msl-btag{font-family:'IBM Plex Mono',monospace;font-size:8px;letter-spacing:1px;color:var(--acc);border:1px solid var(--acc);border-radius:3px;padding:2px 5px;text-align:center;opacity:.9;}
  .msl-btag-x{}

  /* Treatment C — spice-forward */
  .msl-spstrip{background:linear-gradient(180deg,rgba(255,79,139,.07),rgba(255,79,139,.02));border:1px solid rgba(255,79,139,.25);border-radius:10px;padding:16px 18px;margin-bottom:22px;}
  .msl-ss-hd{display:flex;align-items:center;gap:9px;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:2px;color:var(--acc);margin-bottom:14px;}
  .msl-ss-cards{display:flex;flex-wrap:wrap;gap:12px;}
  .msl-spcard{display:flex;gap:11px;align-items:center;background:#121317;border:1px solid var(--line);border-radius:9px;padding:9px 14px 9px 9px;min-width:230px;}
  .msl-spart{width:52px;height:46px;border-radius:5px;overflow:hidden;border:1px solid var(--line);flex:0 0 auto;background:#000;}
  .msl-spart img{width:100%;height:100%;object-fit:cover;object-position:center 16%;}
  .msl-spinfo{display:flex;flex-direction:column;gap:3px;min-width:0;}
  .msl-spline{display:flex;align-items:baseline;gap:6px;}
  .msl-spqty{font-family:'IBM Plex Mono',monospace;color:var(--acc);font-weight:700;font-size:14px;flex:0 0 auto;}
  .msl-spname{font-size:14px;font-weight:600;line-height:1.2;}
  .msl-spsub{font-size:11px;color:var(--dim);} .msl-spsub b{color:var(--ink2);font-family:'IBM Plex Mono',monospace;}
  .msl-sbtag{font-family:'IBM Plex Mono',monospace;font-size:8px;letter-spacing:1px;color:var(--acc);border:1px solid var(--acc);border-radius:3px;padding:0 4px;margin-right:6px;}
  .msl-ss-none{color:var(--dim);font-size:13px;}
  .msl-restcols{display:grid;grid-template-columns:1fr 300px;gap:34px;}
  .msl-resthd{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--dim);margin-bottom:12px;display:flex;gap:8px;align-items:center;}
  .msl-resthd b{color:var(--ink2);background:#16171b;border:1px solid var(--line);border-radius:4px;padding:1px 7px;}
  .msl-restcols>div:first-child .msl-cgrp{display:inline-block;width:48%;vertical-align:top;margin-right:2%;}
  .msl-cgrp{margin-bottom:14px;}
  .msl-cglabel{display:block;font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:1px;color:var(--dim);margin-bottom:5px;border-bottom:1px solid #1a1c21;padding-bottom:3px;}
  .msl-cline{display:block;font-size:12.5px;color:var(--ink2);padding:2.5px 0;}
  .msl-cline b{font-family:'IBM Plex Mono',monospace;color:var(--dim);margin-right:5px;}
  .msl-cline.is-spice{color:var(--acc);} .msl-cline.is-spice b{color:var(--acc);}
  `;

  window.MSLists = { ListsView };
})();
