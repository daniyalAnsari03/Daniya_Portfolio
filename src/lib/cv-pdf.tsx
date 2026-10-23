import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { CvDocument } from "@/lib/cv-shared";
import { cvBullets, cvContactItems } from "@/lib/cv-shared";
import { CV_TAG, getPublishedCv } from "@/lib/cv";

/**
 * The PDF colours — the single place where the design tokens are translated
 * into fixed values (the PDF renderer knows no CSS variables). They mirror
 * `--background`, `--foreground`, `--charcoal` / `--accent` and the muted
 * mixes of the foreground on the background.
 */
const PDF_COLORS = {
  /** `--background` */
  background: "#E8E8E8",
  /** `--foreground` */
  foreground: "#111111",
  /** `--charcoal` / `--accent` */
  charcoal: "#333333",
  /** the foreground at 75% on the background */
  body: "#474747",
  /** the foreground at 60% on the background */
  muted: "#676767",
  /** the foreground at 45% on the background */
  subtle: "#878787",
  /** the rule between two blocks */
  rule: "#CFCFCF",
} as const;

/** The built-in PDF fonts — nothing is fetched or registered. */
const FONT = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";

const styles = StyleSheet.create({
  page: {
    backgroundColor: PDF_COLORS.background,
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 52,
    fontFamily: FONT,
    color: PDF_COLORS.foreground,
  },
  header: {
    marginBottom: 4,
  },
  name: {
    fontFamily: FONT_BOLD,
    fontSize: 22,
    letterSpacing: -0.4,
    color: PDF_COLORS.foreground,
  },
  headline: {
    marginTop: 5,
    fontSize: 11,
    color: PDF_COLORS.muted,
  },
  contactRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  contactItem: {
    fontSize: 9,
    color: PDF_COLORS.muted,
  },
  summary: {
    marginTop: 12,
    fontSize: 10,
    lineHeight: 1.6,
    color: PDF_COLORS.body,
  },
  section: {
    marginTop: 26,
  },
  sectionTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 3,
    color: PDF_COLORS.subtle,
  },
  sectionRule: {
    marginTop: 6,
    height: 0.6,
    backgroundColor: PDF_COLORS.rule,
  },
  entry: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 0.6,
    borderTopColor: PDF_COLORS.rule,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  entryTitleBlock: {
    flex: 1,
  },
  entryTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 11,
    color: PDF_COLORS.foreground,
  },
  entrySubtitle: {
    marginTop: 2,
    fontSize: 10,
    color: PDF_COLORS.muted,
  },
  entryPeriod: {
    fontSize: 9,
    color: PDF_COLORS.subtle,
    textAlign: "right",
  },
  bullets: {
    marginTop: 7,
    gap: 4,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 8,
  },
  bulletDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: PDF_COLORS.subtle,
    marginTop: 5,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.6,
    color: PDF_COLORS.body,
  },
});

export function CvPdfDocument({ cv }: { cv: CvDocument }) {
  const { profile, sections } = cv;
  const contactItems = cvContactItems(profile);

  return (
    <Document
      author={profile.fullName || undefined}
      title={profile.fullName ? `${profile.fullName} - Resume` : "Resume"}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {profile.fullName ? (
            <Text style={styles.name}>{profile.fullName}</Text>
          ) : null}
          {profile.headline ? (
            <Text style={styles.headline}>{profile.headline}</Text>
          ) : null}
          {contactItems.length > 0 ? (
            <View style={styles.contactRow}>
              {contactItems.map((item) => (
                <Text key={item} style={styles.contactItem}>
                  {item}
                </Text>
              ))}
            </View>
          ) : null}
          {profile.summary ? (
            <Text style={styles.summary}>{profile.summary}</Text>
          ) : null}
        </View>

        {sections.map((section) => (
          <View key={section.id} style={styles.section}>
            {/* The heading never stays alone at the bottom of a page: the
                first entry has to fit with it. */}
            <Text style={styles.sectionTitle} minPresenceAhead={80}>
              {section.title}
            </Text>
            <View style={styles.sectionRule} />

            {section.entries.map((entry) => {
              const bullets = cvBullets(entry.description);
              return (
                <View key={entry.id} style={styles.entry} minPresenceAhead={60}>
                  {/* The header of an entry is never split over a page. */}
                  <View style={styles.entryHeader} wrap={false}>
                    <View style={styles.entryTitleBlock}>
                      {entry.title ? (
                        <Text style={styles.entryTitle}>{entry.title}</Text>
                      ) : null}
                      {entry.subtitle ? (
                        <Text style={styles.entrySubtitle}>
                          {entry.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    {entry.period ? (
                      <Text style={styles.entryPeriod}>{entry.period}</Text>
                    ) : null}
                  </View>

                  {bullets.length > 0 ? (
                    <View style={styles.bullets}>
                      {bullets.map((bullet, index) => (
                        <View key={index} style={styles.bulletRow}>
                          <View style={styles.bulletDot} />
                          <Text style={styles.bulletText}>{bullet}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
}

/**
 * The published CV, cached with the CV tag — the same read the site uses, so
 * the PDF and the drawer can never disagree.
 */
export async function getCachedCvForPdf(): Promise<CvDocument | null> {
  "use cache";
  cacheLife("max");
  cacheTag(CV_TAG);

  return getPublishedCv();
}

/**
 * The rendered PDF, cached with the CV tag: the file is only generated again
 * after the CV changed in the admin. It is returned base64 encoded, because
 * that is what a cache entry can hold.
 */
export async function renderCvPdf(cv: CvDocument): Promise<string> {
  "use cache";
  cacheLife("max");
  cacheTag(CV_TAG);

  const buffer = await renderToBuffer(<CvPdfDocument cv={cv} />);
  return Buffer.from(buffer).toString("base64");
}
