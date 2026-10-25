/** SOAP libraries collapse a single maxOccurs element to an object. */
export function sriArray<T>(value: T | T[] | null | undefined): T[] {
  return value == null ? [] : Array.isArray(value) ? value : [value];
}
