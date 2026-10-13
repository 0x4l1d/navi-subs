// navi-subs, built file, edit src/ instead
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/cache.ts
function cache(ms, max2 = 64) {
  const map = /* @__PURE__ */ new Map();
  return {
    get(key) {
      const hit = map.get(key);
      if (!hit) return void 0;
      if (hit.until < Date.now()) {
        map.delete(key);
        return void 0;
      }
      return hit.value;
    },
    set(key, value, life = ms) {
      map.delete(key);
      map.set(key, { value, until: Date.now() + life });
      if (map.size > max2) map.delete(map.keys().next().value);
      return value;
    }
  };
}

// src/clock.ts
var SlowError = class extends Error {
  constructor(who = "mirai") {
    super(`${who} took too long to answer`);
    this.name = "SlowError";
  }
};
var noClock = { left: () => Infinity, run: (work) => work };
function startClock(ms, who = "mirai") {
  const end = Date.now() + ms;
  return {
    left: () => end - Date.now(),
    run(work) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new SlowError(who)), Math.max(0, end - Date.now()));
        work.then(resolve, reject).finally(() => clearTimeout(timer));
      });
    }
  };
}

// src/http.ts
var ORIGIN = "https://miraianime.net";
var HttpError = class extends Error {
  // only the path goes in the message, a query string can carry a key
  constructor(status, url, who = "mirai") {
    super(`${who} answered ${status} for ${new URL(url).pathname}`);
    __publicField(this, "status");
    this.name = "HttpError";
    this.status = status;
  }
};
var BlockedError = class extends Error {
  constructor(who = "mirai") {
    super(`${who} wants a cloudflare check, open the site once in a browser`);
    this.name = "BlockedError";
  }
};
var DownError = class extends Error {
  constructor(who = "mirai") {
    super(`${who} can't be reached`);
    this.name = "DownError";
  }
};
async function request(fetchFn, url, clock, headers, who = "mirai") {
  let res;
  try {
    res = await clock.run(fetchFn(url, headers ? { headers } : void 0));
  } catch (error) {
    if (error instanceof TypeError) throw new DownError(who);
    throw error;
  }
  if (res.ok) return res;
  const body = res.status === 403 || res.status === 503 ? await clock.run(res.text()).catch(() => "") : "";
  if (/just a moment|challenge-platform|cf-chl/i.test(body)) throw new BlockedError(who);
  throw new HttpError(res.status, url, who);
}
async function getText(fetchFn, url, clock, headers, who = "mirai") {
  const res = await request(fetchFn, url, clock, headers, who);
  return await clock.run(res.text());
}

// src/brackets.ts
var OPEN = "[(\u3010";
var CLOSE = "])\u3011";
function splitBrackets(text2) {
  const groups = [];
  let outside = "";
  let depth = 0;
  let start = 0;
  for (let i2 = 0; i2 < text2.length; i2++) {
    const char = text2[i2];
    if (OPEN.includes(char)) {
      if (!depth) start = i2;
      depth++;
    } else if (CLOSE.includes(char) && depth) {
      depth--;
      if (!depth) {
        groups.push(text2.slice(start + 1, i2).trim());
        outside += " ";
      }
    } else if (!depth) {
      outside += char;
    }
  }
  if (depth) outside += text2.slice(start);
  return { outside, groups };
}
var flat = (group) => splitBrackets(group).outside.replace(/\s+/g, " ").trim();

// src/release.ts
var MEDIA = [
  ["BD", /(?:^|[^a-z])(?:bd(?:rip|remux|mv)?|blu-?ray|bdmv)(?![a-z])/i],
  ["DVD", /(?:^|[^a-z])(?:dvd(?:rip|iso|5|9)?|r2j?)(?![a-z])/i],
  ["WEB", /(?:^|[^a-z])(?:web(?:[ ._-]?(?:dl|rip))?|cr|nf|amzn|dsnp|hidive|b-global|bilibili|crunchyroll|netflix|amazon)(?![a-z])/i],
  ["TV", /(?:^|[^a-z])(?:tv(?:rip)?|hdtv|at-x|tokyo ?mx|bs11)(?![a-z])/i]
];
function mediumOf(text2) {
  for (const [medium, pattern] of MEDIA) if (pattern.test(text2)) return medium;
}
var NAMES = {
  cr: "Crunchyroll",
  nf: "Netflix",
  amzn: "Amazon",
  amz: "Amazon",
  dsnp: "Disney+",
  dsny: "Disney+",
  hidive: "HIDIVE",
  hdv: "HIDIVE",
  bili: "Bilibili",
  "b-global": "Bilibili",
  bglobal: "Bilibili",
  adn: "ADN",
  funi: "Funimation",
  hulu: "Hulu",
  abema: "ABEMA",
  unext: "U-NEXT",
  atvp: "Apple TV+",
  iq: "iQIYI",
  iqiyi: "iQIYI",
  baha: "Bahamut",
  wkn: "Wakanim",
  vrv: "VRV",
  muse: "Muse"
};
var SERVICES = new Set(Object.values(NAMES).map((name) => name.toLowerCase()));
var isService = (who) => who.split(/\s*[&+,،]\s*/).some((part) => SERVICES.has(part.trim().toLowerCase()));
function fullName(name) {
  return name.split(/(\s*[&+,،]\s*)/).map((part) => NAMES[part.trim().toLowerCase()] ?? part).join("");
}
var VIDEO_GROUP = /raws?$|^(?:subsplease|erai-raws|horriblesubs|judas|ember|asw|vcb-studio|reinforce|moozzi2|beatrice-raws|commie|kametsu|sallysubs|anime ?time|yameii|toonshub|varyg|sugoi|neohevc|cleo|dkb|trix|bluray|lostyears|smc|ctr|arid|chihiro|gjm|doki|coalgirls|thora|philosophy-raws|hi10|sxales|tenrai-sensei|nan0|okay-subs|mtbb|kawaiika-raws|hatsuyuki|df68|iahq|lazyremux|pmr|zza|tsundere-raws|new-raws|anime land)$/i;
var isVideoGroup = (name) => VIDEO_GROUP.test(name.trim());
var RESOLUTION = /(?:^|[^\d])(?:\d{3,4}x)?(2160|1440|1080|810|720|576|540|480|360)[pi]?(?![\d])/i;
function resolutionOf(text2) {
  const m = RESOLUTION.exec(text2);
  return m ? Number(m[1]) : void 0;
}
function parseRelease(fileName) {
  const base = fileName.slice(fileName.replaceAll("\\", "/").lastIndexOf("/") + 1).replace(/\.(?:mkv|mp4|avi|webm|m4v|ts|ass|srt|ssa|vtt|sub|zip)$/i, "");
  const { outside, groups } = splitBrackets(base);
  const first = base.trimStart().startsWith("[") ? groups[0] : void 0;
  const tail = /-([A-Za-z][\w.]{1,24})$/.exec(outside.trim())?.[1];
  const group = (first && !resolutionOf(first) && !mediumOf(flat(first)) ? first : void 0) ?? (tail && !/^\d+$/.test(tail) ? tail : void 0);
  return { medium: mediumOf(base.replace(/[._]/g, " ")), group, resolution: resolutionOf(base) };
}
var same = (a, b) => !!a && !!b && a.toLowerCase().replace(/[^a-z0-9]/g, "") === b.toLowerCase().replace(/[^a-z0-9]/g, "");
function fit(sub, video) {
  let score2 = 0;
  if (same(sub.group, video.group)) score2 += 25;
  if (sub.medium && video.medium) score2 += sub.medium === video.medium ? 30 : -15;
  if (sub.resolution && sub.resolution === video.resolution) score2 += 3;
  return score2;
}

