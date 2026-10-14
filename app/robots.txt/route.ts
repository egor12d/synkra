export function GET(request: Request) {
  return new Response(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /account\nDisallow: /admin\nDisallow: /auth/\nDisallow: /checkout/\nDisallow: /verify-email\nDisallow: /reset-password\nSitemap: ${new URL(request.url).origin}/sitemap.xml\n`, {headers:{'Content-Type':'text/plain; charset=utf-8'}});
}
