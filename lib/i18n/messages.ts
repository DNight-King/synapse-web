import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";

export type Messages = typeof en;

const CATALOGS: Record<Locale, Messages> = { en, es };

export function getMessages(locale: Locale): Messages {
  return CATALOGS[locale] ?? CATALOGS[DEFAULT_LOCALE];
}

type Params = Record<string, string | number>;

function lookup(tree: unknown, path: string): string | undefined {
  let node: unknown = tree;
  for (const part of path.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

/**
 * Resolves `namespace.key` against `messages` and fills `{name}` placeholders.
 * Falls back to the English catalog, then to the key itself, so a missing
 * translation degrades visibly instead of throwing.
 */
export function translate(
  messages: Messages,
  namespace: string,
  key: string,
  params?: Params
): string {
  const path = `${namespace}.${key}`;
  const template = lookup(messages, path) ?? lookup(CATALOGS[DEFAULT_LOCALE], path) ?? path;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}
