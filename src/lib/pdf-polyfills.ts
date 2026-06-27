type MapWithInsertHelpers<K, V> = Map<K, V> & {
  getOrInsert?: (key: K, value: V) => V;
  getOrInsertComputed?: (key: K, callback: (key: K) => V) => V;
};

export function ensurePdfJsPolyfills() {
  const mapPrototype = Map.prototype as MapWithInsertHelpers<unknown, unknown>;

  if (!mapPrototype.getOrInsert) {
    mapPrototype.getOrInsert = function getOrInsert<K, V>(this: Map<K, V>, key: K, value: V) {
      if (this.has(key)) return this.get(key) as V;
      this.set(key, value);
      return value;
    };
  }

  if (!mapPrototype.getOrInsertComputed) {
    mapPrototype.getOrInsertComputed = function getOrInsertComputed<K, V>(this: Map<K, V>, key: K, callback: (key: K) => V) {
      if (this.has(key)) return this.get(key) as V;
      const value = callback(key);
      this.set(key, value);
      return value;
    };
  }
}
