import { Suspense } from "react";
import type { Metadata } from "next";
import SettingsForm from "@/components/admin/SettingsForm";
import { getAdminSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Settings",
};

async function SettingsContent() {
  const settings = await getAdminSettings();
  return <SettingsForm initial={settings} />;
}

function SettingsSkeleton() {
  return (
    <div className="mt-8 space-y-6" aria-hidden="true">
      {[0, 1, 2].map((section) => (
        <div
          key={section}
          className="h-40 animate-pulse rounded-2xl border border-black/10 bg-white"
        />
      ))}
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-medium tracking-[-0.03em]">Settings</h1>
      <p className="mt-2 text-sm text-black/50">
        Public site details and who can access the admin.
      </p>
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}
