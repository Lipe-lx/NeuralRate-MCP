const jsonReplacer = (_key: string, value: unknown) =>
  typeof value === "bigint" ? value.toString() : value;

export const safeJsonStringify = (value: unknown) => JSON.stringify(value, jsonReplacer);