// src/label.ts
var tidy = (text2) => text2.replace(/[\\/:*?"<>|\p{Cc}]/gu, " ").replace(/\s+/g, " ").trim();
function label(named2, format, language = "Arabic", extra = "") {
  const release = [named2.medium, named2.video].filter(Boolean).join(" \xB7 ");
  return `${tidy(`${language} - ${named2.who.slice(0, 60)}${release ? ` (${release})` : ""}${extra ? ` ${extra}` : ""}`)}.${format}`;
}
function nameOf(file, page, fallback) {
  const credited = page.translators.map(fullName).join(" & ");
  const lone = !file.video && file.group && isVideoGroup(file.group) ? file.group : void 0;
  const group = lone ? void 0 : file.group && fullName(file.group);
  const who = (file.mixed ? group ?? credited : credited || group) || fallback;
  const medium = file.medium ?? page.release.split("/").map((part) => part.trim()).filter(Boolean).join(", ");
  return { who, medium: medium || void 0, video: file.video ?? lone };
}
function unique(names2) {
  const seen = /* @__PURE__ */ new Map();
  return names2.map((name) => {
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    const dot = name.lastIndexOf(".");
    return n === 1 ? name : `${name.slice(0, dot)} ${n}${name.slice(dot)}`;
  });
}

// src/rank.ts
var SOURCE = { mirai: 6, subdl: 3, subsource: 2 };
var FORMAT = { ass: 5, ssa: 4, srt: 3, vtt: 2, sub: 0 };
var MEDIUM = { WEB: 3, BD: 2, TV: 1, DVD: 0 };
function score(candidate, video, prefer, season = "same") {
  let points = (SOURCE[candidate.source] ?? 0) + (FORMAT[candidate.format] ?? 0);
  if (video) points += fit(candidate.release, video);
  if (prefer && candidate.release.medium) points += candidate.release.medium === prefer ? 20 : -5;
  if (!video?.medium && !prefer) points += MEDIUM[candidate.release.medium ?? ""] ?? 0;
  if (candidate.exact) points += 1;
  if (isService(candidate.named.who)) points += 2;
  points += Math.min(3, candidate.version - 1);
  if (season === "unsure") points -= 50;
  return points;
}
function fingerprint(text2) {
  const lines = text2.split(/\r?\n/).filter((line) => /^Dialogue:/.test(line) || !/-->/.test(line) && !/^\d+$/.test(line.trim()) && !/^[[\]\w ]*:/.test(line)).map((line) => line.replace(/^Dialogue:(?:[^,]*,){9}/, "").replace(/\{[^}]*\}/g, "").replace(/\s+/g, "")).filter(Boolean);
  let hash = 2166136261;
  for (const line of lines) {
    for (let i2 = 0; i2 < line.length; i2++) {
      hash ^= line.charCodeAt(i2);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
  }
  return `${lines.length}:${hash.toString(16)}`;
}

// src/season.ts
var ORDINALS = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7 };
var ROMAN = { ii: 2, iii: 3, iv: 4, v: 5, vi: 6 };
var squash = (text2) => text2.normalize("NFKC").toLowerCase().replace(/×/g, "x").replace(/[^\p{L}\p{N}]+/gu, "");
var SEASON_RANGE = /\b(?:Seasons\s*0?(\d{1,2})\s*(?:-|~|to|&|\+)\s*0?(\d{1,2})|Season\s*0?(\d{1,2})\s*(?:to|&|\+|-(?=[1-9]\b)|(?:-|~|to|&|\+)\s*(?=Season))\s*(?:Season\s*)?0?(\d{1,2})|S0?(\d{1,2})\s*(?:-|~|&|\+)\s*S0?(\d{1,2}))\b/i;
var SEASON_WORDS = [
  /\bS(?:eason)?\s*0?(\d{1,2})(?=\s*E\d|\b)/i,
  /\bSeason\s+0?(\d{1,2})\b/i,
  /\b(\d{1,2})(?:st|nd|rd|th)\s+Season\b/i,
  /\b(first|second|third|fourth|fifth|sixth|seventh)\s+Season\b/i,
  /第\s*(\d{1,2})\s*期/
];
var PART_WORDS = [
  /\b(?:Part|Cour)\s*0?(\d{1,2})\b/i,
  /\b(?:Part|Cour)\s+(ii|iii|iv)\b/i,
  /\b(\d)(?:st|nd|rd|th)\s+(?:Part|Cour)\b/i,
  /第\s*(\d)\s*クール/
];
var number = (text2) => ORDINALS[text2.toLowerCase()] ?? ROMAN[text2.toLowerCase()] ?? Number(text2);
function seasonIn(text2) {
  for (const pattern of SEASON_WORDS) {
    const m = pattern.exec(text2);
    if (m) return number(m[1]);
  }
  const roman = /\S\s+(ii|iii|iv|vi|v)(?=\s*(?::|-|$|\())/i.exec(text2);
  if (roman && !/\b(?:part|cour)\s+(?:ii|iii|iv|vi|v)\b/i.test(text2)) return ROMAN[roman[1].toLowerCase()];
}
function partIn(text2) {
  for (const pattern of PART_WORDS) {
    const m = pattern.exec(text2);
    if (m) return number(m[1]);
  }
}
function baseOf(title) {
  let text2 = title;
  for (const pattern of [SEASON_RANGE, ...SEASON_WORDS, ...PART_WORDS]) text2 = text2.replace(pattern, " ");
  return text2.replace(/\b(?:the\s+)?final\s+season\b/i, " ").replace(/(\S)\s+(?:ii|iii|iv|vi|v)(?=\s*(?::|-|$|\())/i, "$1").replace(/\s+/g, " ").replace(/[\s:–-]+$/, "").trim();
}
var EPISODE = [
  // s02e05, s02e05-e06
  /\bS\d{1,2}\s*E(\d{1,4})(?:\s*-\s*E?(\d{1,4}))?\b/i,
  // " - 05", " - 01 ~ 12", " - 01-12"
  /\s-\s(\d{1,4})(?:v\d)?(?:\s*(?:~|-)\s*(\d{1,4}))?(?=\s|$|\[|\()/,
  // "E05", "EP05", "Episode 5"
  /\bE(?:p|pisode)?\s*(\d{1,4})\b/i,
  // "01 ~ 12" with no dash in front
  /\b(\d{1,4})\s*~\s*(\d{1,4})\b/
];
var VIDEO_EXT = /\.(?:mkv|mp4|avi|webm|m4v|ts|ass|srt|ssa|vtt|sub|zip|torrent)$/i;
function parseName(raw) {
  const name = raw.replace(VIDEO_EXT, "").replaceAll("_", " ");
  const { outside, groups } = splitBrackets(name);
  const text2 = (/\s/.test(outside.trim()) ? outside : outside.replace(/\.(?!\d\b)/g, " ")).split(/\s[|｜]\s/)[0].replace(/\s+/g, " ").trim();
  let episodes;
  let cut = text2.length;
  for (const pattern of EPISODE) {
    const m = pattern.exec(text2);
    if (!m) continue;
    const from2 = Number(m[1]);
    const to2 = m[2] === void 0 ? from2 : Number(m[2]);
    if (to2 >= from2) episodes = [from2, to2];
    cut = Math.min(cut, m.index);
    break;
  }
  if (!episodes) {
    const year = (n) => /^(?:19|20)\d\d$/.test(n);
    for (const group of groups) {
      const m = /^(?:E|EP|EP:|Episodes?)?\s*(\d{1,4})(?:v\d)?(?:\s*(?:-|~)\s*(\d{1,4}))?$/i.exec(group.trim()) ?? /\bEP:?\s*(\d{1,4})\s*(?:-|~)\s*(\d{1,4})\b/i.exec(group);
      if (!m || year(m[1]) || m[2] && year(m[2])) continue;
      const from2 = Number(m[1]);
      const to2 = m[2] === void 0 ? from2 : Number(m[2]);
      if (to2 >= from2) episodes = [from2, to2];
      break;
    }
  }
  const range = SEASON_RANGE.exec(text2) ?? groups.map((g) => SEASON_RANGE.exec(g)).find(Boolean);
  const [from, to] = [Number(range?.[1] ?? range?.[3] ?? range?.[5]), Number(range?.[2] ?? range?.[4] ?? range?.[6])];
  const seasons = range && to > from ? [from, to] : void 0;
  const tech = /\s(?:\d{3,4}p|\d{3,4}x\d{3,4}|blu-?ray|bd(?:rip|remux)?|web(?:-?dl|rip)?|hdtv|dvd(?:rip)?|remux|x26[45]|h\s?26[45]|hevc|av1|10-?bit|dual[\s-]?audio|multi(?:-?subs?)?|uncensored)(?=\s|$)/i.exec(text2);
  if (tech && tech.index > 2) cut = Math.min(cut, tech.index);
  const title = text2.slice(0, cut).replace(/[\s:–-]+$/, "").trim() || text2;
  const season = seasons ? void 0 : seasonIn(text2) ?? groups.map(seasonIn).find((n) => n !== void 0);
  const part = partIn(text2) ?? groups.map(partIn).find((n) => n !== void 0);
  const words = `${text2} ${groups.join(" ")}`;
  return {
    title,
    base: baseOf(title),
    season,
    seasons,
    part,
    final: /\bfinal\s+season\b/i.test(text2),
    episodes,
    batch: !!seasons || !!episodes && episodes[1] > episodes[0] || /\b(?:batch|complete|bd\s?box|全集)\b/i.test(words) || !episodes && /\bS(?:eason)?\s*\d{1,2}\b/i.test(words)
  };
}
var LONG = /* @__PURE__ */ new Set(["TV", "TV_SHORT", "ONA"]);
var clean = (titles) => titles.filter((t) => !!t && t.trim().length > 0);
function know(entry) {
  const parsed = clean(entry.titles).map((title) => ({ title, season: seasonIn(title), part: partIn(title), base: baseOf(title), final: /\bfinal\s+season\b/i.test(title) }));
  return {
    keys: new Set(parsed.map((p) => squash(p.title)).filter((k) => k.length >= 2)),
    bases: new Set(parsed.map((p) => squash(p.base)).filter((k) => k.length >= 2)),
    season: parsed.map((p) => p.season).find((n) => n !== void 0),
    part: parsed.map((p) => p.part).find((n) => n !== void 0),
    final: parsed.some((p) => p.final)
  };
}
var same2 = { verdict: "same", why: "" };
var other = (why) => ({ verdict: "other", why });
var unsure = (why) => ({ verdict: "unsure", why });
function judge(name, wanted) {
  const got = typeof name === "string" ? parseName(name) : name;
  const mine = know(wanted.entry);
  const relatives = wanted.related.filter((r) => r.relation === "PREQUEL" || r.relation === "SEQUEL" || r.relation === "PARENT" || r.relation === "SIDE_STORY" || r.relation === "ALTERNATIVE").map((r) => ({ ...r, known: know(r) }));
  const series = relatives.filter((r) => r.relation === "PREQUEL" || r.relation === "SEQUEL");
  const key = squash(got.title);
  const base = squash(got.base);
  if (!key) return same2;
  if (got.seasons) return same2;
  const { episode, absolute } = wanted;
  const single = got.episodes && got.episodes[0] === got.episodes[1] ? got.episodes[0] : void 0;
  const counted = typeof absolute === "number" && absolute > 0 && absolute !== episode ? absolute : void 0;
  const sameShow = mine.bases.has(base) || series.some((r) => r.known.bases.has(base));
  if (sameShow && got.episodes && got.episodes[1] > got.episodes[0] && LONG.has(wanted.entry.format ?? "TV")) {
    const [from, to] = got.episodes;
    const holds = (n) => n !== void 0 && n >= from && n <= to;
    const after = series.some((r) => r.relation === "PREQUEL" && LONG.has(r.format ?? "TV"));
    if (!holds(episode) && !holds(counted)) return after && counted === void 0 ? unsure(`episodes ${from}-${to}`) : other(`episodes ${from}-${to}`);
  }
  const twin = relatives.find((r) => r.known.keys.has(key));
  if (twin && !mine.keys.has(key)) {
    if (twin.relation === "PREQUEL" && counted !== void 0 && got.episodes && counted >= got.episodes[0] && counted <= got.episodes[1]) return same2;
    if (twin.relation === "PREQUEL" && single !== void 0 && twin.episodes && single > twin.episodes) return same2;
    if (twin.relation === "PREQUEL" && got.batch && !got.episodes) {
      const sibling = [...twin.known.bases].some((b) => mine.bases.has(b));
      if (got.season !== void 0 && mine.season !== void 0 && got.season !== mine.season) return other(`season ${got.season}`);
      if (sibling && (mine.part ?? 1) > 1 && twin.known.season === mine.season) return same2;
      return unsure(`name of ${clean(twin.titles)[0]}`);
    }
    return other(`matches ${clean(twin.titles)[0]}`);
  }
  if (mine.keys.has(key) && !twin && got.season === void 0 && got.part === void 0 && (single === void 0 || single === episode || single === counted || counted === void 0 && series.some((r) => r.relation === "PREQUEL"))) return same2;
  const mineBase = mine.bases.has(base);
  const kin = series.some((r) => r.known.bases.has(base));
  if (!mineBase && !kin) {
    const longer = !got.batch && [...mine.bases].some((b) => b.length >= 5 && base.startsWith(b) && base.length - b.length >= 4);
    return longer && LONG.has(wanted.entry.format ?? "TV") ? unsure("longer name") : same2;
  }
  const hasPrequel = series.some((r) => r.relation === "PREQUEL" && LONG.has(r.format ?? "TV"));
  const mySeason = mine.season ?? (hasPrequel ? void 0 : 1);
  const parted = series.some((r) => r.known.part !== void 0 && [...r.known.bases].some((b) => mine.bases.has(b)));
  const myPart = mine.part ?? (parted ? 1 : void 0);
  if (got.season !== void 0) {
    if (mySeason !== void 0 && got.season !== mySeason) return other(`season ${got.season}`);
    if (mySeason === void 0) {
      const owner = series.find((r) => r.known.season === got.season);
      if (owner) return other(`season ${got.season}`);
    }
  } else if (mySeason !== void 0 && mySeason > 1 && !got.final) {
    if (counted !== void 0 && got.episodes && counted >= got.episodes[0] && counted <= got.episodes[1]) return same2;
    if (single !== void 0 && single === episode && counted !== void 0) return other("first season numbering");
    if (!mine.keys.has(key)) return unsure("no season in the name");
  }
  if (got.final !== mine.final && (got.final || mine.final) && got.season === void 0) {
    if (series.some((r) => r.known.final === got.final)) return other(got.final ? "final season" : "earlier season");
    return unsure("final season");
  }
  if (got.part !== void 0) {
    if (myPart !== void 0 && got.part !== myPart) return other(`part ${got.part}`);
    if (myPart === void 0) {
      const owner = series.find((r) => r.known.part === got.part && [...r.known.bases].some((b) => mine.bases.has(b)));
      if (owner) return other(`part ${got.part}`);
      if (got.part > 1) return unsure(`part ${got.part}`);
    }
  } else if (myPart !== void 0 && myPart > 1) {
    if (counted !== void 0 && got.episodes && counted >= got.episodes[0] && counted <= got.episodes[1]) return same2;
    if (got.batch) return same2;
    if (single !== void 0 && single === episode) return unsure("no part in the name");
  }
  const count = wanted.entry.episodes;
  if (single !== void 0 && count && single > count && single !== counted && LONG.has(wanted.entry.format ?? "TV") && !got.batch) return unsure(`episode ${single} of ${count}`);
  const first = !series.some((r) => r.relation === "PREQUEL" && LONG.has(r.format ?? "TV"));
  if (mineBase && single !== void 0 && single !== episode && single !== counted && (first || counted !== void 0) && LONG.has(wanted.entry.format ?? "TV") && !got.batch) return unsure(`episode ${single}`);
  return same2;
}

// src/subtitle.ts
var FORMATS = ["ass", "ssa", "srt", "vtt", "sub"];
var MIME = {
  ass: "text/x-ssa",
  ssa: "text/x-ssa",
  srt: "application/x-subrip",
  vtt: "text/vtt",
  sub: "text/plain"
};
function formatOf(fileName) {
  const ext = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
  return FORMATS.find((f) => f === ext);
}
function decodeText(bytes) {
  if (bytes[0] === 255 && bytes[1] === 254) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 254 && bytes[1] === 255) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1256").decode(bytes);
  }
}
var TIMES = /(?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{1,3}\s*-->\s*(?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{1,3}/;
function detectFormat(text2) {
  if (/^\s*\[Script Info\]/im.test(text2) || /^Dialogue:/m.test(text2)) return "ass";
  if (/^\s*WEBVTT/.test(text2) && TIMES.test(text2)) return "vtt";
  if (TIMES.test(text2)) return "srt";
  if (/^[{[]\d+[}\]][{[]\d+[}\]]/m.test(text2)) return "sub";
}
function toDataUrl(text2, format) {
  const bytes = new TextEncoder().encode(text2);
  let binary = "";
  for (let i2 = 0; i2 < bytes.length; i2 += 32768) binary += String.fromCharCode(...bytes.subarray(i2, i2 + 32768));
  return `data:${MIME[format]};charset=utf-8;base64,${btoa(binary)}`;
}
function toBlobUrl(text2, format) {
  const url = URL.createObjectURL(new Blob([text2], { type: `${MIME[format]};charset=utf-8` }));
  const timer = setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1e3);
  timer.unref?.();
  return url;
}
function toLink(text2, format) {
  const Scope = globalThis.WorkerGlobalScope;
  const inWorker = typeof Scope !== "undefined" && globalThis instanceof Scope;
  return inWorker ? toBlobUrl(text2, format) : toDataUrl(text2, format);
}

// src/names.ts
var MAX_SPAN = 4;
var YEAR = /^(?:19|20)\d\d$/;
var TAG = /^(?:v\d+|\d{3,4}[pi]|\d{3,4}x\d{3,4}|[\da-f]{8}|bd(?:rip)?|blu-?ray|web(?:[ -]?(?:dl|rip))?|tv(?:rip)?|dvd(?:rip)?|hdtv|raw|aac|ac3|flac|x26[45]|h\.?26[45]|hevc|avc|\d+-?bits?|dual[ -]?audio|multi|batch|complete|(?:ar|ara|arabic)(?:[ -]?subs?)?|subs?|ass|srt|vtt|ssa|(?:19|20)\d\d)$/i;
var SEASON_TAG = /^(?:S|P|Part\s*|Season\s*|Cour\s*)\d{1,2}\s*[-–]?\s*(?:E|EP)?\s*(\d{1,3})(?:\s+(?:END|FINAL|FIN))?$/i;
var EPISODE_TAG = /^(?:E(?:P)?\s*)?(\d{1,4})(?:v\d+)?$/i;
var PART_TAG = /^Part\s*(\d{1,2})$/i;
var CREDITS = /^(?:www\.)?mirai/i;
var asciiDigits = (text2) => text2.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
function span(a, b) {
  const from = Number(a);
  const to = b === void 0 ? from : Number(b);
  return to >= from && to - from < MAX_SPAN ? [from, to] : void 0;
}
var OUTSIDE = [
  // s02e05, s02e05-e06
  /\bS\d{1,2}\s*E(\d{1,4})(?:v\d+)?(?:\s*[-~&+]\s*E?(\d{1,4}))?(?![\d.])/i,
  // e05, ep05, episode 05, ep05-06
  /\bE(?:P|pisode)?\s*(\d{1,4})(?:v\d+)?(?:\s*[-~&+]\s*E?(?:P|pisode)?\s*(\d{1,4}))?(?![\d.]|\s*p\b)/i,
  /(?:الحلقة|حلقة)\s*(\d{1,4})(?:\s*[-~&+]\s*(\d{1,4}))?/,
  /第\s*(\d{1,4})\s*話/
];
var DASH = /(?:^|\s)-\s*(\d{1,4})(?:v\d+)?(?:\s*[-~&+]\s*(\d{1,4})(?:v\d+)?)?(?=\s|$)/g;
var HYPHEN = /(?:^|\D)-(\d{1,4})(?:v\d+)?(?=-|\s|$)/g;
var TRAILING = /(?:^|\s)(\d{1,4})(?:v\d+)?(?:\s*(?:[-~&+,]|and)\s*(\d{1,4})(?:v\d+)?)?\s*$/i;
var SPECIAL = /\b(?:SP|OVA|OAD|ONA|Special)s?\s*0*(\d{1,3})\b/i;
function episodesOf(outside, groups) {
  const text2 = outside.replaceAll("_", " ").replace(/\./g, (dot, at, whole) => /\d/.test(whole[at - 1] ?? "") && /^\d(?!\d)/.test(whole.slice(at + 1)) ? dot : " ");
  for (const pattern of OUTSIDE) {
    const m = pattern.exec(text2);
    if (m) return { range: span(m[1], m[2]), strong: true };
  }
  const dashed = [...text2.matchAll(DASH)].at(-1);
  if (dashed) return { range: span(dashed[1], dashed[2]), strong: true };
  const hyphen = [...text2.matchAll(HYPHEN)].filter((m) => !YEAR.test(m[1])).at(-1);
  if (hyphen) return { range: span(hyphen[1]), strong: true };
  const special = SPECIAL.exec(text2);
  if (special) return { range: span(special[1]), strong: true };
  const end = TRAILING.exec(text2);
  if (end && !YEAR.test(end[1])) return { range: span(end[1], end[2]), strong: true };
  const start = /^\s*(\d{1,4})(?:v\d+)?(?=[\s-]|$)/.exec(text2);
  if (start && !YEAR.test(start[1])) return { range: span(start[1]), strong: false };
  for (const group of groups) {
    const m = EPISODE_TAG.exec(group) ?? PART_TAG.exec(group);
    if (m && !YEAR.test(m[1])) return { range: span(m[1]), strong: true };
  }
  return { strong: false };
}
function seasonOf(groups) {
  for (const group of groups) {
    const m = SEASON_TAG.exec(group);
    if (m) return span(m[1]);
  }
}
function versionOf(text2, groups) {
  const m = /\bv(\d)\b/i.exec(text2) ?? /(?:^|\s|\d)v(\d)(?=\s|$)/i.exec(text2);
  const tagged = groups.map((g) => /^v(\d)$/i.exec(g)).find(Boolean);
  return Number(tagged?.[1] ?? m?.[1] ?? 1);
}
var clean2 = (text2) => text2.replace(/\s+/g, " ").trim();
var marker = (g) => EPISODE_TAG.test(g) || SEASON_TAG.test(g) || PART_TAG.test(g);
var allTags = (group) => {
  const words = flat(group).split(/[\s,]+/).filter(Boolean);
  return words.length > 0 && words.every((word) => TAG.test(word));
};
var named = (groups) => groups.map(clean2).filter((group) => group && group.length <= 60 && !TAG.test(group) && !marker(group) && !allTags(group));
function groupOf(groups) {
  const names2 = named(groups);
  return names2.length > 1 ? names2.find((name) => !isVideoGroup(name)) ?? names2[0] : names2[0];
}
function videoOf(groups, group) {
  return named(groups).find((name) => name !== group && isVideoGroup(name));
}
var hidden = (path) => path.split("/").some((part) => part === "__MACOSX" || part.startsWith("."));
function describe(path) {
  if (path.length > 400 || hidden(path)) return void 0;
  const base = path.slice(path.lastIndexOf("/") + 1);
  const ext = base.slice(base.lastIndexOf(".") + 1).toLowerCase();
  const format = ext === "txt" || ext === "zip" ? ext : formatOf(base);
  if (!format) return void 0;
  const groups = [];
  const stem = asciiDigits(base.slice(0, base.lastIndexOf(".")));
  const split = splitBrackets(stem);
  const outside = split.outside;
  groups.push(...split.groups);
  const { range: episodes, strong } = episodesOf(outside, groups);
  if ((format === "txt" || format === "zip") && (!episodes || CREDITS.test(base))) return void 0;
  const group = groupOf(groups);
  const video = videoOf(groups, group);
  const noise = (g) => !g || g.length > 40 || clean2(g) === group || clean2(g) === video || /^v\d+$/i.test(g) || /^[\da-f]{8}$/i.test(g) || YEAR.test(g) || marker(g);
  return {
    path,
    format,
    episodes,
    strong,
    title: clean2(outside.toLowerCase()),
    season: seasonOf(groups),
    group,
    video,
    medium: mediumOf(groups.map(flat).join(" ")) ?? mediumOf(outside.replace(/[._]/g, " ")),
    tags: groups.filter((g) => !noise(g)),
    version: versionOf(outside, groups)
  };
}
var RANK = { ass: 0, ssa: 1, srt: 2, vtt: 3, sub: 4, txt: 5, zip: 6 };
var within = (range, n) => !!range && n >= range[0] && n <= range[1];
var shift = (range, by) => range && [range[0] - by, range[1] - by];
function gapOf(all) {
  const gaps = all.filter((d) => d.season && d.episodes).map((d) => d.episodes[0] - d.season[0]);
  if (gaps.length < 3) return void 0;
  const counts = /* @__PURE__ */ new Map();
  for (const gap2 of gaps) counts.set(gap2, (counts.get(gap2) ?? 0) + 1);
  const [gap, count] = [...counts].sort((a, b) => b[1] - a[1])[0];
  return count / gaps.length >= 0.75 ? gap : void 0;
}
function pickFiles(paths, episodes, lone, span2) {
  const all = paths.map(describe).filter((d) => !!d);
  const mixed = new Set(all.map((d) => d.group).filter(Boolean)).size > 1;
  const [episode, absolute] = episodes;
  const gap = gapOf(all);
  const main = (d) => d.episodes;
  const season = (d) => gap !== void 0 && d.episodes ? shift(d.episodes, gap) : d.season;
  const fit2 = (pick) => span2 ? all.filter((d) => {
    const range = pick(d);
    return !!range && range[0] >= span2[0] && range[1] <= span2[1];
  }).length : 0;
  let found = [];
  if (episode !== void 0) {
    for (const pick of fit2(main) > fit2(season) ? [main, season] : [season, main]) {
      found = all.filter((d) => within(pick(d), episode));
      if (found.length) break;
    }
  }
  if (!found.length && absolute !== void 0) found = all.filter((d) => within(d.episodes, absolute));
  if (!found.length && span2 && episode !== void 0 && episode >= span2[0] && episode <= span2[1]) {
    const numbers = [...new Set(all.flatMap((d) => d.episodes ? [d.episodes[0]] : []))].sort((a, b) => a - b);
    const elsewhere = all.every((d) => !d.episodes || d.episodes[1] < span2[0] || d.episodes[0] > span2[1]);
    if (elsewhere && numbers.length === span2[1] - span2[0] + 1) found = all.filter((d) => d.episodes?.[0] === numbers[episode - span2[0]]);
  }
  if (!found.length) {
    const numbers = new Set(all.flatMap((d) => d.episodes ? [d.episodes[0]] : []));
    if (lone) found = all.length === 1 || numbers.size <= 1 ? all : all.filter((d) => !d.strong);
    else if (all.length === 1 && !all[0].episodes) found = all;
  }
  const best = /* @__PURE__ */ new Map();
  for (const d of found) {
    const key = `${d.group ?? ""}|${d.video ?? ""}|${d.episodes?.join("-") ?? ""}|${d.tags.join(" ")}|${d.title}`;
    const had = best.get(key);
    if (!had || d.version > had.version || d.version === had.version && RANK[d.format] < RANK[had.format]) best.set(key, d);
  }
  return [...best.values()].map((d) => ({ ...d, mixed }));
}

// node_modules/fflate/esm/browser.js
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]);
var fdeb = new u8([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = function(eb, start) {
  var b = new u16(31);
  for (var i2 = 0; i2 < 31; ++i2) {
    b[i2] = start += 1 << eb[i2 - 1];
  }
  var r = new i32(b[30]);
  for (var i2 = 1; i2 < 30; ++i2) {
    for (var j = b[i2]; j < b[i2 + 1]; ++j) {
      r[j] = j - b[i2] << 5 | i2;
    }
  }
  return { b, r };
};
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0; i < 32768; ++i) {
  x = (i & 43690) >> 1 | (i & 21845) << 1;
  x = (x & 52428) >> 2 | (x & 13107) << 2;
  x = (x & 61680) >> 4 | (x & 3855) << 4;
  rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var x;
var i;
var hMap = (function(cd, mb, r) {
  var s = cd.length;
  var i2 = 0;
  var l = new u16(mb);
  for (; i2 < s; ++i2) {
    if (cd[i2])
      ++l[cd[i2] - 1];
  }
  var le = new u16(mb);
  for (i2 = 1; i2 < mb; ++i2) {
    le[i2] = le[i2 - 1] + l[i2 - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        var sv = i2 << 4 | cd[i2];
        var r_1 = mb - cd[i2];
        var v = le[cd[i2] - 1]++ << r_1;
        for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
          co[rev[v] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        co[i2] = rev[le[cd[i2] - 1]++] >> 15 - cd[i2];
      }
    }
  }
  return co;
});
var flt = new u8(288);
for (i = 0; i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144; i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256; i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280; i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0; i < 32; ++i)
  fdt[i] = 5;
var i;
var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
var max = function(a) {
  var m = a[0];
  for (var i2 = 1; i2 < a.length; ++i2) {
    if (a[i2] > m)
      m = a[i2];
  }
  return m;
};
var bits = function(d, p, m) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
};
var bits16 = function(d, p) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
};
var shft = function(p) {
  return (p + 7) / 8 | 0;
};
var slc = function(v, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  return new u8(v.subarray(s, e));
};
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  // determined by compression function
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
  // determined by unknown compression method
];
var err = function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
};
var inflt = function(dat, st, buf, dict) {
  var sl = dat.length, dl = dict ? dict.length : 0;
  if (!sl || st.f && !st.l)
    return buf || new u8(0);
  var noBuf = !buf;
  var resize = noBuf || st.i != 2;
  var noSt = st.i;
  if (noBuf)
    buf = new u8(sl * 3);
  var cbuf = function(l2) {
    var bl = buf.length;
    if (l2 > bl) {
      var nbuf = new u8(Math.max(bl * 2, l2));
      nbuf.set(buf);
      buf = nbuf;
    }
  };
  var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
  var tbts = sl * 8;
  do {
    if (!lm) {
      final = bits(dat, pos, 1);
      var type = bits(dat, pos + 1, 3);
      pos += 3;
      if (!type) {
        var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
        if (t > sl) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + l);
        buf.set(dat.subarray(s, t), bt);
        st.b = bt += l, st.p = pos = t * 8, st.f = final;
        continue;
      } else if (type == 1)
        lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
      else if (type == 2) {
        var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
        var tl = hLit + bits(dat, pos + 5, 31) + 1;
        pos += 14;
        var ldt = new u8(tl);
        var clt = new u8(19);
        for (var i2 = 0; i2 < hcLen; ++i2) {
          clt[clim[i2]] = bits(dat, pos + i2 * 3, 7);
        }
        pos += hcLen * 3;
        var clb = max(clt), clbmsk = (1 << clb) - 1;
        var clm = hMap(clt, clb, 1);
        for (var i2 = 0; i2 < tl; ) {
          var r = clm[bits(dat, pos, clbmsk)];
          pos += r & 15;
          var s = r >> 4;
          if (s < 16) {
            ldt[i2++] = s;
          } else {
            var c = 0, n = 0;
            if (s == 16)
              n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i2 - 1];
            else if (s == 17)
              n = 3 + bits(dat, pos, 7), pos += 3;
            else if (s == 18)
              n = 11 + bits(dat, pos, 127), pos += 7;
            while (n--)
              ldt[i2++] = c;
          }
        }
        var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
        lbt = max(lt);
        dbt = max(dt);
        lm = hMap(lt, lbt, 1);
        dm = hMap(dt, dbt, 1);
      } else
        err(1);
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
    }
    if (resize)
      cbuf(bt + 131072);
    var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
    var lpos = pos;
    for (; ; lpos = pos) {
      var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
      pos += c & 15;
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
      if (!c)
        err(2);
      if (sym < 256)
        buf[bt++] = sym;
      else if (sym == 256) {
        lpos = pos, lm = null;
        break;
      } else {
        var add = sym - 254;
        if (sym > 264) {
          var i2 = sym - 257, b = fleb[i2];
          add = bits(dat, pos, (1 << b) - 1) + fl[i2];
          pos += b;
        }
        var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
        if (!d)
          err(3);
        pos += d & 15;
        var dt = fd[dsym];
        if (dsym > 3) {
          var b = fdeb[dsym];
          dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
        }
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + 131072);
        var end = bt + add;
        if (bt < dt) {
          var shift2 = dl - dt, dend = Math.min(dt, end);
          if (shift2 + bt < 0)
            err(3);
          for (; bt < dend; ++bt)
            buf[bt] = dict[shift2 + bt];
        }
        for (; bt < end; ++bt)
          buf[bt] = buf[bt - dt];
      }
    }
    st.l = lm, st.p = lpos, st.b = bt, st.f = final;
    if (lm)
      final = 1, st.m = lbt, st.d = dm, st.n = dbt;
  } while (!final);
  return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
