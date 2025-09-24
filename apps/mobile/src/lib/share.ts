import * as Sentry from "sentry-expo";
import { Share } from "react-native";

const SCHEME = "antakyaogretmenevi";

export type DeepLinkKind = "explore" | "routes" | "restaurants";

export function buildDeepLink(kind: DeepLinkKind, idOrCode: string): string {
  return `${SCHEME}://${kind}/${idOrCode}`;
}

export async function shareLink(title: string, url: string): Promise<void> {
  try {
    await Share.share({ message: `${title}\n${url}`, url });
    try { Sentry.addBreadcrumb({ category: "share", level: "info", message: "share", data: { url } }); } catch {}
  } catch {
    // no-op
  }
}


