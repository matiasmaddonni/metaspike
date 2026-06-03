/* Shared metaspike primitives — exported to window.MSShared so both the
   aggregate view (inline in metaspike.html) and the LISTS view (lists.jsx)
   use one definition. Loaded as text/babel BEFORE lists.jsx and the main app. */
(function () {
  const PIP = { W: "#efe7cf", U: "#5b87b8", B: "#7a7a82", R: "#cf5640", G: "#4f9a68" };

  function Logo({ size = 22 }) {
    return (
      <span className="ms-logo">
        <svg className="ms-mark" width={size + 8} height={size} viewBox="0 0 30 22" fill="none">
          <path d="M1 15 H8 L12 15 L15.5 3 L19 13 L21.5 9 H29" stroke="var(--acc)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="ms-word">metaspike</span>
      </span>
    );
  }

  function Pips({ colors }) {
    if (!colors || !colors.length) return <span className="ms-pip ms-pipc" />;
    return <span className="ms-pips">{colors.map((c) => <span key={c} className="ms-pip" style={{ background: PIP[c] }} />)}</span>;
  }

  function HoverArt({ row, anchor }) {
    if (!row) return null;
    const top = Math.min(anchor.y, window.innerHeight - 360);
    return <div className="ms-hover" style={{ top, left: Math.min(anchor.x + 20, window.innerWidth - 260) }}><img src={row.card_url} alt="" /></div>;
  }

  const fmtPct = (p) => Math.round(p * 100);

  window.MSShared = { PIP, Logo, Pips, HoverArt, fmtPct };
})();