var et = /* @__PURE__ */ new u8(0);
function inflateSync(data, opts) {
  return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}

// src/zip.ts
var SkippedEntry = class extends Error {
  constructor(message) {
    super(message);
    this.name = "SkippedEntry";
  }
};
var TAIL = 64 * 1024;
var SLACK = 512;
var MAX_SIZE = 12 * 1024 * 1024;
var MAX_PACKED = 4 * 1024 * 1024;
var MAX_DIRECTORY = 4 * 1024 * 1024;
var TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let c = 4294967295;
  for (const b of bytes) c = TABLE[(c ^ b) & 255] ^ c >>> 8;
  return (c ^ 4294967295) >>> 0;
}
var u162 = (b, o) => b[o] | b[o + 1] << 8;
var u32 = (b, o) => (u162(b, o) | u162(b, o + 2) << 16) >>> 0;
function decodeName(raw) {
  let name;
  try {
    name = new TextDecoder("utf-8", { fatal: true }).decode(raw);
  } catch {
    name = new TextDecoder("windows-1256").decode(raw);
  }
  return name.replaceAll("\\", "/");
}
function findEnd(buf) {
  const lowest = Math.max(0, buf.length - 22 - 65535);
  for (let i2 = buf.length - 22; i2 >= lowest; i2--) {
    if (u32(buf, i2) === 101010256 && i2 + 22 + u162(buf, i2 + 20) <= buf.length) return i2;
  }
  throw new Error("that file is not a zip");
}
function parseDirectory(dir, count) {
  const entries = [];
  let p = 0;
  for (let i2 = 0; i2 < count && p + 46 <= dir.length; i2++) {
    if (u32(dir, p) !== 33639248) break;
    const packed = u32(dir, p + 20);
    const size = u32(dir, p + 24);
    const offset = u32(dir, p + 42);
    if (packed === 4294967295 || size === 4294967295 || offset === 4294967295) throw new Error("zip64 files are not supported");
    const nameLength = u162(dir, p + 28);
    entries.push({
      name: decodeName(dir.subarray(p + 46, p + 46 + nameLength)),
      nameLength,
      method: u162(dir, p + 10),
      flags: u162(dir, p + 8),
      crc: u32(dir, p + 16),
      packed,
      size,
      offset
    });
    p += 46 + nameLength + u162(dir, p + 30) + u162(dir, p + 32);
  }
  return entries;
}
async function build(tail, whole, outside, clock) {
  const end = findEnd(tail);
  const count = u162(tail, end + 10);
  const dirSize = u32(tail, end + 12);
  const dirOffset = u32(tail, end + 16);
  if (count === 65535 || dirSize === 4294967295 || dirOffset === 4294967295) throw new Error("zip64 files are not supported");
  if (dirSize > MAX_DIRECTORY) throw new Error("that zip has a silly amount of files");
  const base = whole ? 0 : dirOffset + dirSize - end;
  const grab = (start, length, clock2) => start >= base ? Promise.resolve(tail.subarray(start - base, start - base + length)) : outside(start, length, clock2);
  const entries = parseDirectory(await grab(dirOffset, dirSize, clock), count);
  return {
    entries,
    async read(entry, clock2) {
      if (entry.flags & 1) throw new SkippedEntry(`${entry.name} is encrypted`);
      if (entry.size > MAX_SIZE || entry.packed > MAX_PACKED) throw new SkippedEntry(`${entry.name} is too big`);
      let buf = await grab(entry.offset, 30 + entry.nameLength + SLACK + entry.packed, clock2);
      if (buf.length < 30 || u32(buf, 0) !== 67324752) throw new Error(`${entry.name} has a broken header`);
      const dataStart = 30 + u162(buf, 26) + u162(buf, 28);
      if (buf.length < dataStart + entry.packed) buf = await grab(entry.offset, dataStart + entry.packed, clock2);
      if (buf.length < dataStart + entry.packed) throw new Error(`${entry.name} is cut short`);
      const packed = buf.subarray(dataStart, dataStart + entry.packed);
      let data;
      if (entry.method === 0) data = packed;
      else if (entry.method === 8) data = inflateSync(packed, { out: new Uint8Array(entry.size) });
      else throw new SkippedEntry(`${entry.name} uses a zip method we can't open`);
      if (data.length !== entry.size || crc32(data) !== entry.crc) throw new Error(`${entry.name} is damaged`);
      return data;
    }
  };
}
async function openZip(fetchFn, url, clock, tailSize = TAIL) {
  const res = await request(fetchFn, url, clock, { Range: `bytes=-${tailSize}` });
  const tail = new Uint8Array(await clock.run(res.arrayBuffer()));
  return await build(tail, res.status !== 206, async (start, length, clock2) => {
    const got = await request(fetchFn, url, clock2, { Range: `bytes=${start}-${start + length - 1}` });
    const body = new Uint8Array(await clock2.run(got.arrayBuffer()));
    return got.status === 206 ? body : body.subarray(start, start + length);
  }, clock);
}
function zipFromBytes(bytes) {
  return build(bytes, true, () => Promise.reject(new Error("that zip is cut short")), noClock);
}

