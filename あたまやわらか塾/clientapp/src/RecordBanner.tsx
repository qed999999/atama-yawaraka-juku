import React from "react";

type Props = {
  score: number;
  prevBest?: number;
  unit?: string;
  lowerIsBetter?: boolean;
};

export default function RecordBanner({ score, prevBest, unit = "てん", lowerIsBetter = false }: Props) {
  if (prevBest === undefined) {
    return (
      <div style={newWrap}>
        <style>{`
          @keyframes rb-pop { 0%{transform:scale(0.5);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
          @keyframes rb-shine { 0%,100%{opacity:0.7} 50%{opacity:1} }
        `}</style>
        <div style={shineRow} aria-hidden>✨🌟✨🌟✨</div>
        <div style={newLabel}>🎉 はじめてのきろく！</div>
        <div style={newSub}>
          <span style={{ fontWeight: 1000, fontSize: "1.15em", color: "#ff3fa7" }}>{score}{unit}</span>
        </div>
        <div style={shineRow} aria-hidden>✨🌟✨🌟✨</div>
      </div>
    );
  }

  const isNew = lowerIsBetter ? (score < prevBest) : (score > prevBest);
  const isTie = score === prevBest;

  if (isNew) {
    return (
      <div style={newWrap}>
        <style>{`
          @keyframes rb-pop { 0%{transform:scale(0.5);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
          @keyframes rb-shine { 0%,100%{opacity:0.7} 50%{opacity:1} }
        `}</style>
        <div style={shineRow} aria-hidden>✨🌟✨🌟✨</div>
        <div style={newLabel}>🏆 きろく こうしん！</div>
        <div style={newSub}>
          <span style={{ opacity: 0.75 }}>{prevBest}{unit}</span>
          <span style={{ margin: "0 6px", fontSize: 18 }}>→</span>
          <span style={{ fontWeight: 1000, fontSize: "1.15em", color: "#ff3fa7" }}>{score}{unit}</span>
        </div>
        <div style={shineRow} aria-hidden>✨🌟✨🌟✨</div>
      </div>
    );
  }

  return (
    <div style={prevWrap}>
      🏆 いままでの さいこう：<b>{prevBest}{unit}</b>
      {isTie && <span style={{ marginLeft: 8, color: "#ff9900", fontWeight: 1000 }}>タイ！🤝</span>}
    </div>
  );
}

const newWrap: React.CSSProperties = {
  margin: "12px 0",
  padding: "10px 14px",
  borderRadius: 16,
  background: "linear-gradient(135deg, rgba(255,220,50,0.25), rgba(255,100,180,0.18))",
  border: "2px solid rgba(255,180,50,0.5)",
  textAlign: "center",
  animation: "rb-pop 0.5s ease both",
};
const shineRow: React.CSSProperties = {
  fontSize: 18,
  letterSpacing: 2,
  animation: "rb-shine 1.2s ease-in-out infinite",
};
const newLabel: React.CSSProperties = {
  fontSize: "clamp(16px, 4vw, 20px)",
  fontWeight: 1000,
  color: "#e67e00",
  margin: "4px 0",
};
const newSub: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "clamp(14px, 3.5vw, 17px)",
  margin: "2px 0 4px",
};
const prevWrap: React.CSSProperties = {
  margin: "10px 0",
  padding: "8px 12px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.6)",
  border: "2px solid rgba(80,200,255,0.25)",
  fontSize: "clamp(13px, 3.2vw, 15px)",
  textAlign: "center",
  color: "#555",
};
