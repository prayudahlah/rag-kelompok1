/**
 * LRU cache sederhana untuk menyimpan embedding query agar
 * pertanyaan yang berulang tidak memanggil API lagi (hemat kuota).
 */
export class LruCache<K, V> {
  private readonly map = new Map<K, V>();

  constructor(private readonly max: number) {}

  get(key: K): V | undefined {
    const value = this.map.get(key);

    if (value === undefined) {
      return undefined;
    }

    this.map.delete(key);
    this.map.set(key, value);

    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    }

    this.map.set(key, value);

    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;

      if (oldest !== undefined) {
        this.map.delete(oldest);
      }
    }
  }

  get size(): number {
    return this.map.size;
  }
}
