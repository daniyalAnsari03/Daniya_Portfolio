import type { ReactNode } from "react";
import PageTransition from "@/components/PageTransition";
import SiteHeader from "@/components/SiteHeader";
import Nav from "@/components/Nav";
import EdgeTabs from "@/components/EdgeTabs";
import ContactPopupProvider from "@/components/contact/ContactPopupProvider";
import { WorksPopupProvider } from "@/components/works/WorksPopupProvider";
import { getPublicSettings } from "@/lib/settings";
import { getPublishedCv } from "@/lib/cv";
import CvProvider from "@/components/cv/CvProvider";
import ResumeTab from "@/components/cv/ResumeTab";
import ChatProvider from "@/components/chat/ChatProvider";
import AskAiTab from "@/components/chat/AskAiTab";

/**
 * Shared layout for every public page (Home / Works / About). It owns the
 * fixed chrome — top header (logo + contact) and the bottom nav pill — plus
 * the contact popup and the rise-over page transition. All of it lives OUTSIDE
 * the transitioning page content, so it stays fixed and mounted while the pages
 * swap underneath.
 *
 * `/admin` sits outside this group and is untouched by any of it.
 */
export default async function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [settings, cv] = await Promise.all([getPublicSettings(), getPublishedCv()]);

  return (
    <ContactPopupProvider settings={settings}>
      {/* Works popup state is lifted here so the shared nav pill can hide
          itself while a project sheet is open. */}
      <WorksPopupProvider>
        <CvProvider cv={cv}>
          <ChatProvider>
            {/* The right-edge tabs live OUTSIDE PageTransition: they are fixed
                chrome that must never be transformed by a page transition.
                The stack is centred as a whole, so the Ask AI tab sits
                directly under the Resume tab. */}
            <EdgeTabs>
              <ResumeTab />
              <AskAiTab />
            </EdgeTabs>
            {/* New page rises over the old one on Home / Works / About navigations. */}
            <PageTransition>{children}</PageTransition>

            {/* Fixed chrome — never animates with the pages. */}
            <SiteHeader />
            <Nav />
          </ChatProvider>
        </CvProvider>
      </WorksPopupProvider>
    </ContactPopupProvider>
  );
}
