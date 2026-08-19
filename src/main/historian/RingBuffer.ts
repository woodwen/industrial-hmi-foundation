export class RingBuffer<T> {
  private readonly items: T[] = []

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('RingBuffer capacity must be a positive integer.')
    }
  }

  push(item: T): void {
    if (this.items.length >= this.capacity) {
      this.items.shift()
    }

    this.items.push(item)
  }

  toArray(): T[] {
    return [...this.items]
  }

  get size(): number {
    return this.items.length
  }

  clear(): void {
    this.items.length = 0
  }
}
