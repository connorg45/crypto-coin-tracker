import type { Env } from "./_lib/types";

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https://assets.coingecko.com https://coin-images.coingecko.com data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const response = await context.next();
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS))
    secured.headers.set(name, value);
  return secured;
};
