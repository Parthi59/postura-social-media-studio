export type PlatformKey =
  | "discord"
  | "mastodon";

export type ConstraintProfile = {
  platform: PlatformKey;
  maxLength: number;
  maxHashtags: number;
  tone: string;
  toneRules: string[];
};

export const CONSTRAINT_PROFILES: Record<PlatformKey, ConstraintProfile> = {
  discord: {
    platform: "discord",
    maxLength: 2000,
    maxHashtags: 5,
    tone: "Conversational, community-oriented, natural.",
    toneRules: [
      "Do not use more than two consecutive exclamation marks.",
      "Do not write the entire message in uppercase."
    ]
  },
  mastodon: {
    platform: "mastodon",
    maxLength: 500,
    maxHashtags: 5,
    tone: "Concise, direct, platform-aware.",
    toneRules: [
      "Do not use more than two consecutive exclamation marks.",
      "Do not write the entire message in uppercase."
    ]
  }
};

function countHashtags(content: string) {
  return (content.match(/(^|\s)#[\p{L}\p{N}_-]+/gu) ?? []).length;
}

function isEntirelyUppercase(content: string) {
  const letters = content.replace(/[^A-Za-z]/g, "");
  if (letters.length < 12) return false;
  return letters === letters.toUpperCase();
}

export function validatePlatformContent(
  platform: PlatformKey,
  content: string
) {
  const profile = CONSTRAINT_PROFILES[platform];
  const violations: Array<{
    rule: "length" | "hashtags" | "tone";
    message: string;
  }> = [];

  if (content.length < 1 || content.length > profile.maxLength) {
    violations.push({
      rule: "length",
      message: `${platform} length rule failed: expected 1-${profile.maxLength} characters, received ${content.length}.`
    });
  }

  const hashtagCount = countHashtags(content);
  if (hashtagCount > profile.maxHashtags) {
    violations.push({
      rule: "hashtags",
      message: `${platform} hashtag rule failed: maximum ${profile.maxHashtags}, received ${hashtagCount}.`
    });
  }

  if (/!{3,}/.test(content)) {
    violations.push({
      rule: "tone",
      message: `${platform} tone rule failed: more than two consecutive exclamation marks are not allowed.`
    });
  }

  if (isEntirelyUppercase(content)) {
    violations.push({
      rule: "tone",
      message: `${platform} tone rule failed: the entire message cannot be uppercase.`
    });
  }

  return {
    valid: violations.length === 0,
    profile,
    hashtagCount,
    violations
  };
}
