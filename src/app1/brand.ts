// Surface Ultra のブランドの色（仮置きのブランド規定。AC-009 は目視）。UI の色は Fluent のトークンを使い、
// ここの値は three.js の素材（トークンを使えない所）と、製品の 2D 図に限る。
export const SURFACE_COLORS = {
  bg: '#0b1220',
  body: '#9aa4b2',
  keys: '#1b2230',
  pad: '#c9d1dc',
  screen: '#0a2a5e',
  screenGlow: '#1e5bd8',
  accent: '#4aa3ff',
  accent2: '#9b6bff',
  floor: '#141b2b',
} as const;
