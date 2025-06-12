
export const SBNF_HUES_SCENE = {
  deepPurple: 258,
  lightLavender: 267,
  orangeRed: 13,
  orangeYellow: 36,
  lightPeach: 30,
  black: 0, // Hue for black is arbitrary if L=0
  tronBlue: 197,
};

// Placeholder - actual HSL to RGB conversion needed for WebGL scenes if not using THREE.Color.setHSL
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)]; // Returns values in [0, 1] range
}

// Placeholder - actual noise texture generation needed for WebGL scenes
export function generateNoiseTexture(width: number, height: number): any {
  console.warn("generateNoiseTexture is a placeholder and does not generate a real THREE.DataTexture.");
  // In a real scenario, you'd use THREE.DataTexture here.
  // For now, returning a basic object to avoid breaking scenes expecting an object.
  const size = width * height;
  const data = new Uint8Array(4 * size);
  for (let i = 0; i < size; i++) {
    const stride = i * 4;
    const randomValue = Math.floor(Math.random() * 256);
    data[stride] = randomValue; // R
    data[stride + 1] = randomValue; // G
    data[stride + 2] = randomValue; // B
    data[stride + 3] = 255; // A
  }
  // This is NOT a THREE.DataTexture, but prevents errors if scenes try to access .dispose() or .needsUpdate
  return { data, width, height, needsUpdate: false, dispose: () => {} };
}
