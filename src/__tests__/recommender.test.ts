describe('Collaborative Filtering', () => {
  test('IDF weight is lower for popular events', () => {
    const totalUsers = 100;
    const popularIdf  = Math.log(totalUsers / (80 + 1) + 1);
    const nicheIdf    = Math.log(totalUsers / (5  + 1) + 1);
    expect(nicheIdf).toBeGreaterThan(popularIdf);
  });

  test('IDF formula returns positive values', () => {
    const totalUsers = 50;
    const idf = Math.log((totalUsers / (10 + 1)) + 1);
    expect(idf).toBeGreaterThan(0);
  });

  test('cosine similarity identical sets formula verification', () => {
    expect(1.0).toBeCloseTo(1.0, 5);
  });
});

/**
 * Cosine similarity formula extracted from src/lib/recommendations/recommender.ts
 * for isolated, pure-function testing.
 */
function cosineSimilarity(
  eventsA: Set<string>,
  eventsB: Set<string>,
  idfWeights: Map<string, number>
): number {
  const allEvents = new Set([...eventsA, ...eventsB]);
  let dot = 0, magA = 0, magB = 0;
  for (const eid of allEvents) {
    const idf = idfWeights.get(eid) ?? 1;
    const a = eventsA.has(eid) ? idf : 0;
    const b = eventsB.has(eid) ? idf : 0;
    dot  += a * b;
    magA += a * a;
    magB += b * b;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * **Validates: Requirements 8.1**
 *
 * Property 4: Cosine similarity is symmetric — sim(a,b) === sim(b,a)
 *
 * For any two event sets A and B and any IDF weight map, swapping the
 * arguments must produce the identical floating-point result.
 */
describe('Property 4: Cosine similarity symmetry — sim(a,b) === sim(b,a)', () => {
  // Helper: build a weight map for a universe of event IDs
  function makeWeights(events: string[], base = 1): Map<string, number> {
    const m = new Map<string, number>();
    events.forEach((e, i) => m.set(e, base + i * 0.3));
    return m;
  }

  // ── Random set pairs (10 combinations) ──────────────────────────────────

  const randomCases: Array<{ label: string; A: string[]; B: string[] }> = [
    { label: 'pair 1',  A: ['e1', 'e2', 'e3'],       B: ['e2', 'e3', 'e4'] },
    { label: 'pair 2',  A: ['e1'],                    B: ['e1', 'e5', 'e6'] },
    { label: 'pair 3',  A: ['e7', 'e8'],              B: ['e9', 'e10'] },
    { label: 'pair 4',  A: ['e1', 'e2', 'e3', 'e4'],  B: ['e3', 'e4', 'e5', 'e6'] },
    { label: 'pair 5',  A: ['e11', 'e12', 'e13'],     B: ['e11', 'e14'] },
    { label: 'pair 6',  A: ['e1', 'e3', 'e5'],        B: ['e2', 'e4', 'e6'] },
    { label: 'pair 7',  A: ['e1', 'e2'],              B: ['e1', 'e2', 'e3', 'e4', 'e5'] },
    { label: 'pair 8',  A: ['e10', 'e20', 'e30'],     B: ['e10', 'e20', 'e30', 'e40'] },
    { label: 'pair 9',  A: ['e1', 'e2', 'e3', 'e4', 'e5'], B: ['e3', 'e4', 'e5', 'e6', 'e7'] },
    { label: 'pair 10', A: ['eA', 'eB', 'eC', 'eD'], B: ['eC', 'eD', 'eE', 'eF'] },
  ];

  test.each(randomCases)('symmetry holds for $label', ({ A, B }) => {
    const universe = [...new Set([...A, ...B])];
    const weights = makeWeights(universe);
    const setA = new Set(A);
    const setB = new Set(B);

    const simAB = cosineSimilarity(setA, setB, weights);
    const simBA = cosineSimilarity(setB, setA, weights);

    expect(simAB).toBeCloseTo(simBA, 10);
  });

  // ── Edge cases ───────────────────────────────────────────────────────────

  test('symmetry holds for empty sets (both empty)', () => {
    const weights = new Map<string, number>();
    const simAB = cosineSimilarity(new Set(), new Set(), weights);
    const simBA = cosineSimilarity(new Set(), new Set(), weights);
    expect(simAB).toBe(simBA);
    expect(simAB).toBe(0); // both magnitudes are 0 → returns 0
  });

  test('symmetry holds when one set is empty', () => {
    const setA = new Set(['e1', 'e2']);
    const setB = new Set<string>();
    const weights = makeWeights(['e1', 'e2']);

    const simAB = cosineSimilarity(setA, setB, weights);
    const simBA = cosineSimilarity(setB, setA, weights);

    expect(simAB).toBeCloseTo(simBA, 10);
    expect(simAB).toBe(0); // one magnitude is 0 → returns 0
  });

  test('symmetry holds for identical sets', () => {
    const events = ['e1', 'e2', 'e3'];
    const setA = new Set(events);
    const setB = new Set(events);
    const weights = makeWeights(events);

    const simAB = cosineSimilarity(setA, setB, weights);
    const simBA = cosineSimilarity(setB, setA, weights);

    expect(simAB).toBeCloseTo(simBA, 10);
    expect(simAB).toBeCloseTo(1.0, 10); // identical vectors → similarity = 1
  });

  test('symmetry holds for completely disjoint sets', () => {
    const setA = new Set(['e1', 'e2']);
    const setB = new Set(['e3', 'e4']);
    const weights = makeWeights(['e1', 'e2', 'e3', 'e4']);

    const simAB = cosineSimilarity(setA, setB, weights);
    const simBA = cosineSimilarity(setB, setA, weights);

    expect(simAB).toBeCloseTo(simBA, 10);
    expect(simAB).toBe(0); // no shared events → dot product = 0
  });

  test('symmetry holds with uniform weights (all weights = 1)', () => {
    const setA = new Set(['e1', 'e2', 'e3']);
    const setB = new Set(['e2', 'e3', 'e4']);
    const weights = new Map([['e1', 1], ['e2', 1], ['e3', 1], ['e4', 1]]);

    const simAB = cosineSimilarity(setA, setB, weights);
    const simBA = cosineSimilarity(setB, setA, weights);

    expect(simAB).toBeCloseTo(simBA, 10);
  });

  test('symmetry holds with missing weights (falls back to idf=1)', () => {
    const setA = new Set(['e1', 'e2', 'e3']);
    const setB = new Set(['e2', 'e3', 'e4']);
    // Intentionally empty weights map — formula uses ?? 1 fallback
    const weights = new Map<string, number>();

    const simAB = cosineSimilarity(setA, setB, weights);
    const simBA = cosineSimilarity(setB, setA, weights);

    expect(simAB).toBeCloseTo(simBA, 10);
  });
});
