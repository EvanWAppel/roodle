/**
 * WORD-02: curated built-in word packs. Each pack is a category; each word is
 * tagged with a difficulty (easy / medium / hard) that is METADATA ONLY —
 * difficulty does NOT affect scoring (DECISIONS.md D5; still flat 1 point).
 *
 * NOTE: these pack CONTENTS are DRAFTS for Evan to confirm/adjust.
 */
import { eq } from 'drizzle-orm';
import type { DB } from './client';
import { packs, words, type Difficulty } from './schema';

export interface BuiltinWord {
  text: string;
  difficulty: Difficulty;
}
export interface BuiltinPackSpec {
  name: string;
  words: BuiltinWord[];
}

const w = (text: string, difficulty: Difficulty): BuiltinWord => ({
  text,
  difficulty,
});

export const BUILTIN_PACKS: BuiltinPackSpec[] = [
  {
    name: 'Animals',
    words: [
      w('cat', 'easy'),
      w('dog', 'easy'),
      w('fish', 'easy'),
      w('bird', 'easy'),
      w('snake', 'medium'),
      w('rabbit', 'medium'),
      w('elephant', 'medium'),
      w('octopus', 'hard'),
      w('platypus', 'hard'),
      w('chameleon', 'hard'),
    ],
  },
  {
    name: 'Food',
    words: [
      w('apple', 'easy'),
      w('banana', 'easy'),
      w('pizza', 'easy'),
      w('egg', 'easy'),
      w('burger', 'medium'),
      w('sandwich', 'medium'),
      w('spaghetti', 'medium'),
      w('croissant', 'hard'),
      w('sushi', 'hard'),
      w('lasagna', 'hard'),
    ],
  },
  {
    name: 'Around the House',
    words: [
      w('chair', 'easy'),
      w('clock', 'easy'),
      w('door', 'easy'),
      w('lamp', 'easy'),
      w('ladder', 'medium'),
      w('umbrella', 'medium'),
      w('toaster', 'medium'),
      w('chandelier', 'hard'),
      w('thermostat', 'hard'),
      w('vacuum', 'hard'),
    ],
  },
  {
    name: 'Nature',
    words: [
      w('sun', 'easy'),
      w('moon', 'easy'),
      w('tree', 'easy'),
      w('star', 'easy'),
      w('river', 'medium'),
      w('mountain', 'medium'),
      w('rainbow', 'medium'),
      w('volcano', 'hard'),
      w('glacier', 'hard'),
      w('waterfall', 'hard'),
    ],
  },
];

/**
 * Insert every built-in pack and its words if not already present. Idempotent
 * per pack name: a pack that already exists is skipped whole (packs and their
 * words are inserted together). Errors are never swallowed.
 */
export async function seedBuiltinPacks(db: DB): Promise<void> {
  for (const spec of BUILTIN_PACKS) {
    const [existing] = await db
      .select({ id: packs.id })
      .from(packs)
      .where(eq(packs.name, spec.name))
      .limit(1);
    if (existing) continue;

    const [pack] = await db
      .insert(packs)
      .values({ name: spec.name, isBuiltin: true })
      .returning();

    await db.insert(words).values(
      spec.words.map((word) => ({
        packId: pack.id,
        text: word.text,
        difficulty: word.difficulty,
      })),
    );
  }
}
