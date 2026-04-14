export type BinarySearchOptions<K, T> = {
  comparator?: (a: K, b: T) => number;
  direction?: "forward" | "backward";
  inclusive?: boolean;
  extend?: boolean;
  upperBoundReturnsLength?: boolean;
};

export function binarySearch<K, T>(list: T[], key: K, options: BinarySearchOptions<K, T> = {}): number {
  const {
    comparator = (a, b) => Number(a) - Number(b),
    direction = "forward",
    inclusive = true,
    extend = true,
    upperBoundReturnsLength = false,
  } = options;

  // Check if list is invalid or empty
  if (!Array.isArray(list)) {
    throw new TypeError(`Cannot insert into type ${typeof list}`);
  }

  if (list.length === 0) {
    return -1;
  }

  // Check lower bound
  const cmpLow = comparator(key, list[0]!);
  if (cmpLow < 0) {
    return extend ? 0 : -1;
  } else if (cmpLow === 0) {
    if (inclusive) {
      return 0;
    } else if (direction === "forward") {
      return list.length > 1 ? 1 : (upperBoundReturnsLength ? list.length : -1);
    } else {
      return extend ? 0 : -1;
    }
  }

  // Check upper bound
  const cmpHigh = comparator(key, list[list.length - 1]!);
  if (cmpHigh > 0) {
    return extend ? list.length - 1 : (upperBoundReturnsLength ? list.length : -1);
  } else if (cmpHigh === 0) {
    if (inclusive) {
      return list.length - 1;
    } else if (direction === "forward") {
      return extend ? list.length - 1 : (upperBoundReturnsLength ? list.length : -1);
    } else {
      return list.length > 1 ? list.length - 2 : -1;
    }
  }

  // Search the list for an exact match
  let low = 0;
  let high = list.length - 1;
  while (low <= high) {
    const mid = low + Math.floor((high - low) / 2);
    const cmp = comparator(key, list[mid]!);

    // Validate the comparator result
    if (typeof cmp !== "number" || isNaN(cmp)) {
      throw new Error(`Comparator returned an invalid result: ${cmp}`);
    }

    if (cmp === 0) {
      // Exact match found. Return mid or next/previous item depending on the direction
      if (inclusive) {
        return mid;
      } else if (direction === "forward") {
        return mid < list.length - 1 ? mid + 1 : -1;
      } else {
        return mid > 0 ? mid - 1 : -1;
      }
    } else if (cmp < 0) {
      // Discard upper half
      high = mid - 1;
    } else {
      // Discard lower half
      low = mid + 1;
    }
  }

  // No exact match found.
  // "low" now refers to the element after the key and "high" to the one before.
  // the bounds have already been checked, so we can return the appropriate element depending on the direction
  if (direction === "forward") {
    return low;
  } else {
    return high;
  }
}

export type InsertSortedOptions<T> = {
  comparator?: (a: T, b: T) => number;
};

export function insertSorted<T>(list: T[], item: T, options: InsertSortedOptions<T> = {}): T[] {
  const {
    comparator = (a, b) => Number(a) - Number(b),
  } = options;

  // Check if list is invalid or empty
  if (!Array.isArray(list)) {
    throw new TypeError(`Cannot insert into type ${typeof list}`);
  }

  if (list.length === 0) {
    list.splice(0, 0, item);
    return list;
  }

  let pos = undefined;

  // Check lower bound
  const cmpLow = comparator(item, list[0]!);
  if (cmpLow < 0) {
    pos = 0;
  } else if (cmpLow === 0) {
    pos = 1;
  }

  // Check upper bound
  const cmpHigh = comparator(item, list[list.length - 1]!);
  if (cmpHigh >= 0) {
    pos = list.length;
  }

  // Lookup position via binary search
  if (pos === undefined) {
    pos = binarySearch(list, item, {
      comparator,
      inclusive: false,
      extend: false,
    });
  }

  list.splice(pos, 0, item);
  return list;
}

export type BinarySortedListOptions<T> = BinarySearchOptions<T, T> & InsertSortedOptions<T>;

/**
 * Represents a list that maintains its items in sorted order using a binary search comparator.
 */
export class BinarySortedList<T> {
  private items: T[];
  private options: BinarySortedListOptions<T>;

  /**
   * Creates an instance of the class with an optional array of items and options.
   * Ensures items are sorted using the provided comparator or a default comparator.
   *
   * @param {Array} items The initial array of items.
   * @param {Object} rest Configuration options.
   * @param {Function} rest.comparator Optional comparator function for sorting items. Unlike the binarySearch comparator, this one must also be able to compare two items directly.
   */
  constructor(items: T[] = [], options: BinarySortedListOptions<T> = {}) {
    this.options = options;
    this.options.comparator = this.options.comparator ?? ((a, b) => Number(a) - Number(b));
    this.items = Array.isArray(items) ? items : [];

    // Ensure the initial items are sorted
    this.sort();
  }

  get length(): number {
    return this.items.length;
  }

  /**
   * Inserts an item into the sorted list, maintaining order.
   * @param {*} item The item to insert.
   */
  insert(item: T): void {
    this.items = insertSorted(this.items, item, this.options);
  }

  /**
   * Searches for a key in the sorted list using binary search.
   * @param {*} keyItem The key item to search for.
   * @param {Object} options Optional settings for the search. These will override the class options.
   * @returns {*} The result of the binary search.
   */
  searchIndex<K = T>(keyItem: K, options: BinarySearchOptions<K, T> = {}): number {
    return binarySearch(this.items, keyItem, { ...this.options as any, ...options });
  }

  search<K = T>(keyItem: K, options: BinarySearchOptions<K, T> = {}): T | undefined {
    return this.items[this.searchIndex(keyItem, options)];
  }

  searchIndexRange<K = T>(from: K, to: K, options: BinarySearchOptions<K, T> = {}): [number, number] {
    const a = this.searchIndex(from, {
      ...options,
      inclusive: true,
      extend: false,
      upperBoundReturnsLength: true,
    });
    const b = this.searchIndex(to, {
      ...options,
      inclusive: true,
      extend: false,
      upperBoundReturnsLength: true,
    });

    return [a, b];
  }

  searchRange<K = T>(from: K, to: K, options: BinarySearchOptions<K, T> = {}): T[] {
    const [a, b] = this.searchIndexRange(from, to, options);
    if (a === -1 && b === 1) {
      return this.items.slice(0, 1); // Edge case, where slice(-1, 1) returns no items, although it should return the first item
    }

    return this.items.slice(a, b);
  }

  clear(): void {
    this.items = [];
  }

  sort(): void {
    this.items.sort(this.options.comparator);
  }

  getItems(): T[] {
    return this.items;
  }

  at(index: number): T | undefined {
    return this.items.at(index);
  }

  first(): T | undefined {
    return this.at(0);
  }

  last(): T | undefined {
    return this.at(-1);
  }
}
