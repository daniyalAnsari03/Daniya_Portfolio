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
        order: "Checking order…",
        stock: "Checking stock…",
      },
      writing: "Writing the answer",
      summaryChain: "{chain} · {count} handoff",
      summaryChainPlural: "{chain} · {count} handoffs",
      summaryDirect: "Router · answered directly",
      showLabel: "Show agent steps",
      hideLabel: "Hide agent steps",
    },
    savedNote: "Conversations are saved",
    // The "Live demo mode" inside the same drawer (docs/fix.txt). A visitor
    // sets up a small bot (name, instructions, pasted context) and chats with
    // it — it answers ONLY from that context, through POST /api/chat/demo.
    // Fully isolated: no tools, no MCP, no session, nothing saved. Fixed copy
    // — never admin-managed.
    demo: {
      openingRow: "Try a demo project",
      badge: "Demo",
      setup: {
        title: "Set up your demo",
        helper:
          "Build a small assistant in a minute. It will answer only from the context you give.",
        nameLabel: "Name",
        namePlaceholder: "Ali Store Assistant",
        instructionsLabel: "Instructions",
        contextLabel: "Paste your text",
        contextHelper: "Product info, FAQ, policies…",
        defaultInstructions:
          "You are a customer help assistant for [Name]. Answer only from the given context. If the answer is not in the context, say you do not have it. Keep answers short and friendly. Reply in the language the user writes in.",
        startLabel: "Start demo",
        backLabel: "Back",
        truncatedNotice: "Text was cut to {max} characters.",
        limitReached: "Limit reached: {max} characters. Extra text was not added.",
        charCounter: "{count} / {max}",
        // The two context options in the setup screen (docs/fix.txt): the
        // usual paste textarea or a PDF whose text is extracted server-side
        // (POST /api/chat/demo/extract) and pasted into the same textarea.
        contextOptionsLabel: "Context source",
        contextOptionPaste: "Paste text",
        contextOptionPdf: "Upload PDF",
        pdfHelper: "Text-based PDFs only, up to 4 MB.",
        pdfChoose: "Choose PDF",
        pdfLoading: "Extracting text…",
        pdfRemove: "Remove",
        extractErrors: {
          tooLarge: "That PDF is larger than 4 MB.",
          invalidFile: "That file isn't a text PDF.",
          unreadable:
            "That PDF couldn't be read. Is it password protected or damaged?",
          noText: "No text found — scanned PDFs do not work.",
        },
      },
      chatIntro: "Ask your demo assistant something from your context.",
      note: "Demo chats are not saved.",
      errors: {
        // Both lines are filled by formatRateLimitLine (src/lib/chat/rate-limit-text.ts):
        // {minutes} becomes "1 minute" / "N minutes"; under 60 seconds the
        // `rateLimitedSoon` line is used instead.
        rateLimited:
          "You have reached the demo message limit for now. Please try again in about {minutes}.",
        rateLimitedSoon:
          "You have reached the demo message limit for now. Please try again in less than a minute.",
        network:
          "Couldn't reach the server. Please check your connection and try again.",
        server: "Something went wrong. Please try again in a moment.",
        invalid: "That message couldn't be sent. Please shorten it and try again.",
      },
    },
    // The "Store demo" mode inside the same drawer (docs/fix.txt). The
    // visitor taps the row and chats immediately with a fake store's support
    // assistant that answers only from two local tools over hardcoded data,
    // through POST /api/chat/demo-store. Fully isolated: no setup, no MCP,
    // no session, nothing saved. Fixed copy — never admin-managed.
    storeDemo: {
      openingRow: "Try the store demo",
      headerTitle: "Demo Store",
      title: "Demo Store",
      // The normal-view (non-WhatsApp) input placeholder for this mode only —
      // the main chat, the paste/PDF demo and the WhatsApp skin are untouched.
      inputPlaceholder: "Ask about an order or a product...",
      // The static first assistant message (no API call behind it).
      intro:
        "Hi! This is a demo store. Ask me about an order number or a product and I will check the store data for you.",
      chatIntro: "Tap a suggestion below to start the store chat.",
      starterTitle: "Try this",
      starterOrdersLabel: "Orders",
      starterProductsLabel: "Products",
      starterChips: [
        "Where is my order 1024?",
        "Is the Hoodie in stock?",
        "Do you have Sneakers?",
      ],
      steps: {
        chip: "Store",
        writing: "Writing answer",
        summaryTool: "{agent} · {count} tool",
        summaryTools: "{agent} · {count} tools",
        summaryDirect: "Store agent · answered directly",
      },
    },
    // The "View on WhatsApp" skin (docs/fix.txt). An in-memory visual toggle
    // for the demo-like modes only — the visitor, the normal chat and the
    // Store demo's data are untouched. Fixed copy — never admin-managed.
    whatsapp: {
      toggleOn: "View on WhatsApp",
      toggleOff: "Back to normal view",
      online: "online",
      typing: "typing…",
      note: "Demo: not connected to real WhatsApp",
      inputPlaceholder: "Type a message",
    },
    // The in-chat "Discovery form" wizard (ContactFormCard). It is opened by
    // the Contact agent's `show_contact_form` signal and submits through
    // submitChatDiscoveryMessage (src/lib/contact/actions.ts). Fixed copy —
    // never admin-managed. The choice values themselves live in
    // src/lib/contact/discovery.ts so the client and server stay in sync.
    discovery: {
      progress: "{current}/{total}",
      nextLabel: "Next",
      backLabel: "Back",
      sendLabel: "Send",
      sendingLabel: "Sending…",
      success: "Message sent. Daniyal will see it soon.",
      errors: {
        rateLimited: "Too many messages sent. Please try again later.",
        network:
          "Couldn't send the message. Please check your connection and try again.",
        invalid: "Please check your answers and try again.",
      },
      steps: {
        type: {
          question: "What do you want to build?",
          otherPlaceholder: "Tell me what you have in mind…",
        },
        business: {
          question: "What is your business or work?",
          placeholder:
            "For example: a cafe, a design studio, a personal brand…",
        },
        need: {
          placeholder: "Write a few lines…",
          questions: {
            "Simple website":
              "How many pages do you need and what should they show? (for example Home, About, Contact)",
            "E-commerce store":
              "How many products do you have, and how do you want payment and delivery to work?",
            "AI chatbot or agent":
              "What questions should it answer, and where should it live (website, WhatsApp)?",
            "Web app or dashboard":
              "Who will use it, and what is the most important thing it must do?",
            "Something else": "Describe what you need in a few lines.",
          },
        },
        time: {
          question: "When do you need it?",
          extraLabel: "Anything else?",
          extraPlaceholder: "Optional — anything else Daniyal should know.",
        },
        email: {
          question: "Your email",
          emailPlaceholder: "you@example.com",
        },
      },
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
