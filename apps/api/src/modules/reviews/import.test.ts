import { describe, expect, it } from "vitest";
import { parseGoogleReviews } from "./import";

describe("review parsers", () => {
  it("parses Google Places reviews (first name, rating, dedupe)", () => {
    const json = {
      result: {
        reviews: [
          { author_name: "Mike Jones", rating: 5, text: "Great!", time: 1_700_000_000 },
          { author_name: "Ana", rating: 4, text: "Good", time: 1_700_000_100 },
        ],
      },
    };
    const reviews = parseGoogleReviews(json, "place-1");
    expect(reviews).toHaveLength(2);
    expect(reviews[0]?.authorName).toBe("Mike");
    expect(reviews[0]?.rating).toBe(5);
    expect(reviews[0]?.dedupeKey).toBe("google:place-1:1700000000:Mike");
    expect(reviews[0]?.occurredAt).toBeInstanceOf(Date);
  });

  it("tolerates missing/empty fields", () => {
    expect(parseGoogleReviews({}, "x")).toEqual([]);
  });
});