// src/files.ts
var entryOf = (zip, path) => zip.entries.find((e) => e.name === path);
function fromBytes(bytes, file) {
  const text2 = decodeText(bytes);
  const format = detectFormat(text2);
  return format ? [{ file, text: text2, format }] : [];
}
async function readPicked(zip, file, clock) {
  const bytes = await zip.read(entryOf(zip, file.path), clock);
  if (file.format !== "zip") return fromBytes(bytes, file);
  const inner = await zipFromBytes(bytes);
  const picks = pickFiles(inner.entries.map((e) => e.name), [file.episodes?.[0]], true).filter((p) => p.format !== "zip");
  const reads = await Promise.all(picks.map(async (p) => fromBytes(await inner.read(entryOf(inner, p.path), noClock), file)));
  return reads.flat();
}

// src/listing.ts
var NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decodeEntities(text2) {
  return text2.replace(/&(?:#(\d+)|#x([\da-f]+)|(\w+));/gi, (all, dec, hex, name) => {
    if (name) return NAMED[name.toLowerCase()] ?? all;
    const code = Number.parseInt(dec ?? hex, dec ? 10 : 16);
    return code > 0 && code <= 1114111 ? String.fromCodePoint(code) : all;
  });
}
var plain = (html) => decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
var asciiDigits2 = (text2) => text2.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
var UNITS = { \u0643\u064A\u0644\u0648: 1024, \u0645\u064A\u062C\u0627: 1024 ** 2, \u062C\u064A\u062C\u0627: 1024 ** 3 };
function parseSize(text2) {
  const m = /^([\d.]+)\s*(كيلو|ميجا|جيجا)?\s*بايت$/.exec(asciiDigits2(text2).replace(/\s+/g, " ").trim());
  return m && Number.isFinite(Number(m[1])) ? Math.round(Number(m[1]) * (UNITS[m[2] ?? ""] ?? 1)) : void 0;
}
function parseEpisodes(cell) {
  const badges = [...cell.matchAll(/<span[^>]*>([^<]*)<\/span>/g)].map((m) => asciiDigits2(m[1]).trim());
  if (!badges.length || !badges.every((b) => /^\d{1,5}$/.test(b))) return [];
  const numbers = badges.map(Number);
  if (cell.includes("\u0625\u0644\u0649") && numbers.length === 2) return [[Math.min(...numbers), Math.max(...numbers)]];
  return numbers.map((n) => [n, n]);
}
function zipLink(hrefs) {
  for (const href of hrefs) {
    try {
      const url = new URL(decodeEntities(href), ORIGIN);
      if (!/^(www\.)?miraianime\.net$/.test(url.hostname)) continue;
      if (!url.pathname.startsWith("/wp-content/uploads/") || !/\.zip$/i.test(url.pathname)) continue;
      return `${ORIGIN}${url.pathname}${url.search}`;
    } catch {
    }
  }
}
var BLOCK = /<div class="entry fansub-details">([\s\S]*?)<\/table>\s*<\/div>\s*<div class="links-file">([\s\S]*?)<\/div>/g;
var ROW = /<tr>\s*<th>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g;
function parseListing(html) {
  const blocks = [];
  for (const [, info, links] of html.matchAll(BLOCK)) {
    const block = { episodes: [], release: "", translators: [], zip: "" };
    let missing = false;
    let size;
    for (const [, th, td2] of info.matchAll(ROW)) {
      const label2 = plain(th);
      if (label2.includes("\u0627\u0644\u062D\u0644\u0642\u0627\u062A")) block.episodes = parseEpisodes(td2);
      else if (label2.includes("\u0635\u062F\u0627\u0631")) block.release = [...td2.matchAll(/<span[^>]*>([^<]*)<\/span>/g)].map((m) => plain(m[1])).filter(Boolean).join("/");
      else if (label2.includes("\u0627\u0644\u0645\u062A\u0631\u062C\u0645")) block.translators = [...td2.matchAll(/<a[^>]*>([^<]*)<\/a>/g)].map((m) => plain(m[1])).filter(Boolean);
      else if (label2.includes("\u062D\u062C\u0645")) {
        missing = plain(td2).includes("\u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
        size = parseSize(plain(td2));
      }
    }
    const zip = zipLink([...links.matchAll(/href="([^"]*)"/g)].map((m) => m[1]));
    if (zip && !missing) blocks.push({ ...block, zip, size });
  }
  return blocks;
}
function covers(block, episode) {
  return block.episodes.some(([from, to]) => episode >= from && episode <= to);
}

// src/plan.ts
function maxFiles(options) {
  return Math.min(8, Math.max(1, Math.round(Number(options.maxFiles) || 3)));
}
function plan(blocks, query, options) {
  const absolute = query.absoluteEpisodeNumber;
  const episodes = [query.episode, typeof absolute === "number" && absolute >= 0 && absolute !== query.episode ? absolute : void 0];
  const lone = (block) => block.episodes.length === 1 && block.episodes[0][0] === block.episodes[0][1];
  let steps = [];
  for (const episode of episodes) {
    if (episode === void 0) continue;
    steps = blocks.filter((block) => covers(block, episode)).map((block) => ({ block, episodes, lone: lone(block), span: block.episodes.length === 1 ? block.episodes[0] : void 0 }));
    if (steps.length) break;
  }
  if (!steps.length && (query.episodeCount === 1 || query.media?.format === "MOVIE")) {
    steps = blocks.filter((block) => !block.episodes.length).map((block) => ({ block, episodes, lone: true }));
  }
  return steps.slice(0, maxFiles(options) + 2);
}

// src/resolve.ts
var DAY = 24 * 60 * 60 * 1e3;
var slugCache = () => cache(DAY, 256);
var LINK = /href="https:\/\/miraianime\.net\/anime\/([^"/]+)\/"/g;
var idOf = (value) => Number(value) || void 0;
var squash2 = (title) => title.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "");
async function byMal(fetchFn, mal, clock) {
  const html = await getText(fetchFn, `${ORIGIN}/anime/?my_anime_list_ID=${mal}&submit=`, clock);
  return [...new Set([...html.matchAll(LINK)].map((m) => m[1]))];
}
async function rest(fetchFn, params, clock) {
  const data = JSON.parse(await getText(fetchFn, `${ORIGIN}/wp-json/wp/v2/anime?${params}&_fields=slug,title,acf.external_links`, clock));
  return Array.isArray(data) ? data : [];
}
var search = (fetchFn, term, clock) => rest(fetchFn, `search=${encodeURIComponent(term)}&per_page=10`, clock);
function searchTerms(titles) {
  const seen = /* @__PURE__ */ new Set();
  const terms = [];
  for (const title of titles) {
    const key = squash2(title);
    if (!key || seen.has(key) || /[^\p{Script=Latin}\p{N}\p{P}\p{S}\s]/u.test(title)) continue;
    seen.add(key);
    terms.push(title);
  }
  return terms.slice(0, 4);
}
function byIds(candidates, query, mal, strict) {
  let best;
  for (const c of candidates) {
    const links = c.acf?.external_links;
    const anilist = idOf(links?.anilist_id) === query.anilistId;
    const myanimelist = mal !== void 0 && idOf(links?.my_anime_list_id) === mal;
    const anidb = !!query.anidbAid && idOf(links?.anidb_id) === query.anidbAid;
    const score2 = Number(anilist) + Number(myanimelist) + Number(anidb);
    if (!score2 || strict && mal !== void 0 && !myanimelist) continue;
    if (!best || score2 > best.score) best = { slug: c.slug, score: score2 };
  }
  return best?.slug;
}
function byTitle(candidates, query) {
  const wanted = new Set(query.titles.map(squash2));
  const same3 = candidates.filter((c) => wanted.has(squash2(decodeEntities(c.title?.rendered ?? ""))));
  return same3.length === 1 ? same3[0].slug : void 0;
}
function firstFound(lookups) {
  return new Promise((resolve, reject) => {
    let open = lookups.length;
    const failures = [];
    if (!open) resolve(void 0);
    lookups.forEach((lookup, i2) => {
      lookup.then((slug) => {
        if (slug !== void 0) resolve(slug);
      }, (error) => {
        failures[i2] = error ?? new Error("lookup failed");
      }).finally(() => {
        if (--open) return;
        const failure = failures.find(Boolean);
        if (!failure) resolve(void 0);
        else reject(failure instanceof Error ? failure : new Error(String(failure)));
      });
    });
  });
}
async function findSlug(query, clock, slugs) {
  const key = String(query.anilistId);
  const known = slugs.get(key);
  if (known !== void 0) return known ?? void 0;
  const { fetch: fetchFn } = query;
  const mal = idOf(query.malId) ?? idOf(query.media?.idMal);
  const terms = searchTerms(query.titles);
  const lookups = [];
  if (mal) {
    lookups.push(byMal(fetchFn, mal, clock).then(async (hits) => {
      if (hits.length < 2) return hits[0];
      const rows = await Promise.all(hits.map((slug) => rest(fetchFn, `slug=${encodeURIComponent(slug)}`, clock)));
      return byIds(rows.flat(), query, mal, false) ?? hits[0];
    }));
  }
  let first = [];
  if (terms[0]) {
    lookups.push(search(fetchFn, terms[0], clock).then((rows) => {
      first = rows;
      return byIds(rows, query, mal, true);
    }));
  }
  let found = await firstFound(lookups);
  found ?? (found = byIds(first, query, mal, false) ?? byTitle(first, query));
  for (const term of terms.slice(1)) {
    if (found) break;
    const rows = await search(fetchFn, term, clock);
    found = byIds(rows, query, mal, false) ?? byTitle(rows, query);
  }
  return slugs.set(key, found ?? null, found ? DAY : 10 * 60 * 1e3) ?? void 0;
}

