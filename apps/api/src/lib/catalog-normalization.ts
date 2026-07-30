export const normalizeDisplayText = (value: string) =>
  value.trim().replace(/\s+/g, ' ');

export const normalizeCatalogKey = (value: string) =>
  normalizeDisplayText(value).toLocaleLowerCase('en-US');

export const diningAreaKey = (name: string, address: string) =>
  `${normalizeCatalogKey(name)}|${normalizeCatalogKey(address)}`;
