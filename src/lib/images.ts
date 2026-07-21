const ALLOWED_IMAGE_HOSTS = new Set([
  "assets.coingecko.com",
  "coin-images.coingecko.com",
]);

export function safeCoinImage(value: string | null): string {
  if (!value) return "/coin-placeholder.svg";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_IMAGE_HOSTS.has(url.hostname)
      ? url.toString()
      : "/coin-placeholder.svg";
  } catch {
    return "/coin-placeholder.svg";
  }
}
