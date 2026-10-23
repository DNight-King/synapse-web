import { useState } from "react";

/**
 * Returns true only when the given value is a safe, clickable http(s) URL.
 * Chain-supplied and user-entered URLs are attacker-influenceable, so we must
 * reject dangerous schemes such as `javascript:` and `data:` before rendering
 * them as an `href`.
 */
export function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed === "") return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Renders a chain-supplied URL as a clickable link only when its scheme is
 * http(s). Unsafe schemes (`javascript:`, `data:`, etc.) are rendered as inert
 * text so they can never be executed or navigated to.
 */
export function SafeUrlLink({ url, className }: { url: unknown; className?: string }) {
  if (!isSafeHttpUrl(url)) {
    return <span className={className}>{typeof url === "string" ? url : ""}</span>;
  }
  return (
    <a href={url} className={className} target="_blank" rel="noopener noreferrer nofollow">
      {url}
    </a>
  );
}

interface AdminTabProps {
  callbackUrl?: string;
  addressLabel?: string;
  loading?: boolean;
  error?: string;
}

export default function AdminTab({ callbackUrl, addressLabel, loading = false, error }: AdminTabProps) {
  const [label, setLabel] = useState(addressLabel ?? "");

  if (loading) return <p role="status">Loading administration settings…</p>;
  if (error) return <p role="alert">Unable to load administration settings: {error}</p>;
  if (!callbackUrl && !addressLabel) {
    return <p className="admin-tab__empty">No administration settings are available yet.</p>;
  }

  return (
    <div className="admin-tab">
      <section className="admin-tab__section">
        <h3>Callback URL</h3>
        <SafeUrlLink url={callbackUrl} className="admin-tab__callback-url" />
      </section>

      <section className="admin-tab__section">
        <h3 id="admin-address-label-heading">Address Label</h3>
        <input
          type="text"
          aria-labelledby="admin-address-label-heading"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="admin-tab__address-label"
        />
        {/* React escapes text by default; render as text, never as HTML. */}
        <p className="admin-tab__address-label-preview">{label}</p>
      </section>
    </div>
  );
}

export default AdminTab;
