import { Address, nativeToScVal, scValToNative, xdr } from "@stellar/stellar-sdk";
import { ABI_ENDPOINTS } from "../constants";

export function addressArg(value: string) {
  return new Address(value).toScVal();
}

export function stringArg(value: string) {
  return nativeToScVal(value, { type: "string" });
}

/** Encodes a plain object as an ScVal map — used for #[contracttype] struct arguments. */
export function structArg(value: Record<string, unknown>) {
  return nativeToScVal(value);
}

export function u32Arg(value: number) {
  return nativeToScVal(value, { type: "u32" });
}

export function i128Arg(value: bigint | number | string) {
  return nativeToScVal(BigInt(value), { type: "i128" });
}

export function boolArg(value: boolean) {
  return nativeToScVal(value);
}

/**
 * Encodes a raw form-field string into an ScVal using an ABI parameter type
 * name (as declared in ABI_ENDPOINTS). Struct values are entered as JSON.
 */
export function encodeArg(type: string, value: string): xdr.ScVal {
  switch (type.toLowerCase()) {
    case "address":
      return addressArg(value.trim());
    case "string":
      return stringArg(value);
    case "u32":
      return u32Arg(Number(value));
    case "i128":
      return i128Arg(value.trim());
    case "bool":
      return boolArg(value.trim().toLowerCase() === "true");
    case "struct": {
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        throw new Error("Struct arguments must be valid JSON.");
      }
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Struct arguments must be a JSON object.");
      }
      return structArg(parsed as Record<string, unknown>);
    }
    default:
      throw new Error(`Unsupported argument type: ${type}`);
  }
}

/** Decodes an ScVal to its native JS value (address -> G... string, map -> object, ...). */
export function decodeArgValue(arg: xdr.ScVal): unknown {
  return scValToNative(arg);
}

export type DecodedArg = {
  /** ABI parameter name, or a "raw (undecoded)" marker when undocumented. */
  label: string;
  /** ABI parameter type, or "raw" when undocumented. */
  type: string;
  /** Human-readable rendering of the decoded value. */
  value: string;
  /** Base64 XDR of the original ScVal. */
  raw: string;
};

export type DecodedCall = {
  /** True when the entrypoint is documented in ABI_ENDPOINTS. */
  covered: boolean;
  /** Human-readable label for the entrypoint, when known. */
  label?: string;
  args: DecodedArg[];
};

/** Renders a decoded native value as a human-readable string. */
function formatNative(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Address) return value.toString();
  if (Array.isArray(value)) return value.map(formatNative).join(", ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${formatNative(v)}`)
      .join(", ");
  }
  return String(value);
}

/** Best-effort decode of a single ScVal into a display string. */
function decodeScVal(arg: xdr.ScVal): string {
  try {
    return formatNative(scValToNative(arg));
  } catch {
    return arg.toXDR("base64");
  }
}

function rawArg(arg: xdr.ScVal, index: number): DecodedArg {
  return {
    label: `raw (undecoded) #${index}`,
    type: "raw",
    value: decodeScVal(arg),
    raw: arg.toXDR("base64"),
  };
}

/**
 * Pairs ABI_ENDPOINTS parameter metadata with the actual ScVal arguments passed
 * into a contract call, producing labeled key/value pairs for clear-signing.
 * Falls back to a clearly-marked raw view for undocumented entrypoints and for
 * arguments beyond the documented parameters.
 */
export function decodeCallArgs(entrypoint: string, args: xdr.ScVal[] = []): DecodedCall {
  const meta = ABI_ENDPOINTS.find((e) => e.name === entrypoint);

  if (!meta) {
    return { covered: false, args: args.map(rawArg) };
  }

  return {
    covered: true,
    label: meta.name,
    args: args.map((arg, i) => {
      const param = meta.params[i];
      if (!param) return rawArg(arg, i);
      return {
        label: param.name,
        type: param.type,
        value: decodeScVal(arg),
        raw: arg.toXDR("base64"),
      };
    }),
  };
}
