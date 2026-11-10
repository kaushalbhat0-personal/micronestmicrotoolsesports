/**
 * MicroNest demo brand tokens for video pipeline (RCCF-DEMO-02).
 * Editorial, warm/light identity. Paths reference production assets read-only.
 */
export const BRAND = {
  name: "MicroNest",
  tagline: "The toolbox behind esports.",
  logoSvg: "public/Final_MicroNest_Logo.svg",
  logoAnimation: "public/Final_MicroNest_Logo_Animation-1.mp4",
  logoIntroSeconds: 3,
  colors: {
    cream: "#f5f0e8",
    charcoal: "#1c1917",
    terracotta: "#c2410c",
    background: "#0b0f19",
  },
  video: { width: 1920, height: 1080, fps: 30, vcodec: "libx264", acodec: "aac" },
  voice: { engine: "piper", model: "en_US-libritts-high", license: "CC-BY-4.0 (attribution required)" },
};
