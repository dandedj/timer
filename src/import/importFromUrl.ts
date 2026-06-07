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

// CORS proxies tried in order. Hosts like intervaltimer.com don't send CORS headers,
// and any single public proxy is unreliable, so we fall through a chain until one
// returns usable JSON. Swap the first entry for a self-hosted proxy for full reliability.
const PROXIES: Array<{ url: (u: string) => string; decode: (body: string) => string }> = [
  {
    url: (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    decode: (body) => body,
  },
  {
    url: (u) => 'https://api.allorigins.win/get?url=' + encodeURIComponent(u),
    decode: (body) => {
      const wrap = JSON.parse(body) as { contents?: string; status?: { http_code?: number } };
      const code = wrap.status?.http_code;
      if (code && code >= 400) throw new Error(`http ${code}`);
      return decodeContents(wrap.contents || '');
    },
  },
  {
    url: (u) => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
    decode: (body) => body,
  },
  {
    url: (u) => 'https://thingproxy.freeboard.io/fetch/' + u,
    decode: (body) => body,
  },
];

async function fetchWithTimeout(url: string, ms = 12000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch timer file text from a URL. Tries a direct request first (works for
 * CORS-enabled hosts like raw GitHub, gists, or Dropbox `?dl=1`), then falls through
 * a chain of CORS proxies for hosts that don't allow cross-origin reads.
 */
export async function fetchTimerText(rawInput: string): Promise<string> {
  const url = deriveDownloadUrl(rawInput);

  // 1. Direct — succeeds for CORS-enabled hosts, no proxy needed.
  try {
    const direct = await fetchWithTimeout(url);
    if (direct.ok) {
      const text = await direct.text();
      if (looksLikeTimerJson(text)) return text;
    }
  } catch {
    // CORS or network failure — fall through to the proxies.
  }

  // 2. Proxy chain — first one to return usable JSON wins.
  for (const proxy of PROXIES) {
    try {
      const res = await fetchWithTimeout(proxy.url(url));
      if (!res.ok) continue;
      const decoded = proxy.decode(await res.text());
      if (looksLikeTimerJson(decoded)) return decoded;
    } catch {
      // try the next proxy
    }
  }

  throw new Error(
    'could not be fetched — the timer site blocked the request. Try again, or open the link and import the downloaded .seconds file.'
  );
}
