"use client";

import { useState } from "react";
import ProfileSection from "./ProfileSection";
import SectionsSection from "./SectionsSection";
import type { CvProfileData, CvSectionRow, CvStatus } from "./shared";

type TabId = "profile" | "sections";

const TABS: { id: TabId; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "sections", label: "Sections" },
];

export default function CvManager({
  profile,
  sections,
}: {
  profile: CvProfileData;
  sections: CvSectionRow[];
}) {
  const [active, setActive] = useState<TabId>("profile");
  const [status, setStatus] = useState<CvStatus>(null);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="text-2xl font-medium tracking-[-0.03em]">CV</h1>
      <p className="mt-2 text-sm text-black/50">
        The resume shown by the “Resume” tab on the site. It is standalone: it
        never reads from the projects, the about page or the settings.
      </p>

      <div
        role="tablist"
        aria-label="CV sections"
        className="mt-6 -mx-1 flex gap-1 overflow-x-auto pb-1"
      >
        {TABS.map((tab) => {
          const selected = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`cv-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`cv-panel-${tab.id}`}
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
          id="cv-panel-profile"
          aria-labelledby="cv-tab-profile"
          hidden={active !== "profile"}
        >
          <ProfileSection profile={profile} setStatus={setStatus} />
        </div>

        <div
          role="tabpanel"
          id="cv-panel-sections"
          aria-labelledby="cv-tab-sections"
          hidden={active !== "sections"}
        >
          <SectionsSection sections={sections} setStatus={setStatus} />
        </div>
      </div>
    </div>
  );
}