// src/sources/mirai.ts
var MINUTE = 60 * 1e3;
var HOUR = 60 * MINUTE;
var DAY2 = 24 * HOUR;
var WHOLE = 300 * 1024;
var asError = (reason) => reason instanceof Error ? reason : new Error(String(reason));
var gone = (error) => error instanceof HttpError && (error.status === 404 || error.status === 410);
var urlSafe = (slug) => /%[\da-f]{2}/i.test(slug) ? slug : encodeURIComponent(slug);
function miraiSource() {
  const slugs = slugCache();
  const listings = cache(10 * MINUTE, 64);
  const zips = cache(30 * MINUTE, 12);
  const found = cache(30 * MINUTE, 32);
  async function slugOf(query, clock, store) {
    const key = `mirai:slug:${query.anilistId}`;
    const kept = query.anilistId ? await store.get(key) : void 0;
    if (kept) return kept.value ?? void 0;
    const slug = await findSlug(query, clock, slugs);
    if (query.anilistId) store.set(key, slug ?? null, slug ? 30 * DAY2 : 6 * HOUR);
    return slug;
  }
  async function fetchListing(slug, fetchFn, clock, store) {
    let blocks;
    try {
      blocks = parseListing(await getText(fetchFn, `${ORIGIN}/subtitle/${urlSafe(slug)}/`, clock));
    } catch (error) {
      if (!gone(error)) throw error;
      blocks = [];
    }
    store.set(`mirai:list:${slug}`, blocks, blocks.length ? 7 * DAY2 : 30 * MINUTE);
    return listings.set(slug, { blocks, at: Date.now() }, blocks.length ? void 0 : 5 * MINUTE);
  }
  async function steps(slug, ask) {
    const { query, options, clock, store } = ask;
    const kept = listings.get(slug) ?? await store.get(`mirai:list:${slug}`).then((hit) => hit && listings.set(slug, { blocks: hit.value, at: hit.at }));
    if (!kept) return plan((await fetchListing(slug, query.fetch, clock, store)).blocks, query, options);
    const age = Date.now() - kept.at;
    const planned = plan(kept.blocks, query, options);
    if (!planned.length && age > 10 * MINUTE) return plan((await fetchListing(slug, query.fetch, clock, store)).blocks, query, options);
    if (age > 6 * HOUR) fetchListing(slug, query.fetch, startClock(2e4), store).catch(() => void 0);
    return planned;
  }
  async function fromZip({ block, episodes, lone, span: span2 }, ask, language) {
    const { query, clock, store } = ask;
    const key = `${block.zip}|${episodes.join(",")}`;
    const build2 = (kept2) => kept2.map((k) => candidate(k, block, language, lone));
    const known = found.get(key) ?? (await store.get(`mirai:sub:${key}`))?.value;
    if (known) return { candidates: build2(found.set(key, known)) };
    const tail = block.size && block.size <= WHOLE ? Math.ceil(block.size * 1.1) + 1024 : void 0;
    const zip = zips.get(block.zip) ?? zips.set(block.zip, await openZip(query.fetch, block.zip, clock, tail));
    const picked = pickFiles(zip.entries.map((e) => e.name), episodes, lone, span2);
    const reads = await Promise.allSettled(picked.map((file) => readPicked(zip, file, clock)));
    const files = reads.flatMap((r) => r.status === "fulfilled" ? r.value : []);
    const failed = reads.find((r) => r.status === "rejected" && !(r.reason instanceof SkippedEntry));
    if (failed && !files.length) throw asError(failed.reason);
    const kept = files.map(({ file, text: text2, format }) => ({ text: text2, format, name: file.path.slice(file.path.lastIndexOf("/") + 1), group: file.group, video: file.video, medium: file.medium, mixed: file.mixed, tags: file.tags, version: file.version }));
    if (!failed) {
      found.set(key, kept);
      store.set(`mirai:sub:${key}`, kept, 14 * DAY2);
    }
    return { candidates: build2(kept), failed: failed?.reason };
  }
  function candidate(kept, block, language, exact) {
    const named2 = nameOf(kept, block, "Mirai");
    return {
      source: "mirai",
      language,
      text: kept.text,
      format: kept.format,
      named: named2,
      release: { medium: kept.medium ?? (/^(?:BD|WEB|TV|DVD)$/.test(block.release) ? block.release : void 0), group: named2.video, resolution: resolutionOf(kept.tags.join(" ")) },
      name: kept.name,
      tags: kept.tags,
      version: kept.version,
      exact
    };
  }
  return {
    id: "mirai",
    name: "Mirai Anime",
    origins: [ORIGIN],
    free: true,
    ready: (_, languages) => languages.some((l) => l.mirai),
    async search(ask) {
      const language = ask.languages.find((l) => l.mirai);
      const slug = await slugOf(ask.query, ask.clock, ask.store);
      if (!slug) return;
      const planned = await steps(slug, ask);
      const errors = [];
      let any = false;
      await Promise.all(planned.map(async (step) => {
        try {
          const { candidates, failed } = await fromZip(step, ask, language);
          if (failed) ask.failed(failed);
          if (candidates.length) {
            any = true;
            ask.found(candidates);
          }
        } catch (error) {
          errors.push(error);
          if (!gone(error)) ask.failed(error);
        }
      }));
      if (!any) {
        const failure = errors.find((error) => !gone(error));
        if (failure) throw asError(failure);
      }
    }
  };
}
async function testMirai() {
  const clock = startClock(4e3);
  const res = await request(fetch, `${ORIGIN}/wp-json/wp/v2/anime?per_page=1&_fields=id`, clock);
  if (!Array.isArray(await clock.run(res.json()))) throw new Error("mirai answered something unexpected");
  return true;
}

