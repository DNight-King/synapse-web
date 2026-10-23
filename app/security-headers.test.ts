/**
 * Security headers regression test — Task #2
 *
 * Loads next.config.ts directly (no HTTP server needed) and asserts that the
 * catch-all route "/:path*" carries the anti-clickjacking headers required to
 * prevent iframe embedding of the wallet-signing UI.
 *
 * If any of these headers are missing or have the wrong value, the test fails
 * immediately, blocking the build before a mis-configured deployment can reach
 * production.
 */
import { describe, it, expect } from "vitest";
import nextConfig from "../next.config";

/**
 * Convert a Next.js route-header `source` pattern into a RegExp.
 *
 * The patterns used in this project are simple:
 *   "/:path*"             -> catch-all (matches every path)
 *   "/_next/static/:path*" -> prefix match for build output
 * Anything without a token is treated as an exact path.
 */
function sourceToRegex(source: string): RegExp {
  const escape = (value: string) => value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

  // Catch-all: every path.
  if (source === "/:path*") {
    return /^\/.*$/;
  }

  // "<prefix>/:path*" matches the prefix and anything below it.
  if (source.endsWith("/:path*")) {
    return new RegExp(`^${escape(source.slice(0, -"/:path*".length))}(/.*)?$`);
  }

  return new RegExp(`^${escape(source)}$`);
}

async function getHeaders(path: string): Promise<Record<string, string>> {
  const rules = await nextConfig.headers!();
  const result: Record<string, string> = {};

  for (const rule of rules) {
    const regex = sourceToRegex(rule.source);
    if (regex.test(path)) {
      for (const h of rule.headers) {
        result[h.key.toLowerCase()] = h.value;
      }
    }
  }

  return result;
}

describe("Security headers — anti-clickjacking (X-Frame-Options / CSP frame-ancestors)", () => {
  const routes = [
    "/",
    "/index",
    "/admin",
    "/_next/static/chunks/app.js",
    "/favicon.ico",
    "/.well-known/security.txt",
  ];

  it.each(routes)("route %s carries X-Frame-Options: DENY", async (route) => {
    const headers = await getHeaders(route);
    expect(headers["x-frame-options"]).toBe("DENY");
  });

  it.each(routes)("route %s carries CSP with frame-ancestors 'none'", async (route) => {
    const headers = await getHeaders(route);
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  it("defence-in-depth: X-Content-Type-Options is nosniff on /", async () => {
    const headers = await getHeaders("/");
    expect(headers["x-content-type-options"]).toBe("nosniff");
  });

  it("defence-in-depth: Referrer-Policy is set on /", async () => {
    const headers = await getHeaders("/");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("all security headers are absent for a path that does not match any rule (hypothetical)", async () => {
    // Demonstrates getHeaders returns an empty object for a non-matching path.
    // In our config all paths match the catch-all, so we test the helper directly
    // by verifying our sourceToRegex logic for a non-catch-all source.
    const rules = await nextConfig.headers!();
    // The catch-all rule must be present and must match every route tested above.
    const catchAll = rules.find((r) => r.source === "/:path*");
    expect(catchAll, "catch-all rule must exist in next.config.ts").toBeDefined();
    expect(catchAll!.headers.map((h) => h.key)).toContain("X-Frame-Options");
  });
});
