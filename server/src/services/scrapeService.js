const axios = require("axios");
const cheerio = require("cheerio");

function normalizeUrl(value) {
  if (!value || typeof value !== "string") return null;

  try {
    const parsed = new URL(value.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function absoluteUrl(value, baseUrl) {
  if (!value) return null;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickMeta($, names) {
  for (const name of names) {
    const value =
      $(`meta[property="${name}"]`).attr("content") ||
      $(`meta[name="${name}"]`).attr("content");

    if (cleanText(value)) return cleanText(value);
  }

  return "";
}

function extractArticleText($) {
  $("script, style, noscript, svg, iframe, nav, footer, header, aside, form").remove();

  const candidates = [
    "article",
    "main",
    '[role="main"]',
    ".article",
    ".post",
    ".story",
    ".content",
    "body"
  ];

  let bestText = "";

  for (const selector of candidates) {
    $(selector).each((_, element) => {
      const paragraphs = $(element)
        .find("p")
        .map((__, paragraph) => cleanText($(paragraph).text()))
        .get()
        .filter((text) => text.length >= 40);

      const text = paragraphs.join("\n\n");
      if (text.length > bestText.length) bestText = text;
    });
  }

  if (bestText.length >= 120) return bestText;

  return $("p")
    .map((_, paragraph) => cleanText($(paragraph).text()))
    .get()
    .filter((text) => text.length >= 40)
    .join("\n\n");
}

function extractImageUrl($, url) {
  const metaImage = pickMeta($, [
    "og:image:secure_url",
    "og:image:url",
    "og:image",
    "twitter:image:src",
    "twitter:image"
  ]);

  if (metaImage) return absoluteUrl(metaImage, url);

  const imageCandidates = $("article img, main img, [role='main'] img, body img")
    .map((_, image) => {
      const src =
        $(image).attr("src") ||
        $(image).attr("data-src") ||
        $(image).attr("data-original") ||
        $(image).attr("data-lazy-src");

      const width = Number($(image).attr("width")) || 0;
      const height = Number($(image).attr("height")) || 0;
      const score = width * height || 1;

      return { src: absoluteUrl(src, url), score };
    })
    .get()
    .filter((image) => image.src && !image.src.startsWith("data:"));

  imageCandidates.sort((a, b) => b.score - a.score);
  return imageCandidates[0]?.src || null;
}

async function scrapeArticleFromUrl(rawUrl) {
  const url = normalizeUrl(rawUrl);
  if (!url) {
    const err = new Error("Valid article URL required");
    err.statusCode = 400;
    throw err;
  }

  const response = await axios.get(url, {
    timeout: 15000,
    maxRedirects: 5,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      Accept: "text/html,application/xhtml+xml"
    }
  });

  const $ = cheerio.load(response.data);
  const parsedUrl = new URL(url);
  const title =
    pickMeta($, ["og:title", "twitter:title"]) ||
    cleanText($("h1").first().text()) ||
    cleanText($("title").text());
  const source =
    pickMeta($, ["og:site_name", "application-name"]) ||
    parsedUrl.hostname.replace(/^www\./, "");
  const description = pickMeta($, ["og:description", "twitter:description", "description"]);
  const text = extractArticleText($) || description;
  const imageUrl = extractImageUrl($, url);

  if (!text || text.length < 80) {
    const err = new Error("Could not extract enough article text from URL");
    err.statusCode = 422;
    throw err;
  }

  return {
    url,
    title,
    source,
    text,
    imageUrl
  };
}

module.exports = { scrapeArticleFromUrl };
