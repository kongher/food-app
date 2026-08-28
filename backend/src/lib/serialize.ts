export function toPublic<T>(doc: unknown): T | null {
  if (!doc || typeof doc !== "object") return null;
  const { _id: _mongoId, __v: _version, ...rest } = doc as Record<string, unknown>;
  if (rest.createdAt instanceof Date) {
    rest.createdAt = rest.createdAt.toISOString();
  }
  if (rest.updatedAt instanceof Date) {
    rest.updatedAt = rest.updatedAt.toISOString();
  }
  return rest as T;
}

export function toPublicList<T>(docs: unknown[]): T[] {
  return docs.map((doc) => toPublic<T>(doc)).filter((item): item is T => item !== null);
}
