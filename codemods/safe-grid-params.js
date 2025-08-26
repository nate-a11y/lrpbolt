/**
 * jscodeshift codemod:
 * - For object properties named "valueGetter" or "valueFormatter" whose value
 *   is an arrow function with param destructuring, replace the param with `p`
 *   and insert: `const row = p?.row ?? null; const value = p?.value;`
 * - If the arrow body is an expression, wrap it in a BlockStatement with a return.
 */
export default function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  function fixArrow(fnPath) {
    const fn = fnPath.value.value;
    if (!fn.params || fn.params.length !== 1) return;
    const param = fn.params[0];

    if (param.type !== 'ObjectPattern') return;

    const props = param.properties
      .filter((p) => p.key && ['row', 'value'].includes(p.key.name))
      .map((p) => p.key.name);
    if (props.length === 0) return;

    fn.params = [j.identifier('p')];

    if (fn.body.type !== 'BlockStatement') {
      fn.body = j.blockStatement([j.returnStatement(fn.body)]);
    }

    const decls = [];
    if (props.includes('row')) {
      decls.push(
        j.variableDeclarator(
          j.identifier('row'),
          j.logicalExpression(
            '??',
            j.optionalMemberExpression(j.identifier('p'), j.identifier('row'), false, true),
            j.literal(null)
          )
        )
      );
    }
    if (props.includes('value')) {
      decls.push(
        j.variableDeclarator(
          j.identifier('value'),
          j.optionalMemberExpression(j.identifier('p'), j.identifier('value'), false, true)
        )
      );
    }
    if (decls.length) {
      fn.body.body.unshift(j.variableDeclaration('const', decls));
    }
  }

  root
    .find(j.ObjectProperty, { value: { type: 'ArrowFunctionExpression' } })
    .filter((path) => ['valueGetter', 'valueFormatter'].includes(path.value.key.name))
    .forEach(fixArrow);

  return root.toSource({ quote: 'single', trailingComma: true });
}
