// Fetch + parse reviews from Google Places (SRS FR-ING-10).
// Parsers are pure so they can be unit-tested without network access.

export type NormalizedReview = {
  authorName: string | null;
  rating: number | null;
  text: string | null;
  occurredAt: Date;
  dedupeKey: string;
};

function firstName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim().split(/\s+/)[0] || null;
}

// ---------- Google Places: place details `reviews` ----------
export function parseGoogleReviews(json: unknown, placeId: string): NormalizedReview[] {
  const result = (json as { result?: { reviews?: unknown[] } })?.result;
  const reviews = Array.isArray(result?.reviews) ? result.reviews : [];
  return reviews.map((raw) => {
    const r = (raw ?? {}) as { author_name?: unknown; rating?: unknown; text?: unknown; time?: unknown };
    const time = typeof r.time === "number" ? r.time : 0;
    return {
      authorName: firstName(r.author_name),
      rating: typeof r.rating === "number" ? r.rating : null,
      text: typeof r.text === "string" ? r.text.slice(0, 500) : null,
      occurredAt: time ? new Date(time * 1000) : new Date(),
      dedupeKey: `google:${placeId}:${time}:${firstName(r.author_name) ?? ""}`,
    };
  });
}

export async function fetchGoogleReviews(
  apiKey: string,
  placeId: string,
): Promise<NormalizedReview[]> {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
    placeId,
  )}&fields=reviews&key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google Places error: ${response.status}`);
  return parseGoogleReviews(await response.json(), placeId);
}
