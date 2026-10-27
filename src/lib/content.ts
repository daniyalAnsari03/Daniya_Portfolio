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

  // The right-edge "Resume" tab and the CV drawer it opens. The content
  // itself comes from the database (the CV tables), never from here.
  resume: {
    tabLabel: "Resume",
    openLabel: "Open resume",
    closeLabel: "Close resume",
    title: "Resume",
    downloadLabel: "Download PDF",
    emptyLabel: "No resume yet.",
  },

  // The right-edge "Ask AI" tab and the chat drawer it opens. The reply comes
  // from POST /api/chat through src/lib/chat/chat-client.ts. The wording is
  // deliberately generic: nothing here claims anything about Daniyal beyond
  // the site itself.
  askAi: {
    tabLabel: "Ask AI",
    openLabel: "Open Ask AI",
    closeLabel: "Close Ask AI",
    title: "Ask AI",
    voiceTitle: "Voice",
    subtitle: "About Daniyal's work only",
    newChatLabel: "New chat",
    soundOnLabel: "Voice replies on",
    soundOffLabel: "Voice replies off",
    themeLabel: "Theme",
    themeMenuLabel: "Chat theme",
    voiceRepliesLabel: "Voice replies",
    copyLabel: "Copy message",
    copiedLabel: "Copied",
    speakLabel: "Read aloud",
    stopSpeakingLabel: "Stop reading",
    micLabel: "Dictate",
    waveLabel: "Voice mode",
    sendLabel: "Send",
    keyboardLabel: "Back to text chat",
    stopLabel: "Stop listening",
    talkLabel: "Tap to talk",
    placeholder: "Ask about the work…",
    assistantLabel: "Ask AI",
    thinkingLabel: "Thinking…",
    // The live "agent steps" shown while the bot is thinking.
    steps: {
      routingChip: "Router",
      routing: "Reading your question",
      handoff: "Passed to the {agent} agent",
      agentChip: "{agent} agent",
      lookup: {
        projects: "Checking his projects",
        project_detail: "Opening that project",
        cv: "Reading his CV",
        about: "Reading his About details",
        contact: "Finding his contact details",
        notes: "Checking extra notes",
      },
      writing: "Writing the answer",
      summaryChain: "{chain} · {count} handoff",
      summaryChainPlural: "{chain} · {count} handoffs",
      summaryDirect: "Router · answered directly",
      showLabel: "Show agent steps",
      hideLabel: "Hide agent steps",
    },
    savedNote: "Conversations are saved",
    // The in-chat contact form card (ContactFormCard). It is opened by the
    // Contact agent's `show_contact_form` signal and submits through the SAME
    // server-side path the Contact popup uses (src/lib/contact/actions.ts).
    contactForm: {
      emailLabel: "Email",
      emailPlaceholder: "you@example.com",
      messageLabel: "Message",
      messagePlaceholder: "Tell me about your project…",
      submit: "Send",
      sending: "Sending…",
      success: "Message sent. Daniyal will see it soon.",
      networkError:
        "Couldn't send the message. Please check your connection and try again.",
    },
    errors: {
      rateLimited:
        "You've sent a lot of messages in a short time. Please try again in about {minutes} minute(s).",
      network:
        "Couldn't reach the server. Please check your connection and try again.",
      server: "Something went wrong on my side. Please try again in a moment.",
      invalid:
        "That message couldn't be sent. Please shorten it and try again.",
    },
    heading: {
      line1: "Ask me",
      line2: "anything",
      line3: "about Daniyal",
    },
    suggestions: [
      { number: "01", text: "What has he built?" },
      { number: "02", text: "Which tools does he use?" },
      { number: "03", text: "How can I contact him?" },
    ],
    themes: [
      { id: "light", label: "Light" },
      { id: "dark", label: "Dark" },
      { id: "gray", label: "Soft gray" },
    ],
    voiceStatus: {
      idle: "Tap to talk",
      listening: "Listening…",
      thinking: "Thinking…",
      speaking: "Speaking…",
    },
    voiceErrors: {
      blocked: "Microphone access was blocked",
      failed: "Voice input stopped unexpectedly",
      unsupported: "Voice input isn't supported in this browser",
    },
  },

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
