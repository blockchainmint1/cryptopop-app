import confetti from "canvas-confetti";

/** Brand-colored celebration for POP rewards. */
export function popFireworks() {
  const base = { spread: 90, ticks: 220, colors: ["#FF3DBE", "#00E5FF", "#8B3DFF", "#CCF695"] };
  confetti({ ...base, particleCount: 120, origin: { x: 0.5, y: 0.6 } });
  setTimeout(() => confetti({ ...base, particleCount: 80, angle: 60, origin: { x: 0, y: 0.7 } }), 200);
  setTimeout(() => confetti({ ...base, particleCount: 80, angle: 120, origin: { x: 1, y: 0.7 } }), 350);
}

/** Shop-name size that fits one line: big for short names, smaller for long ones. */
export function shopNameSize(name: string) {
  const n = name.length;
  return n <= 14 ? "1.75rem" : n <= 22 ? "1.4rem" : n <= 32 ? "1.1rem" : "0.95rem";
}
