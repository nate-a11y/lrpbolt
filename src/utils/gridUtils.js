export const safeRow = (params) =>
  params && typeof params === 'object' && 'row' in params ? params.row : null;
