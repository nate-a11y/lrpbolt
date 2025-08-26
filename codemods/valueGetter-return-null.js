/**
 * If a valueGetter still returns row.<field> directly, make it null-safe.
 * Example: valueGetter: (p) => p.row.tripId  =>  (p) => p?.row?.tripId ?? null
 */
export default function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  root
    .find(j.Property, { key: { name: 'valueGetter' }, value: { type: 'ArrowFunctionExpression' } })
    .forEach((path) => {
      const fn = path.value.value;
      const pId = fn.params[0] && fn.params[0].type === 'Identifier' ? fn.params[0].name : 'p';

      if (fn.body.type === 'MemberExpression') {
        const body = fn.body;
        if (
          body.object &&
          body.object.type === 'MemberExpression' &&
          body.object.object.type === 'Identifier' &&
          body.object.object.name === pId &&
          body.object.property.type === 'Identifier' &&
          body.object.property.name === 'row'
        ) {
          const safe = j.logicalExpression(
            '??',
            j.optionalMemberExpression(
              j.optionalMemberExpression(j.identifier(pId), j.identifier('row'), false, true),
              body.property,
              body.computed || false,
              true
            ),
            j.literal(null)
          );
          fn.body = safe;
        }
      }
    });

  return root.toSource({ quote: 'single', trailingComma: true });
}
