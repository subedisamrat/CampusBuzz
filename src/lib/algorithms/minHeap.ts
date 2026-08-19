export class MinHeap<T> {
  private heap: T[] = [];

  constructor(private comparator: (a: T, b: T) => number) {}

  insert(item: T): void {
    this.heap.push(item);
    this.heapifyUp(this.heap.length - 1);
  }

  extractMin(): T {
    if (this.isEmpty()) throw new Error('Heap is empty');
    const min = this.heap[0];
    const last = this.heap.pop()!;
    if (!this.isEmpty()) {
      this.heap[0] = last;
      this.heapifyDown(0);
    }
    return min;
  }

  peek(): T | null {
    return this.heap[0] ?? null;
  }

  size(): number { return this.heap.length; }
  isEmpty(): boolean { return this.heap.length === 0; }
  toArray(): T[] { return [...this.heap]; }

  private heapifyUp(i: number): void {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.comparator(this.heap[i], this.heap[parent]) < 0) {
        this.swap(i, parent);
        i = parent;
      } else break;
    }
  }

  private heapifyDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.comparator(this.heap[left], this.heap[smallest]) < 0)
        smallest = left;
      if (right < n && this.comparator(this.heap[right], this.heap[smallest]) < 0)
        smallest = right;
      if (smallest === i) break;
      this.swap(i, smallest);
      i = smallest;
    }
  }

  private swap(i: number, j: number): void {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }
}