// src/limits.ts
var DAY3 = 24 * 60 * 60 * 1e3;
var today = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
function limiter(store, id, limit) {
  const recent = [];
  let day = "";
  let count;
  async function load() {
    if (count === void 0 || day !== today()) {
      day = today();
      count = (await store.get(`quota:${id}:${day}`))?.value ?? 0;
    }
    return count;
  }
  return {
    async take() {
      const now = Date.now();
      while (recent.length && recent[0] < now - 6e4) recent.shift();
      if (recent.length >= limit.perMinute) return false;
      if (await load() >= limit.perDay) return false;
      recent.push(now);
      count = (count ?? 0) + 1;
      store.set(`quota:${id}:${day}`, count, 2 * DAY3);
      return true;
    },
    used: load
  };
}

// src/sources/shared.ts
function seasonOf2(query) {
  if (typeof query.season === "number" && query.season > 0) return query.season;
  for (const title of query.titles) {
    const season = parseName(title).season;
    if (season) return season;
  }
  return 1;
}
var isMovie = (query) => query.media?.format === "MOVIE" || query.episodeCount === 1 && query.media?.format !== "TV";
function searchTitles(query) {
  const seen = /* @__PURE__ */ new Set();
  return query.titles.filter((title) => {
    const key = squash(parseName(title).base);
    if (key.length < 3 || seen.has(key) || /[^\p{Script=Latin}\p{N}\p{P}\p{S}\s]/u.test(title)) return false;
    seen.add(key);
    return true;
  }).map((title) => parseName(title).base || title);
}
function fits(name, query, season) {
  const parsed = parseName(name);
  if (parsed.season !== void 0 && parsed.season !== season && !parsed.seasons) return false;
  if (!parsed.episodes) return void 0;
  const [from, to] = parsed.episodes;
  const absolute = query.absoluteEpisodeNumber;
  const hit = (n) => typeof n === "number" && n >= from && n <= to;
  return hit(query.seasonEpisode) || hit(query.episode) || hit(absolute);
}
async function unpack(bytes, pack, query, source, fallback, language) {
  const episodes = [query.seasonEpisode ?? query.episode, query.absoluteEpisodeNumber ?? void 0].filter((n) => typeof n === "number");
  const wanted = [episodes[0], episodes[1] !== episodes[0] ? episodes[1] : void 0];
  const files = [];
  const isZip = bytes[0] === 80 && bytes[1] === 75;
  if (isZip) {
    const zip = await zipFromBytes(bytes);
    const names2 = zip.entries.map((e) => e.name);
    const lone = names2.filter((n) => describe(n) !== void 0).length === 1 || parseName(pack.release).episodes !== void 0;
    for (const picked of pickFiles(names2, wanted, lone).filter((p) => p.format !== "zip").slice(0, 3)) {
      const entry = zip.entries.find((e) => e.name === picked.path);
      try {
        files.push({ name: picked.path.slice(picked.path.lastIndexOf("/") + 1), text: decodeText(await zip.read(entry, noClock)) });
      } catch {
      }
    }
  } else {
    files.push({ name: pack.release, text: decodeText(bytes) });
  }
  const out = [];
  for (const file of files) {
    const format = detectFormat(file.text);
    if (!format) continue;
    const described = describe(file.name.includes(".") ? file.name : `${file.name}.${format}`);
    const fromFile = parseRelease(file.name);
    const fromPack = parseRelease(pack.release);
    const video = described?.video ?? (fromFile.group && isVideoGroup(fromFile.group) ? fromFile.group : fromPack.group);
    const group = described?.group && !isVideoGroup(described.group) ? described.group : void 0;
    const medium = described?.medium ?? fromFile.medium ?? fromPack.medium ?? pack.medium ?? mediumOf(pack.release);
    out.push({
      source,
      language,
      text: file.text,
      format,
      named: { who: fullName(group ?? pack.author ?? fallback), medium, video },
      release: { medium, group: video, resolution: fromFile.resolution ?? fromPack.resolution },
      name: file.name,
      tags: described?.tags ?? [],
      version: described?.version ?? 1,
      exact: !isZip || files.length === 1
    });
  }
  return out;
}
async function getJson(fetchFn, url, clock, who, headers) {
  const res = await request(fetchFn, url, clock, headers, who);
  return await clock.run(res.json());
}
async function getBytes(fetchFn, url, clock, who, headers) {
  const res = await request(fetchFn, url, clock, headers, who);
  return new Uint8Array(await clock.run(res.arrayBuffer()));
}

// src/sources/types.ts
var LANGUAGES = {
  ar: { code: "ar", name: "Arabic", subdl: "AR", subsource: "arabic", mirai: true },
  en: { code: "en", name: "English", subdl: "EN", subsource: "english", mirai: false },
  fr: { code: "fr", name: "French", subdl: "FR", subsource: "french", mirai: false },
  es: { code: "es", name: "Spanish", subdl: "ES", subsource: "spanish", mirai: false },
  tr: { code: "tr", name: "Turkish", subdl: "TR", subsource: "turkish", mirai: false },
  id: { code: "id", name: "Indonesian", subdl: "ID", subsource: "indonesian", mirai: false }
};
var text = (value) => typeof value === "string" ? value.trim() : "";
var on = (value, fallback) => value === void 0 || value === null || value === "" ? fallback : value !== false && value !== "false" && value !== 0;

// src/sources/subdl.ts
var API = "https://api.subdl.com/api/v1/subtitles";
var FILES = "https://dl.subdl.com";
var HOUR2 = 60 * 60 * 1e3;
var DAY4 = 24 * HOUR2;
function subdlSource() {
  let limit;
  const quota = (store) => limit ?? (limit = limiter(store, "subdl", { perMinute: 30, perDay: 1800 }));
  async function list(ask, language, key) {
    const { query, store, clock } = ask;
    const season = seasonOf2(query);
    const episode = query.seasonEpisode ?? query.episode;
    const movie = isMovie(query);
    const kept = `subdl:list:${query.anilistId}:${movie ? "movie" : `${season}x${episode}`}:${language.code}`;
    const known = await store.get(kept);
    if (known) return known.value;
    const who = query.imdbId ? `imdb_id=${encodeURIComponent(query.imdbId)}` : query.tmdbId ? `tmdb_id=${encodeURIComponent(String(query.tmdbId))}` : `film_name=${encodeURIComponent(searchTitles(query)[0] ?? query.titles[0] ?? "")}`;
    const where = movie ? "type=movie" : `type=tv&season_number=${season}&episode_number=${episode}`;
    if (!await quota(store).take()) return [];
    let answer;
    try {
      answer = await getJson(query.fetch, `${API}?api_key=${encodeURIComponent(key)}&${who}&${where}&languages=${language.subdl}&subs_per_page=30`, clock, "subdl");
    } catch (error) {
      if (error instanceof HttpError && (error.status === 404 || error.status === 400)) answer = { subtitles: [] };
      else if (error instanceof HttpError && (error.status === 401 || error.status === 403)) throw new Error("subdl did not accept the key, check it in settings");
      else throw error;
    }
    const items = Array.isArray(answer.subtitles) ? answer.subtitles.filter((item) => text(item.url)) : [];
    store.set(kept, items, items.length ? DAY4 : 3 * HOUR2);
    return items;
  }
  return {
    id: "subdl",
    name: "SubDL",
    origins: ["https://api.subdl.com", FILES],
    free: false,
    ready: (options) => text(options.subdlKey).length > 0,
    async search(ask) {
      const { query, store, clock } = ask;
      const key = text(ask.options.subdlKey);
      const season = seasonOf2(query);
      const video = query.fileName ? parseRelease(query.fileName) : void 0;
      for (const language of ask.languages) {
        const items = (await list(ask, language, key)).filter((item) => {
          const name = text(item.release_name) || text(item.name);
          if (typeof item.season === "number" && item.season > 0 && item.season !== season && !isMovie(query)) return false;
          return fits(name, query, season) !== false;
        }).map((item) => ({ item, score: (video ? fit(parseRelease(text(item.release_name)), video) : 0) - (item.full_season ? 20 : 0) })).sort((a, b) => b.score - a.score).slice(0, ask.max);
        await Promise.all(items.map(async ({ item }) => {
          const url = text(item.url);
          const kept = `subdl:sub:${url}:${query.seasonEpisode ?? query.episode}`;
          let candidates = (await store.get(kept))?.value;
          if (!candidates) {
            const bytes = await getBytes(query.fetch, url.startsWith("http") ? url : `${FILES}${url.startsWith("/") ? "" : "/"}${url}`, clock, "subdl");
            candidates = await unpack(bytes, { release: text(item.release_name) || text(item.name), author: text(item.author) || void 0 }, query, "subdl", "SubDL", language);
            store.set(kept, candidates, 14 * DAY4);
          }
          if (candidates.length) ask.found(candidates.map((c) => ({ ...c, language })));
        }).map((p) => p.catch((error) => {
          ask.failed(error);
        })));
      }
    }
  };
}

