"use client";

import { useState } from "react";
import HeroSection from "./HeroSection";
import CoverSection from "./CoverSection";
import WorksSection from "./WorksSection";
import ContactSection from "./ContactSection";
import type {
  HomepageCardRow,
  HomepageContentData,
  HomepageStatus,
} from "./shared";

type TabId = "hero" | "cover" | "works" | "contact";

const TABS: { id: TabId; label: string }[] = [
  { id: "hero", label: "Hero" },
  { id: "cover", label: "Cover" },
  { id: "works", label: "Works cards" },
  { id: "contact", label: "Contact" },
];

export default function HomepageManager({
  content,
  cards,
}: {
  content: HomepageContentData;
  cards: HomepageCardRow[];
}) {
  const [active, setActive] = useState<TabId>("hero");
  const [data, setData] = useState<HomepageContentData>(content);
  const [status, setStatus] = useState<HomepageStatus>(null);

  function update(key: keyof HomepageContentData, value: string) {
    setStatus(null);
    setData((prev) => ({ ...prev, [key]: value }));
  }

  const shared = {
    data,
    update,
    setStatus,
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="text-2xl font-medium tracking-[-0.03em]">Homepage</h1>
      <p className="mt-2 text-sm text-black/50">
        Everything the homepage shows: the hero, the cover, the works row and
        the contact heading. While the database is empty the page keeps its
        current copy.
      </p>

      <div
        role="tablist"
        aria-label="Homepage sections"
        className="mt-6 -mx-1 flex gap-1 overflow-x-auto pb-1"
      >
        {TABS.map((tab) => {
          const selected = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`homepage-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`homepage-panel-${tab.id}`}
              onClick={() => setActive(tab.id)}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                selected
                  ? "bg-charcoal text-white"
                  : "text-black/55 hover:bg-black/5"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {status && (
        <p
          role="status"
          className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
            status.status === "error"
              ? "border-accent/30 bg-accent/5 text-accent"
              : "border-green-700/20 bg-green-700/5 text-green-700"
          }`}
        >
          {status.message}
        </p>
      )}

      <div className="mt-6 space-y-6">
        <div
          role="tabpanel"
          id="homepage-panel-hero"
          aria-labelledby="homepage-tab-hero"
          hidden={active !== "hero"}
        >
          <HeroSection {...shared} />
        </div>

        <div
          role="tabpanel"
          id="homepage-panel-cover"
          aria-labelledby="homepage-tab-cover"
          hidden={active !== "cover"}
        >
          <CoverSection {...shared} />
        </div>

        <div
          role="tabpanel"
          id="homepage-panel-works"
          aria-labelledby="homepage-tab-works"
          hidden={active !== "works"}
        >
          <WorksSection {...shared} cards={cards} />
        </div>

        <div
          role="tabpanel"
          id="homepage-panel-contact"
          aria-labelledby="homepage-tab-contact"
          hidden={active !== "contact"}
        >
          <ContactSection {...shared} />
        </div>
      </div>
    </div>
  );
}
