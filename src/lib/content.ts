export type SocialLink = {
  label: string;
  href: string;
  icon: "github" | "linkedin";
};

export type NavItem = {
  label: string;
  /** Section id used for in-page scrolling on the homepage. */
  target: string;
  /** Route used when the target section is not on the current page. */
  href: string;
};

export type WorkImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
};

export const content = {
  name: "Daniyal Portfolio",

  headline: {
    line1: "Full-Stack AI",
    line2: "Developer",
  },

  subtitle: "building web apps and AI agents",

  photo: {
    src: "/ai.png",
    alt: "Portrait of Daniyal",
    width: 1086,
    height: 1448,
  },

  contact: {
    label: "Contact",
    target: "contact",
    heading: {
      line1: "Let's work",
      line2: "together",
    },
    emailLabel: "Drop me an email:",
    email: "dinsbydaniyal@gmail.com",
    copyright: "©2026",

    // Copy for the contact popup (opened by the hero's top-right Contact pill).
    popup: {
      heading: "Let's work together",
      emailFieldLabel: "Your email",
      emailPlaceholder: "you@example.com",
      messageFieldLabel: "Message",
      messagePlaceholder: "Tell me about your project…",
      submit: "Send message",
      sending: "Sending…",
      successTitle: "Message sent",
      successBody: "Thanks for reaching out — I'll get back to you soon.",
      detailsTitle: "Contact details",
      socialsTitle: "Socials",
      copyLabel: "Copy email address",
      copiedLabel: "Copied",
      closeLabel: "Close",
    },
  },

  nav: [
    { label: "Home", target: "home", href: "/" },
    { label: "Works", target: "works", href: "/works" },
    { label: "About", target: "about", href: "/about" },
  ] satisfies NavItem[],

  social: [
    { label: "GitHub", href: "#", icon: "github" },
    { label: "LinkedIn", href: "#", icon: "linkedin" },
  ] satisfies SocialLink[],

  cover: {
    label: "Web developer / AI engineer",
    heading: {
      line1: "Web apps that work.",
      line2: "Agents that think.",
    },
    closing: "Full-stack apps and AI agents – designed, built and shipped end to end.",
    pillText: "MY WORK",
  },

  // Public /works page (Phase 3b). The project list itself comes from
  // getProjects(); only the static copy lives here.
  worksPage: {
    heading: "Selected works",
    empty: "Projects coming soon.",
    // Copy for the project detail popup (Phase 3c).
    popup: {
      detailsLabel: "Project",
      techLabel: "Tech stack",
      demoLabel: "Live demo",
      galleryLabel: "Gallery",
      closeLabel: "Close project",
    },
  },

  // Public /about page. All headings/labels live here; the actual hero,
  // intro, services, skills and education content comes from the database.
  aboutPage: {
    meta: {
      title: "About",
      description:
        "About — background, what I can help with, tools I work with and where I studied.",
    },
    intro: {
      locationLabel: "Location",
      emailLabel: "Email",
      phoneLabel: "Phone",
    },
    services: {
      label: "Services",
      heading: "What I can help with",
    },
    skills: {
      label: "Skills",
      heading: "Tools I work with",
    },
    education: {
      label: "Education",
      heading: "Where I studied",
    },
  },

  works: {
    heading: "Recent works",
    // 10 cards, alternating portrait / landscape starting with portrait.
    images: [
      {
        src: "/works/work-01.jpg",
        width: 800,
        height: 1200,
        alt: "Hand holding a phone showing a food ordering app",
      },
      {
        src: "/works/work-02.jpg",
        width: 1200,
        height: 800,
        alt: "Modern desk setup with a keyboard and a monitor",
      },
      {
        src: "/works/work-03.jpg",
        width: 800,
        height: 1200,
        alt: "Hand holding a phone with a blank mockup screen",
      },
      {
        src: "/works/work-04.jpg",
        width: 1200,
        height: 800,
        alt: "Laptop open on a wooden table",
      },
      {
        src: "/works/work-05.jpg",
        width: 900,
        height: 1200,
        alt: "Tablet mockup lying on a table",
      },
      {
        src: "/works/work-06.jpg",
        width: 1200,
        height: 799,
        alt: "Desk with a computer and a laptop side by side",
      },
      {
        src: "/works/work-07.jpg",
        width: 900,
        height: 1200,
        alt: "Tablet resting on a couch",
      },
      {
        src: "/works/work-08.jpg",
        width: 1200,
        height: 800,
        alt: "Two monitors set up on a designer's desk",
      },
      {
        src: "/works/work-09.jpg",
        width: 941,
        height: 1200,
        alt: "Laptop displaying a website design",
      },
      {
        src: "/works/work-10.jpg",
        width: 1200,
        height: 789,
        alt: "Laptop on a minimal desk",
      },
    ] satisfies WorkImage[],
  },
} as const;