// src/sources/subsource.ts
var API2 = "https://api.subsource.net/api/v1";
var HOUR3 = 60 * 60 * 1e3;
var DAY5 = 24 * HOUR3;
var MEDIA2 = { bluray: "BD", bdrip: "BD", web: "WEB", webrip: "WEB", "web-dl": "WEB", hdtv: "TV", tv: "TV", dvd: "DVD", dvdrip: "DVD" };
function subsourceSource() {
  let limit;
  const quota = (store) => limit ?? (limit = limiter(store, "subsource", { perMinute: 50, perDay: 6e3 }));
  async function call(ask, path, key) {
    if (!await quota(ask.store).take()) return void 0;
    try {
      return await getJson(ask.query.fetch, `${API2}${path}`, ask.clock, "subsource", { "X-API-Key": key });
    } catch (error) {
      if (error instanceof HttpError && (error.status === 401 || error.status === 403)) throw new Error("subsource did not accept the key, check it in settings");
      if (error instanceof HttpError && error.status === 404) return void 0;
      throw error;
    }
  }
  const rows = (answer) => {
    const data = answer?.data;
    return Array.isArray(data) ? data : [];
  };
  async function movieId(ask, key) {
    const { query, store } = ask;
    const season = seasonOf2(query);
    const movie = isMovie(query);
    const kept = `subsource:id:${query.anilistId}:${movie ? "movie" : season}`;
    const known = await store.get(kept);
    if (known) return known.value ?? void 0;
    const type = movie ? "movie" : "series";
    const wanted = new Set(query.titles.map(squash));
    const pick = (found2) => {
      const fitting = found2.filter((m) => typeof m.movieId === "number" && (movie ? m.type === "movie" : m.type !== "movie" && (m.season ?? season) === season));
      return fitting.find((m) => wanted.has(squash(text(m.title))) || wanted.has(squash(text(m.alternateTitle)))) ?? (query.imdbId ? fitting[0] : void 0);
    };
    let found;
    if (query.imdbId) found = pick(rows(await call(ask, `/movies/search?searchType=imdb&imdb=${encodeURIComponent(query.imdbId)}&type=${type}${movie ? "" : `&season=${season}`}`, key)));
    for (const title of searchTitles(query).slice(0, 2)) {
      if (found) break;
      found = pick(rows(await call(ask, `/movies/search?searchType=text&q=${encodeURIComponent(title)}&type=${type}${movie ? "" : `&season=${season}`}`, key)));
    }
    store.set(kept, found?.movieId ?? null, found ? 30 * DAY5 : 12 * HOUR3);
    return found?.movieId;
  }
  async function list(ask, id, language, key) {
    const kept = `subsource:list:${id}:${language.code}`;
    const known = await ask.store.get(kept);
    if (known) return known.value;
    const found = rows(await call(ask, `/subtitles?movieId=${id}&language=${language.subsource}&limit=100&sort=popular`, key));
    ask.store.set(kept, found, found.length ? 12 * HOUR3 : 3 * HOUR3);
    return found;
  }
  return {
    id: "subsource",
    name: "SubSource",
    origins: ["https://api.subsource.net"],
    free: false,
    ready: (options) => text(options.subsourceKey).length > 0,
    async search(ask) {
      const { query, store, clock } = ask;
      const key = text(ask.options.subsourceKey);
      const id = await movieId(ask, key);
      if (!id) return;
      const season = seasonOf2(query);
      const video = query.fileName ? parseRelease(query.fileName) : void 0;
      const names2 = (s) => (Array.isArray(s.releaseInfo) ? s.releaseInfo : [text(s.releaseInfo)]).filter(Boolean);
      for (const language of ask.languages) {
        const picked = (await list(ask, id, language, key)).filter((s) => typeof s.subtitleId === "number").map((s) => {
          const verdicts = names2(s).map((name) => fits(name, query, season));
          const match = verdicts.includes(true) ? 2 : verdicts.every((v) => v === void 0) ? 1 : 0;
          const best = video ? Math.max(0, ...names2(s).map((name) => fit(parseRelease(name), video))) : 0;
          return { s, match, score: match * 100 + best };
        }).filter(({ match }) => match === 2 || match === 1 && (isMovie(query) || query.episodeCount === 1)).sort((a, b) => b.score - a.score).slice(0, ask.max);
        await Promise.all(picked.map(async ({ s }) => {
          const kept = `subsource:sub:${s.subtitleId}:${query.seasonEpisode ?? query.episode}`;
          let candidates = (await store.get(kept))?.value;
          if (!candidates) {
            if (!await quota(store).take()) return;
            const bytes = await getBytes(query.fetch, `${API2}/subtitles/${s.subtitleId}/download`, clock, "subsource", { "X-API-Key": key });
            const release = names2(s).find((name) => fits(name, query, season)) ?? names2(s)[0] ?? "";
            candidates = await unpack(bytes, { release, author: text(s.contributors?.[0]?.displayname) || void 0, medium: MEDIA2[text(s.releaseType).toLowerCase()] }, query, "subsource", "SubSource", language);
            store.set(kept, candidates, 14 * DAY5);
          }
          if (candidates.length) ask.found(candidates.map((c) => ({ ...c, language })));
        }).map((p) => p.catch((error) => {
          ask.failed(error);
        })));
      }
    }
  };
}

// src/store.ts
function memoryStore(max2 = 400) {
  const map = /* @__PURE__ */ new Map();
  return {
    async get(key) {
      const hit = map.get(key);
      if (!hit) return void 0;
      if (hit.until < Date.now()) {
        map.delete(key);
        return void 0;
      }
      return { value: hit.value, at: hit.at };
    },
    async set(key, value, life) {
      map.delete(key);
      map.set(key, { value, at: Date.now(), until: Date.now() + life });
      if (map.size > max2) map.delete(map.keys().next().value);
    }
  };
}
function cacheStore(name, fallback = memoryStore()) {
  let opening;
  const open = () => opening ?? (opening = (async () => {
    try {
      return typeof caches === "undefined" ? void 0 : await caches.open(name);
    } catch {
      return void 0;
    }
  })());
  const url = (key) => `https://navi-subs.invalid/${encodeURIComponent(key)}`;
  return {
    async get(key) {
      const cache2 = await open();
      if (!cache2) return await fallback.get(key);
      try {
        const res = await cache2.match(url(key));
        if (!res) return void 0;
        const kept = await res.json();
        if (kept.until < Date.now()) {
          cache2.delete(url(key));
          return void 0;
        }
        return { value: kept.value, at: kept.at };
      } catch {
        return void 0;
      }
    },
    async set(key, value, life) {
      const cache2 = await open();
      if (!cache2) return await fallback.set(key, value, life);
      try {
        const kept = { value, at: Date.now(), until: Date.now() + life };
        await cache2.put(url(key), new Response(JSON.stringify(kept), { headers: { "content-type": "application/json" } }));
      } catch {
      }
    }
  };
}
function defaultStore() {
  return cacheStore("navi-subs-v1");
}

