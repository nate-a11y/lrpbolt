import path from 'path';

export const OUT_ROOT = 'public/webp';

export function stripLeadingPublic(rel) {
  return rel.startsWith('public' + path.sep) ? rel.slice(('public' + path.sep).length) : rel;
}

export function outPathFor(srcAbs, cwd = process.cwd()) {
  const rel = path.relative(cwd, path.resolve(srcAbs));
  const relNoPublic = stripLeadingPublic(rel);
  const outRel = relNoPublic.replace(/\.(png|jpe?g)$/i, '.webp');
  return path.join(OUT_ROOT, outRel);
}
