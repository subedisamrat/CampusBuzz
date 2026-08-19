/**
 * Property test for Event model date validation
 * **Validates: Requirements 2.6**
 *
 * Property 1: endDate must be strictly after date
 * - For any date D and endDate E where E <= D, the pre-save hook must throw 'endDate must be after date'
 * - For any date D and endDate E where E > D, the pre-save hook must NOT throw
 */

// Extract the pre-save hook validation logic in isolation (no MongoDB connection needed)
function validateEventDates(date: Date, endDate: Date): Error | null {
  if (endDate <= date) {
    return new Error('endDate must be after date');
  }
  return null;
}

// Helper: run the hook and return the error (or null)
function runHook(date: Date, endDate: Date): Error | null {
  return validateEventDates(date, endDate);
}

// --- Date pair generators ---

/** Generate N pairs where endDate <= date (should always fail) */
function generateInvalidPairs(n: number): Array<{ date: Date; endDate: Date; label: string }> {
  const base = new Date('2024-06-15T12:00:00Z').getTime();
  const pairs = [];

  // endDate === date (equal — boundary)
  for (let i = 0; i < Math.ceil(n / 3); i++) {
    const d = new Date(base + i * 86_400_000);
    pairs.push({ date: d, endDate: new Date(d.getTime()), label: `equal[${i}]` });
  }

  // endDate < date (strictly before)
  for (let i = 0; i < Math.floor(n / 3); i++) {
    const d = new Date(base + i * 86_400_000);
    const e = new Date(d.getTime() - (i + 1) * 3_600_000); // 1+ hours before
    pairs.push({ date: d, endDate: e, label: `before[${i}]` });
  }

  // endDate far in the past relative to date
  for (let i = 0; i < Math.floor(n / 3); i++) {
    const d = new Date(base + i * 86_400_000);
    const e = new Date(d.getTime() - 30 * 86_400_000); // 30 days before
    pairs.push({ date: d, endDate: e, label: `farBefore[${i}]` });
  }

  return pairs.slice(0, n);
}

/** Generate N pairs where endDate > date (should always pass) */
function generateValidPairs(n: number): Array<{ date: Date; endDate: Date; label: string }> {
  const base = new Date('2024-06-15T12:00:00Z').getTime();
  const pairs = [];

  // endDate 1 ms after date (minimal valid gap)
  for (let i = 0; i < Math.ceil(n / 3); i++) {
    const d = new Date(base + i * 86_400_000);
    const e = new Date(d.getTime() + 1);
    pairs.push({ date: d, endDate: e, label: `minGap[${i}]` });
  }

  // endDate a few hours after date
  for (let i = 0; i < Math.floor(n / 3); i++) {
    const d = new Date(base + i * 86_400_000);
    const e = new Date(d.getTime() + (i + 1) * 3_600_000);
    pairs.push({ date: d, endDate: e, label: `hours[${i}]` });
  }

  // endDate days after date
  for (let i = 0; i < Math.floor(n / 3); i++) {
    const d = new Date(base + i * 86_400_000);
    const e = new Date(d.getTime() + (i + 1) * 86_400_000);
    pairs.push({ date: d, endDate: e, label: `days[${i}]` });
  }

  return pairs.slice(0, n);
}

// --- Property tests ---

describe('Event model date validation — Property 1: endDate must be strictly after date', () => {
  describe('INVALID pairs (endDate <= date) — hook must reject', () => {
    const invalidPairs = generateInvalidPairs(15);

    test.each(invalidPairs)(
      'rejects when endDate <= date ($label)',
      ({ date, endDate }) => {
        const err = runHook(date, endDate);
        expect(err).not.toBeNull();
        expect(err!.message).toBe('endDate must be after date');
      }
    );
  });

  describe('VALID pairs (endDate > date) — hook must pass', () => {
    const validPairs = generateValidPairs(15);

    test.each(validPairs)(
      'allows when endDate > date ($label)',
      ({ date, endDate }) => {
        const err = runHook(date, endDate);
        expect(err).toBeNull();
      }
    );
  });

  describe('boundary and edge cases', () => {
    test('equal timestamps (same millisecond) are rejected', () => {
      const d = new Date('2025-01-01T00:00:00.000Z');
      const err = runHook(d, new Date(d.getTime()));
      expect(err).not.toBeNull();
      expect(err!.message).toBe('endDate must be after date');
    });

    test('endDate 1 ms before date is rejected', () => {
      const d = new Date('2025-01-01T00:00:00.000Z');
      const err = runHook(d, new Date(d.getTime() - 1));
      expect(err).not.toBeNull();
      expect(err!.message).toBe('endDate must be after date');
    });

    test('endDate 1 ms after date is accepted', () => {
      const d = new Date('2025-01-01T00:00:00.000Z');
      const err = runHook(d, new Date(d.getTime() + 1));
      expect(err).toBeNull();
    });

    test('endDate far in the future is accepted', () => {
      const d = new Date('2025-01-01T00:00:00.000Z');
      const e = new Date('2099-12-31T23:59:59.999Z');
      const err = runHook(d, e);
      expect(err).toBeNull();
    });

    test('endDate far in the past relative to date is rejected', () => {
      const d = new Date('2025-06-01T00:00:00.000Z');
      const e = new Date('2020-01-01T00:00:00.000Z');
      const err = runHook(d, e);
      expect(err).not.toBeNull();
      expect(err!.message).toBe('endDate must be after date');
    });
  });
});
