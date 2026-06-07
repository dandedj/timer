/**
 * Normalize user input into a directly-downloadable timer URL.
 * An intervaltimer.com *share* link points at an HTML page, but the same path with
 * a `.seconds` suffix serves the raw Seconds file — so derive that.
 */
export function deriveDownloadUrl(input: string): string {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  const m = u.match(/^https?:\/\/(?:www\.)?intervaltimer\.com\/shared\/([^/?#]+)/i);
  if (m) {
    const slug = m[1].replace(/\.seconds$/i, '');
    return `https://www.intervaltimer.com/shared/${slug}.seconds`;
  }
  return u;
}

/** True if the text looks like a single URL rather than pasted JSON. */
export function isLikelyUrl(text: string): boolean {
  const s = text.trim();
  if (!s || /\s/.test(s) || s.startsWith('{') || s.startsWith('[')) return false;
  return /^https?:\/\//i.test(s) || /^[\w.-]+\.[a-z]{2,}\//i.test(s);
}

function decodeContents(contents: string): string {
  const base64 = contents.match(/^data:[^;,]*;base64,(.*)$/s);
  if (base64) {
    const bin = atob(base64[1]);
    try {
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch {
      return bin;
    }
  }
  const plain = contents.match(/^data:[^,]*,(.*)$/s);
  if (plain) {
    try { return decodeURIComponent(plain[1]); } catch { return plain[1]; }
  }
  return contents;
}

function looksLikeTimerJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

function decodeAllOriginsGet(body: string): string {
  const wrap = JSON.parse(body) as { contents?: string; status?: { http_code?: number } };
  const code = wrap.status?.http_code;
  if (code && code >= 400) throw new Error(`http ${code}`);
  return decodeContents(wrap.contents || '');
}

// Ways to read a no-CORS URL from the browser. Hosts like intervaltimer.com send no
// CORS header, and any single public proxy is individually unreliable — so we RACE
// them all in parallel and take the first that returns usable JSON. (For full
// reliability, point the first entry at a self-hosted Cloudflare Worker.)
const SOURCES: Array<{ url: (u: string) => string; decode: (body: string) => string }> = [
  { url: (u) => u, decode: (b) => b }, // direct — works for CORS-enabled hosts (raw GitHub, Dropbox ?dl=1)
  { url: (u) => 'https://api.cors.lol/?url=' + encodeURIComponent(u), decode: (b) => b },
  { url: (u) => 'https://api.allorigins.win/get?url=' + encodeURIComponent(u), decode: decodeAllOriginsGet },
  { url: (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u), decode: (b) => b },
  { url: (u) => 'https://corsproxy.io/?url=' + encodeURIComponent(u), decode: (b) => b },
  { url: (u) => 'https://thingproxy.freeboard.io/fetch/' + u, decode: (b) => b },
];

async function attempt(fetchUrl: string, decode: (b: string) => string, signal: AbortSignal): Promise<string> {
  const res = await fetch(fetchUrl, { signal });
  if (!res.ok) throw new Error(`status ${res.status}`);
  const text = decode(await res.text());
  if (!looksLikeTimerJson(text)) throw new Error('not timer json');
  return text;
}

/**
 * Fetch timer file text from a URL. Races a direct request and several CORS proxies
 * in parallel; the first that returns valid timer JSON wins (latency = fastest source,
 * and it only fails if ALL of them are down at once).
 */
export async function fetchTimerText(rawInput: string): Promise<string> {
  const url = deriveDownloadUrl(rawInput);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    return await Promise.any(SOURCES.map((s) => attempt(s.url(url), s.decode, controller.signal)));
  } catch {
    throw new Error(
      'could not be fetched — the timer site blocked the request. Try again, or open the link and import the downloaded .seconds file.'
    );
  } finally {
    clearTimeout(timeout);
    controller.abort(); // cancel any stragglers
  }
}
