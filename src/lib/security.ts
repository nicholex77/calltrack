export const hashPin = async (pin: string): Promise<string> => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("blurb:" + pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
};

export const isPinHash = (s: string) => s.length === 64 && /^[0-9a-f]+$/.test(s);

let _clipTimer: ReturnType<typeof setTimeout> | null = null;
export const safeCopy = (text: string) => {
  navigator.clipboard.writeText(text).catch(() => {});
  if (_clipTimer) clearTimeout(_clipTimer);
  _clipTimer = setTimeout(() => navigator.clipboard.writeText("").catch(() => {}), 30_000);
};
