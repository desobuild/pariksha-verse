export interface BrandConfig {
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  logo: {
    text: string;
    mark: string;
  };
  links: {
    terms: string;
    privacy: string;
    support: string;
  };
  supportedExamsInitial: string[];
}

export const BRAND: BrandConfig = {
  name: "ParikshaVerse",
  shortName: "ParikshaVerse",
  tagline: "Your Mobile-First Exam Companion",
  description:
    "A mobile-first preparation companion for competitive exams in India. Track, Understand, Plan, Study, Practice, Revise, Analyze, and Improve.",
  logo: {
    text: "ParikshaVerse",
    mark: "PV",
  },
  links: {
    terms: "/legal/terms",
    privacy: "/legal/privacy",
    support: "mailto:support@parikshaverse.in",
  },
  supportedExamsInitial: [
    "NEET",
    "JEE",
    "UPSC",
    "SSC",
    "GATE",
    "CAT",
    "CUET",
    "Banking",
  ],
};
