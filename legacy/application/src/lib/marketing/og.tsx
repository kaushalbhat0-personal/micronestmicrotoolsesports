import { ImageResponse } from "next/og";

// Warm MicroNest OG helper — server-safe, deterministic, dependency-free
// Uses: cream #FFF9F0, white, charcoal #2B2117, muted #8A7E6F, terracotta #C86B4A, teal #5C8B86
// Typography: Georgia serif for display (Instrument Serif fallback), mono for data

export interface OgParams {
  eyebrow: string; // e.g., "T01 · Sponsorship Tracking" or "Guide · Sponsorship"
  title: string;
  description?: string;
  motif?: string; // mono data e.g., "50 / 30 / 20"
  accent?: "terracotta" | "charcoal" | "teal" | "beige" | "amber";
}

function accentColor(accent?: string): string {
  switch (accent) {
    case "terracotta":
      return "#C86B4A";
    case "teal":
      return "#5C8B86";
    case "amber":
      return "#C4923A";
    case "charcoal":
      return "#2B2117";
    case "beige":
      return "#8A7E6F";
    default:
      return "#C86B4A";
  }
}

export function createOgImage({ eyebrow, title, description, motif, accent }: OgParams) {
  const accentHex = accentColor(accent);
  // Single cropped organic shape — beige e8d7c3 at low opacity, clipped top-right
  // We use a simple ellipse as placeholder for the organic shape to keep OG self-contained
  // without embedding the full master path (which satori handles as path data).
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          backgroundColor: "#FFF9F0",
          padding: "32px",
          position: "relative",
        }}
      >
        <div
          style={{
            width: "1136px",
            height: "566px",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "white",
            border: "1px solid #E8DDD0",
            borderRadius: "20px",
            padding: "48px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Cropped organic shape — top-right, opacity 0.08 */}
          <div
            style={{
              position: "absolute",
              top: "-40px",
              right: "-40px",
              width: "320px",
              height: "280px",
              backgroundColor: "#E8D7C3",
              borderRadius: "60% 40% 55% 45% / 45% 55% 45% 55%",
              opacity: 0.08,
              display: "flex",
            }}
          />

          {/* Eyebrow — T0X · motif */}
          <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px" }}>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 12,
                letterSpacing: "0.14em",
                color: accentHex,
                textTransform: "uppercase",
              }}
            >
              {eyebrow}
            </span>
            {motif ? (
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  color: "#8A7E6F",
                }}
              >
                · {motif}
              </span>
            ) : null}
          </div>

          {/* Title — Instrument Serif via Georgia fallback */}
          <div
            style={{
              display: "flex",
              fontFamily: "Georgia, serif",
              fontSize: 44,
              lineHeight: 1.1,
              color: "#2B2117",
              maxWidth: "780px",
              flexWrap: "wrap",
            }}
          >
            {title}
          </div>

          {description ? (
            <div
              style={{
                display: "flex",
                fontFamily: "sans-serif",
                fontSize: 16,
                lineHeight: 1.5,
                color: "#6B5E4F",
                maxWidth: "720px",
                marginTop: "16px",
              }}
            >
              {description}
            </div>
          ) : null}

          {/* Bottom bar — MicroNest + motif */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "auto",
              paddingTop: "24px",
              borderTop: "1px solid #E8DDD0",
            }}
          >
            <span
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 14,
                color: "#2B2117",
                letterSpacing: "-0.01em",
              }}
            >
              MicroNest
            </span>
            <span
              style={{
                fontFamily: "sans-serif",
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#8A7E6F",
              }}
            >
              The toolbox behind esports
            </span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
