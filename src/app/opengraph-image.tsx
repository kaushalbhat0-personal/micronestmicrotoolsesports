import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const alt = "MicroNest — The toolbox behind esports";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// OG output is rasterized PNG for crawler compatibility.
// Master logo at /public/Final_MicroNest_Logo.svg remains vector and untouched — only the OG *output* is PNG.
export default async function OpengraphImage() {
  const logoSvg = await readFile(path.join(process.cwd(), "public", "Final_MicroNest_Logo.svg"), "utf-8");
  const logoDataUri = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FFF9F0",
          padding: "40px",
        }}
      >
        <div
          style={{
            width: "1120px",
            height: "550px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "white",
            border: "1px solid #E8DDD0",
            borderRadius: "20px",
            gap: "24px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoDataUri}
            alt="MicroNest"
            width={420}
            height={240}
            style={{ objectFit: "contain" }}
          />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: 28, color: "#2B2117", fontFamily: "Georgia, serif" }}>The toolbox behind esports</span>
            <span style={{ fontSize: 14, color: "#8A7E6F", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Focused tools • One job at a time
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
