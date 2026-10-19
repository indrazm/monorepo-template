import type { Review } from "@repo/contracts/notifications";

// Live review/stat providers (feedback T6/T7). Each fetcher talks to the
// documented public endpoint and maps the response to Tacto's shapes. They are
// only called when the matching credential is configured; the dashboard falls
// back to manual/CSV entry otherwise.

// Google Places API (New): Place Details with a `reviews` field mask.
// GET https://places.googleapis.com/v1/places/{placeId}
// Docs: https://developers.google.com/maps/documentation/places/web-service/place-details
export async function fetchGooglePlacesReviews(apiKey: string, placeId: string): Promise<Review[]> {
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "reviews",
      },
    },
  );
  if (!response.ok) throw new Error(`Google Places error ${response.status}`);
  const data = (await response.json()) as {
    reviews?: {
      rating?: number;
      text?: { text?: string };
      originalText?: { text?: string };
      authorAttribution?: { displayName?: string; photoUri?: string };
    }[];
  };
  return (data.reviews ?? [])
    .map((review) => ({
      author: review.authorAttribution?.displayName?.trim() || "Google user",
      rating: typeof review.rating === "number" ? Math.min(5, Math.max(0, review.rating)) : 5,
      text: (review.text?.text ?? review.originalText?.text ?? "").trim(),
      ...(review.authorAttribution?.photoUri
        ? { avatarUrl: review.authorAttribution.photoUri }
        : {}),
      source: "Google",
    }))
    .filter((review) => review.text.length > 0)
    .slice(0, 50);
}

// Facebook Graph API: a Page's ratings/recommendations.
// GET https://graph.facebook.com/v19.0/{pageId}/ratings
// Docs: https://developers.facebook.com/docs/graph-api/reference/page/ratings/
export async function fetchFacebookReviews(pageToken: string, pageId: string): Promise<Review[]> {
  const url = new URL(`https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}/ratings`);
  url.searchParams.set("fields", "reviewer{name,picture},rating,review_text,created_time");
  url.searchParams.set("access_token", pageToken);
  url.searchParams.set("limit", "50");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Facebook Graph error ${response.status}`);
  const data = (await response.json()) as {
    data?: {
      rating?: number;
      review_text?: string;
      reviewer?: { name?: string; picture?: { data?: { url?: string } } };
    }[];
  };
  return (data.data ?? [])
    .map((review) => ({
      author: review.reviewer?.name?.trim() || "Facebook user",
      rating: typeof review.rating === "number" ? Math.min(5, Math.max(0, review.rating)) : 5,
      text: (review.review_text ?? "").trim(),
      ...(review.reviewer?.picture?.data?.url
        ? { avatarUrl: review.reviewer.picture.data.url }
        : {}),
      source: "Facebook",
    }))
    .filter((review) => review.text.length > 0)
    .slice(0, 50);
}

// YouTube Data API v3: channel statistics.
// GET https://www.googleapis.com/youtube/v3/channels?part=statistics&id={id}
// Docs: https://developers.google.com/youtube/v3/docs/channels/list
export async function fetchYoutubeStat(
  apiKey: string,
  channelId: string,
  metric: "subscribers" | "views",
): Promise<number | null> {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "statistics");
  url.searchParams.set("id", channelId);
  url.searchParams.set("key", apiKey);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`YouTube API error ${response.status}`);
  const data = (await response.json()) as {
    items?: { statistics?: { subscriberCount?: string; viewCount?: string } }[];
  };
  const stats = data.items?.[0]?.statistics;
  if (!stats) return null;
  const raw = metric === "views" ? stats.viewCount : stats.subscriberCount;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
