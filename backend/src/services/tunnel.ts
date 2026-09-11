import * as ngrok from "@ngrok/ngrok";
import { logger } from "./logger.js";

let listener: ngrok.Listener | null = null;

export interface TunnelResult {
  url: string;
  ngrok: boolean;
}

/**
 * NGROK_AUTHTOKEN があれば ngrok トンネルを張り、その HTTPS URL を返す。
 * 無ければ PUBLIC_BASE_URL (env) をそのまま返す。両方無ければ null。
 */
export async function startTunnelIfConfigured(
  port: number,
): Promise<TunnelResult | null> {
  const authtoken = process.env.NGROK_AUTHTOKEN;
  const staticBase = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
  const staticBaseUsable =
    !!staticBase &&
    /^https?:\/\//.test(staticBase) &&
    !staticBase.includes("xxxx.ngrok-free.app") &&
    !staticBase.includes("placeholder.example.com");

  if (!authtoken) {
    if (staticBaseUsable) {
      logger.info(
        { url: staticBase },
        "NGROK_AUTHTOKEN not set — using static PUBLIC_BASE_URL",
      );
      return { url: staticBase!, ngrok: false };
    }
    logger.warn(
      "NGROK_AUTHTOKEN not set and PUBLIC_BASE_URL not usable — webhooks will not be reachable from Twilio",
    );
    return null;
  }

  try {
    listener = await ngrok.forward({
      addr: port,
      authtoken,
      // ngrok-free domain will be auto-assigned. For a reserved domain set NGROK_DOMAIN.
      ...(process.env.NGROK_DOMAIN ? { domain: process.env.NGROK_DOMAIN } : {}),
    });
    const url = listener.url();
    if (!url) throw new Error("ngrok listener returned no url");
    logger.info({ url, port }, "ngrok tunnel established");
    return { url: url.replace(/\/$/, ""), ngrok: true };
  } catch (e) {
    logger.error({ err: (e as Error).message }, "ngrok tunnel failed to start");
    if (staticBaseUsable) {
      logger.warn({ url: staticBase }, "falling back to static PUBLIC_BASE_URL");
      return { url: staticBase!, ngrok: false };
    }
    return null;
  }
}

export async function stopTunnel() {
  if (listener) {
    try {
      await listener.close();
      logger.info("ngrok tunnel closed");
    } catch (e) {
      logger.warn({ err: (e as Error).message }, "ngrok close failed");
    }
    listener = null;
  }
}
