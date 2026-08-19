import { MinHeap } from '@/lib/algorithms/minHeap';

describe('MinHeap', () => {
  const numComparator = (a: number, b: number) => a - b;

  test('insert and extractMin returns elements in ascending order', () => {
    const heap = new MinHeap<number>(numComparator);
    [5, 3, 8, 1, 9, 2].forEach(n => heap.insert(n));
    expect(heap.extractMin()).toBe(1);
    expect(heap.extractMin()).toBe(2);
    expect(heap.extractMin()).toBe(3);
  });

  test('peek does not remove element', () => {
    const heap = new MinHeap<number>(numComparator);
    heap.insert(4);
    heap.insert(2);
    expect(heap.peek()).toBe(2);
    expect(heap.size()).toBe(2);
  });

  test('extractMin on empty heap throws', () => {
    const heap = new MinHeap<number>(numComparator);
    expect(() => heap.extractMin()).toThrow('Heap is empty');
  });

  test('size and isEmpty work correctly', () => {
    const heap = new MinHeap<number>(numComparator);
    expect(heap.isEmpty()).toBe(true);
    heap.insert(1);
    expect(heap.isEmpty()).toBe(false);
    expect(heap.size()).toBe(1);
  });

  test('handles 1000 random inserts in correct order', () => {
    const heap = new MinHeap<number>(numComparator);
    const nums = Array.from({ length: 1000 }, () => Math.floor(Math.random() * 10000));
    nums.forEach(n => heap.insert(n));

    const sorted = [...nums].sort((a, b) => a - b);
    const extracted = Array.from({ length: 1000 }, () => heap.extractMin());
    expect(extracted).toEqual(sorted);
  });

  test('waitlist comparator — lower priorityScore = extracted first', () => {
    interface Entry { userId: string; priorityScore: number }
    const heap = new MinHeap<Entry>((a, b) => a.priorityScore - b.priorityScore);

    heap.insert({ userId: 'alice', priorityScore: 1000 });
    heap.insert({ userId: 'bob',   priorityScore: 500 });
    heap.insert({ userId: 'carol', priorityScore: 750 });

    expect(heap.extractMin().userId).toBe('bob');
    expect(heap.extractMin().userId).toBe('carol');
    expect(heap.extractMin().userId).toBe('alice');
  });
});

/**
 * Property 3: peek() always returns minimum priorityScore after any insert sequence
 * Validates: Requirements 7.2
 */
describe('Property 3: peek() always returns minimum priorityScore after any insert sequence', () => {
  interface WaitlistEntry { userId: string; priorityScore: number }
  const waitlistComparator = (a: WaitlistEntry, b: WaitlistEntry) => a.priorityScore - b.priorityScore;

  function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function generateSequence(length: number): WaitlistEntry[] {
    return Array.from({ length }, (_, i) => ({
      userId: `user-${i}`,
      priorityScore: randomInt(-1_000_000, 1_000_000),
    }));
  }

  test('peek() equals minimum after each insert — 10 random sequences of varying lengths', () => {
    const lengths = [1, 2, 3, 5, 10, 20, 50, 100, 200, 500];

    for (const length of lengths) {
      const heap = new MinHeap<WaitlistEntry>(waitlistComparator);
      const sequence = generateSequence(length);
      let currentMin = Infinity;

      for (const entry of sequence) {
        heap.insert(entry);
        currentMin = Math.min(currentMin, entry.priorityScore);

        const peeked = heap.peek();
        expect(peeked).not.toBeNull();
        expect(peeked!.priorityScore).toBe(currentMin);
      }
    }
  });

  test('peek() equals minimum with duplicate priorityScores', () => {
    const heap = new MinHeap<WaitlistEntry>(waitlistComparator);
    const entries: WaitlistEntry[] = [
      { userId: 'u1', priorityScore: 100 },
      { userId: 'u2', priorityScore: 100 },
      { userId: 'u3', priorityScore: 50 },
      { userId: 'u4', priorityScore: 50 },
      { userId: 'u5', priorityScore: 200 },
    ];
    let currentMin = Infinity;

    for (const entry of entries) {
      heap.insert(entry);
      currentMin = Math.min(currentMin, entry.priorityScore);
      expect(heap.peek()!.priorityScore).toBe(currentMin);
    }
  });

  test('peek() equals minimum with negative priorityScores', () => {
    const heap = new MinHeap<WaitlistEntry>(waitlistComparator);
    const entries: WaitlistEntry[] = [
      { userId: 'u1', priorityScore: -500 },
      { userId: 'u2', priorityScore: 300 },
      { userId: 'u3', priorityScore: -1000 },
      { userId: 'u4', priorityScore: 0 },
    ];
    let currentMin = Infinity;

    for (const entry of entries) {
      heap.insert(entry);
      currentMin = Math.min(currentMin, entry.priorityScore);
      expect(heap.peek()!.priorityScore).toBe(currentMin);
    }
  });

  test('peek() invariant holds across 10 fully random sequences', () => {
    for (let trial = 0; trial < 10; trial++) {
      const length = randomInt(5, 100);
      const heap = new MinHeap<WaitlistEntry>(waitlistComparator);
      const sequence = generateSequence(length);
      let currentMin = Infinity;

      for (const entry of sequence) {
        heap.insert(entry);
        currentMin = Math.min(currentMin, entry.priorityScore);
        expect(heap.peek()!.priorityScore).toBe(currentMin);
      }
    }
  });
});
