/**
 * Curated built-in word packs (WORD-02). These are ownerless (ownerId=null),
 * isBuiltin=true packs seeded once so every game has words to draw from without
 * a user creating a custom pack. Seeding is idempotent per pack name: a pack
 * already present (by name, built-in) is left untouched.
 */
import { and, eq, isNull } from 'drizzle-orm';
import type { DB } from './client';
import { packs, type Difficulty } from './schema';
import { createPack, type WordInput } from './packs';

export interface BuiltinPackSpec {
  name: string;
  words: WordInput[];
}

const w = (text: string, difficulty: Difficulty): WordInput => ({ text, difficulty });

/** The curated built-in packs. A few categories, mixed difficulty. */
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
      w('octopus', 'hard'),
      w('platypus', 'hard'),
    ],
  },
  {
    name: 'Around the House',
    words: [
      w('chair', 'easy'),
      w('clock', 'easy'),
      w('lamp', 'easy'),
      w('ladder', 'medium'),
      w('umbrella', 'medium'),
      w('toaster', 'medium'),
      w('chandelier', 'hard'),
      w('thermostat', 'hard'),
    ],
  },
  {
    name: 'Nature',
    words: [
      w('sun', 'easy'),
      w('tree', 'easy'),
      w('star', 'easy'),
      w('river', 'medium'),
      w('mountain', 'medium'),
      w('rainbow', 'medium'),
      w('volcano', 'hard'),
      w('waterfall', 'hard'),
    ],
  },
  {
    name: 'Things That Go',
    words: [
      w('car', 'easy'),
      w('boat', 'easy'),
      w('bike', 'easy'),
      w('rocket', 'medium'),
      w('tractor', 'medium'),
      w('submarine', 'hard'),
      w('helicopter', 'hard'),
    ],
  },
];

/** Total number of curated built-in words across all packs. */
export const BUILTIN_WORD_COUNT = BUILTIN_PACKS.reduce(
  (n, p) => n + p.words.length,
  0,
);

/**
 * Seed the curated built-in packs. Idempotent: a built-in pack already present
 * by name is skipped (not re-created, not duplicated). Returns how many packs
 * were newly created this call.
 */
export async function seedBuiltinPacks(db: DB): Promise<{ created: number }> {
  let created = 0;
  for (const spec of BUILTIN_PACKS) {
    const [existing] = await db
      .select({ id: packs.id })
      .from(packs)
      .where(
        and(
          eq(packs.name, spec.name),
          eq(packs.isBuiltin, true),
          isNull(packs.ownerId),
        ),
      )
      .limit(1);
    if (existing) continue;
    await createPack(db, {
      name: spec.name,
      ownerId: null,
      isBuiltin: true,
      words: spec.words,
    });
    created += 1;
  }
  return { created };
}
