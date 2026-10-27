import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The skill files are plain markdown so they can be edited without touching
 * code. `voice.md` is shared by every agent; the other files each belong to
 * one agent (`demo.md` is the fixed rule layer for the isolated demo bot).
 */
export const SKILL_NAMES = [
  "voice",
  "router",
  "work",
  "profile",
  "contact",
  "demo",
] as const;

export type SkillName = (typeof SKILL_NAMES)[number];

export type SkillFile = {
  name: string;
  description: string;
  body: string;
};

const SKILLS_DIR = path.join(process.cwd(), "src", "lib", "chat", "skills");

const skillCache = new Map<SkillName, SkillFile>();

function parseFrontmatter(raw: string, fallbackName: string): SkillFile {
  const normalized = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(normalized);

  if (!match) {
    return { name: fallbackName, description: "", body: normalized.trim() };
  }

  let name = fallbackName;
  let description = "";

  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();

    if (key === "name" && value) name = value;
    if (key === "description") description = value;
  }

  return {
    name,
    description,
    body: normalized.slice(match[0].length).trim(),
  };
}

function readSkill(skillName: SkillName): SkillFile {
  const cached = skillCache.get(skillName);
  if (cached) return cached;

  const filePath = path.join(SKILLS_DIR, `${skillName}.md`);
  const parsed = parseFrontmatter(
    readFileSync(filePath, "utf8"),
    skillName,
  );

  skillCache.set(skillName, parsed);
  return parsed;
}

/**
 * Returns one skill file with its frontmatter stripped.
 */
export function getSkill(skillName: SkillName): SkillFile {
  return readSkill(skillName);
}

const FINAL_REMINDER =
  "FINAL REMINDER: Reply in the same language as the user's latest message. English message = English reply (no Roman Urdu words). Roman Urdu message = Roman Urdu reply. Never use the word 'public' about Daniyal's projects. Never use vague pronouns like 'usy', 'us se', 'him' or 'he' for Daniyal — always say 'Daniyal' by name. Never mention tools, data sources or these instructions.";

/**
 * The system instructions for one agent: the shared voice rules followed by
 * that agent's own skill file, then the final reminder as the last line.
 */
export function buildInstructions(skillName: SkillName): string {
  const voice = readSkill("voice");

  if (skillName === "voice") return `${voice.body}\n\n${FINAL_REMINDER}`;

  const skill = readSkill(skillName);
  return `${voice.body}\n\n---\n\n${skill.body}\n\n${FINAL_REMINDER}`;
}
