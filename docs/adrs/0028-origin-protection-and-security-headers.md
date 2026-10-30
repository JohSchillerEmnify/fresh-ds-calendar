# 0028 — Origin protection and security headers

- Status: accepted (owner, 2026-10-30); views shaped: `server`

## Decision
- **CSRF by `Origin`**: every non-GET `/api/*` call needs an `Origin` that is `PUBLIC_URL` or in `ALLOWED_ORIGINS`
  (without `PUBLIC_URL`, the request's own host), or no `Origin` at all (the Android widget's native fetch); else `403`.
- **JSON only**: a body must be `application/json` (`415`); at most 256 KB (themes 400 KB), else `413`.
- **Headers on every answer**, from the server itself (home server) and from Caddy (public): CSP with the page's inline
  script allowed by its sha256 (computed from the built `index.html`), only the configured place search and map picture
  hosts besides `'self'`, `frame-ancestors 'none'`, `object-src 'none'`; `X-Frame-Options: DENY`; `Permissions-Policy`;
  `Referrer-Policy: strict-origin-when-cross-origin`. Place and map addresses must be plain https or the default is used,
  so a typo cannot inject into the CSP.
- **Fail closed**: a server without sign-in (`PROVIDER=mock`) refuses to start with an https `PUBLIC_URL` or
  `NODE_ENV=production` unless `ALLOW_INSECURE_MOCK=1`.

## Alternatives weighed
- **CSRF tokens**: more state and client code; the `Origin` header cannot be forged by a page, and SameSite cookies stay as the second layer.
- **`unsafe-inline` for the theme script**: one hash is as easy and keeps XSS out.
- **Headers only in Caddy**: the home server has no Caddy; a test (`security-headers.test.ts`) keeps both copies equal.
- **A stricter `Referrer-Policy`**: the OpenStreetMap tile policy wants the page's origin as Referer.

## Why
Cheap, stateless checks close the common web attacks without touching what a signed-in person sees.
Tests: `server/test/security.test.ts`, `security-headers.test.ts`, `places.test.ts`. Spec: `spec/features/app/security-hardening.feature`.