// src/engine.ts
function problemOf(error) {
  if (error instanceof BlockedError) return "blocked";
  if (error instanceof DownError) return "down";
  if (error instanceof SlowError) return "slow";
  if (error instanceof Error && /did not accept the key/.test(error.message)) return "key";
  return "other";
}
var MINUTE2 = 60 * 1e3;
var asError2 = (reason) => reason instanceof Error ? reason : new Error(String(reason));
var names = (title, synonyms) => [title?.romaji, title?.english, title?.native, title?.userPreferred, ...synonyms ?? []].filter((t) => !!t);
function wantedOf(query) {
  const media = query.media;
  return {
    entry: { titles: [.../* @__PURE__ */ new Set([...query.titles, ...names(media?.title, media?.synonyms)])], episodes: media?.episodes ?? query.episodeCount, format: media?.format },
    related: (media?.relations?.edges ?? []).flatMap((edge) => edge?.node && edge.relationType ? [{ relation: edge.relationType, titles: names(edge.node.title, edge.node.synonyms), episodes: edge.node.episodes, format: edge.node.format }] : []),
    episode: query.episode,
    absolute: query.absoluteEpisodeNumber
  };
}
function languagesOf(options) {
  const codes = (text(options.languages) || "ar").split(/[,\s]+/).map((code) => code.toLowerCase());
  const found = codes.map((code) => LANGUAGES[code]).filter((l) => !!l);
  return found.length ? found : [LANGUAGES.ar];
}
var preferOf = (options) => {
  const value = text(options.release).toUpperCase();
  return value === "BD" || value === "WEB" || value === "TV" ? value : void 0;
};
function maxFiles2(options) {
  return Math.min(8, Math.max(1, Math.round(Number(options.maxFiles) || 3)));
}
var defaultSources = () => [miraiSource(), subdlSource(), subsourceSource()];
function createEngine({ store = defaultStore(), sources = defaultSources(), budget = 8e3, patience = 25e3, grace = 1500 } = {}) {
  const runs = cache(30 * MINUTE2, 24);
  const statuses = /* @__PURE__ */ new Map();
  const active = (options, languages) => sources.filter((source) => on(options[source.id], true) && source.ready(options, languages));
  function start(query, options, only) {
    const languages = languagesOf(options);
    const picked = active(options, languages).filter((source) => !only || only(source));
    const run = { candidates: [], errors: [], soft: [], open: picked.length, all: Promise.resolve(), wake: [] };
    const poke = () => {
      for (const wake of run.wake.splice(0)) wake();
    };
    run.all = Promise.all(picked.map(async (source) => {
      let found = 0;
      let trouble;
      try {
        await source.search({
          query,
          options,
          languages,
          store,
          clock: startClock(patience, source.id),
          max: maxFiles2(options) + 2,
          found: (candidates) => {
            found += candidates.length;
            run.candidates.push(...candidates);
            poke();
          },
          failed: (error) => {
            trouble ?? (trouble = error);
            if (source.free) run.soft.push(error);
          }
        });
      } catch (error) {
        trouble = error;
        if (source.free) run.errors.push(error);
      } finally {
        statuses.set(source.id, { ok: !trouble || found > 0, found, problem: trouble && !found ? problemOf(trouble) : void 0, at: Date.now() });
        run.open--;
        poke();
      }
    })).then(() => void 0);
    return run;
  }
  function keyOf(query, options) {
    const sourcesKey = sources.map((s) => `${s.id}:${on(options[s.id], true) && s.ready(options, languagesOf(options)) ? 1 : 0}`).join(",");
    return [query.anilistId, query.malId ?? "", query.episode, query.absoluteEpisodeNumber ?? "", query.seasonEpisode ?? "", query.episodeCount ?? "", query.media?.format ?? "", query.titles[0] ?? "", maxFiles2(options), text(options.languages), sourcesKey].join("|");
  }
  function arrange(candidates, query, options) {
    const video = query.fileName ? parseRelease(query.fileName) : void 0;
    const prefer = preferOf(options);
    const wanted = wantedOf(query);
    const hide = on(options.hideOtherSeasons, true);
    const best = /* @__PURE__ */ new Map();
    candidates.forEach((candidate) => {
      const season = candidate.source === "mirai" ? "same" : judge(candidate.name, wanted).verdict;
      if (season === "other" && hide) return;
      const points = score(candidate, video, prefer, season === "other" ? "unsure" : season);
      const id = `${candidate.language.code}:${fingerprint(candidate.text)}`;
      const had = best.get(id);
      if (!had || points > had.points) best.set(id, { candidate, points, season });
    });
    const ranked = [...best.entries()].sort((a, b) => b[1].points - a[1].points || a[1].candidate.named.who.localeCompare(b[1].candidate.named.who) || a[0].localeCompare(b[0]));
    const plain2 = ranked.map(([, { candidate }]) => label(candidate.named, candidate.format, candidate.language.name));
    const labels = unique(ranked.map(([, { candidate }], i2) => {
      const alike = ranked.filter((_, j) => plain2[j] === plain2[i2]).map(([, r]) => r.candidate);
      if (alike.length < 2) return plain2[i2];
      const extra = candidate.tags.filter((tag) => alike.some((other2) => !other2.tags.includes(tag))).join(" ");
      return label(candidate.named, candidate.format, candidate.language.name, extra);
    }));
    return ranked.map(([id, { candidate, points, season }], i2) => ({
      id,
      source: candidate.source,
      sourceName: sources.find((s) => s.id === candidate.source)?.name ?? candidate.source,
      label: labels[i2],
      language: candidate.language.code,
      text: candidate.text,
      format: candidate.format,
      who: candidate.named.who,
      medium: candidate.named.medium,
      video: candidate.named.video,
      name: candidate.name,
      score: points,
      season
    }));
  }
  function settle(run, ms) {
    return new Promise((resolve) => {
      let graceTimer;
      let over = false;
      const finish = () => {
        over = true;
        clearTimeout(deadline);
        clearTimeout(graceTimer);
        resolve();
      };
      const deadline = setTimeout(finish, ms);
      const check = () => {
        if (over) return;
        if (!run.open) return finish();
        if (run.candidates.length) graceTimer ?? (graceTimer = setTimeout(finish, grace));
        run.wake.push(check);
      };
      check();
    });
  }
  function ahead(query, options) {
    const count = query.episodeCount ?? query.media?.episodes;
    if (count && query.episode >= count) return;
    const next = {
      ...query,
      episode: query.episode + 1,
      absoluteEpisodeNumber: typeof query.absoluteEpisodeNumber === "number" ? query.absoluteEpisodeNumber + 1 : query.absoluteEpisodeNumber,
      seasonEpisode: typeof query.seasonEpisode === "number" ? query.seasonEpisode + 1 : query.seasonEpisode,
      fileName: void 0
    };
    const key = `ahead|${keyOf(next, options)}`;
    if (runs.get(key) || runs.get(keyOf(next, options))) return;
    runs.set(key, start(next, options, (source) => source.free), 5 * MINUTE2);
  }
  return {
    sources,
    // sites the app has to allow requests to
    origins: () => [...new Set(sources.flatMap((source) => source.origins))],
    async find(query, options = {}) {
      const key = keyOf(query, options);
      let run = runs.get(key);
      if (run && !run.open && (run.errors.length || run.soft.length)) run = void 0;
      run ?? (run = runs.set(key, start(query, options)));
      await settle(run, budget);
      const current = run;
      const results = arrange(current.candidates, query, options);
      const pending = current.open > 0;
      if (!pending && !results.length) {
        const failure = current.errors.find((error) => !(error instanceof SlowError));
        if (failure) throw asError2(failure);
      }
      const done = current.all.then(() => arrange(current.candidates, query, options));
      if (on(options.ahead, true)) done.then(() => ahead(query, options)).catch(() => void 0);
      return { results, pending, done };
    },
    // how each source did the last time it ran
    status: (id) => statuses.get(id),
    // which of the keyed sources are switched on, for the settings page
    ready: (options) => active(options, languagesOf(options)).map((source) => source.id)
  };
}

// src/fonts.ts
var FAMILY = "Noto Naskh Arabic";
var FILES2 = {
  regular: "https://fonts.gstatic.com/s/notonaskharabic/v33/RrQ5bpV-9Dd1b1OAGA6M9PkyDuVBePeKNaxcsss0Y7bwvc5krK019_I.ttf",
  bold: "https://fonts.gstatic.com/s/notonaskharabic/v33/RrQ5bpV-9Dd1b1OAGA6M9PkyDuVBePeKNaxcsss0Y7bwWslkrK019_I.ttf"
};
var DAY6 = 24 * 60 * 60 * 1e3;
function fontSource() {
  let loading;
  let until = 0;
  return async (fetchFn) => {
    if (!loading || Date.now() > until) {
      const clock = startClock(4e3);
      const get = async (url) => new Uint8Array(await clock.run((await request(fetchFn, url, clock)).arrayBuffer()));
      const mine = Promise.all([get(FILES2.regular), get(FILES2.bold)]).then(([regular, bold]) => ({ regular, bold }));
      loading = mine;
      until = Date.now() + DAY6;
      mine.catch(() => {
        if (loading === mine) loading = void 0;
      });
    }
    try {
      return await loading;
    } catch {
      return void 0;
    }
  };
}
function uuencode(bytes) {
  let text2 = "";
  for (let i2 = 0; i2 < bytes.length; i2 += 3) {
    const n = bytes[i2] << 16 | (bytes[i2 + 1] ?? 0) << 8 | (bytes[i2 + 2] ?? 0);
    const quad = String.fromCharCode(33 + (n >> 18 & 63), 33 + (n >> 12 & 63), 33 + (n >> 6 & 63), 33 + (n & 63));
    text2 += quad.slice(0, Math.min(3, bytes.length - i2) + 1);
  }
  const lines = [];
  for (let i2 = 0; i2 < text2.length; i2 += 80) lines.push(text2.slice(i2, i2 + 80));
  return lines;
}
var embedded = (name, bytes, index) => [`fontname: ${name}_${index}.ttf`, ...uuencode(bytes)];
function restyle(text2, fonts) {
  const eol = text2.includes("\r\n") ? "\r\n" : "\n";
  const lines = text2.split(/\r?\n/);
  let section = "";
  let columns = ["name", "fontname", "fontsize", "primarycolour", "secondarycolour", "outlinecolour", "backcolour", "bold"];
  let events = -1;
  let bold = false;
  let regular = false;
  const out = lines.map((line, i2) => {
    const header = /^\s*\[(.+?)\]\s*$/.exec(line);
    if (header) {
      section = header[1].toLowerCase();
      if (section === "events" && events < 0) events = i2;
      return line;
    }
    if (section.includes("styles")) {
      if (/^format:/i.test(line)) columns = line.slice(line.indexOf(":") + 1).split(",").map((c) => c.trim().toLowerCase());
      if (!/^style:/i.test(line)) return line;
      const cells = line.slice(line.indexOf(":") + 1).trimStart().split(",");
      const font = columns.indexOf("fontname");
      if (font < 0 || font >= cells.length) return line;
      cells[font] = FAMILY;
      const weight = Number(cells[columns.indexOf("bold")]);
      if (weight && Number.isFinite(weight)) bold = true;
      else regular = true;
      return `Style: ${cells.join(",")}`;
    }
    return section === "events" && /^dialogue:/i.test(line) ? line.replace(/\\fn[^\\}]+/g, `\\fn${FAMILY}`) : line;
  });
  if (!bold && !regular) return void 0;
  const files = [
    ...regular ? embedded("NotoNaskhArabic-Regular", fonts.regular, 0) : [],
    ...bold ? embedded("NotoNaskhArabic-Bold", fonts.bold, 1) : []
  ];
  out.splice(events < 0 ? out.length : events, 0, "[Fonts]", ...files, "");
  return out.join(eol);
}
var HEADER = [
  "[Script Info]",
  "ScriptType: v4.00+",
  "WrapStyle: 0",
  "PlayResX: 1920",
  "PlayResY: 1080",
  "ScaledBorderAndShadow: yes",
  "",
  "[V4+ Styles]",
  "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
  // what hayase gives a plain srt, only the font is ours
  `Style: Default,${FAMILY},52,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2.6,0,2,20,20,46,1`,
  ""
];
var CUE = /(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})/;
function stamp(h, m, s, ms) {
  const total = ((Number(h) * 60 + Number(m)) * 60 + Number(s)) * 100 + Math.round(Number(ms.padEnd(3, "0")) / 10);
  const part = (n) => String(n).padStart(2, "0");
  return `${Math.floor(total / 36e4)}:${part(Math.floor(total / 6e3) % 60)}:${part(Math.floor(total / 100) % 60)}.${part(total % 100)}`;
}
function fromSrt(text2, fonts) {
  const events = [];
  for (const block of text2.split(/\r?\n\s*\r?\n/)) {
    const lines = block.split(/\r?\n/);
    const at = lines.findIndex((line) => CUE.test(line));
    const cue = at < 0 ? null : CUE.exec(lines[at]);
    const words = lines.slice(at + 1).map((line) => line.trim()).filter(Boolean);
    if (!cue || !words.length) continue;
    const spoken = words.join("\\N").replace(/<(\/?)([ibu])>/gi, (_, close, tag) => `{\\${tag.toLowerCase()}${close ? 0 : 1}}`).replace(/<[^>]+>/g, "").replace(/&nbsp;/g, "\\h").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    events.push(`Dialogue: 0,${stamp(cue[1], cue[2], cue[3], cue[4])},${stamp(cue[5], cue[6], cue[7], cue[8])},Default,,0,0,0,,${spoken}`);
  }
  if (!events.length) return void 0;
  const head = [...HEADER, "[Fonts]", ...embedded("NotoNaskhArabic-Regular", fonts.regular, 0), "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"];
  return [...head, ...events, ""].join("\r\n");
}
function withFont(text2, format, fonts) {
  if (format === "srt") {
    const converted = fromSrt(text2, fonts);
    return converted ? { text: converted, format: "ass" } : { text: text2, format };
  }
  if ((format === "ass" || format === "ssa") && !/^\s*\[fonts\]/im.test(text2)) return { text: restyle(text2, fonts) ?? text2, format };
  return { text: text2, format };
}

// src/extension.ts
var LIMIT = 9300;
function createExtension(budget = 8e3, grace = 1500, link = toLink, fonts = fontSource(), store = defaultStore()) {
  const engine = createEngine({ budget, grace, store });
  return {
    url: ORIGIN,
    engine,
    test: testMirai,
    async single(query, options = {}) {
      const started = Date.now();
      const { results } = await engine.find(query, options);
      const picked = results.slice(0, maxFiles2(options));
      const wait = Math.max(0, Math.min(budget, LIMIT) - (Date.now() - started));
      const loaded = picked.length && options.fonts !== false ? await Promise.race([fonts(query.fetch), new Promise((resolve) => setTimeout(resolve, Math.max(wait, 300)))]) : void 0;
      return picked.map((found) => {
        const shown = loaded ? withFont(found.text, found.format, loaded) : found;
        return { url: link(shown.text, shown.format), language: found.label.replace(/\.\w+$/, `.${shown.format}`) };
      });
    }
  };
}

// src/index.ts
var index_default = createExtension();
export {
  index_default as default
};
