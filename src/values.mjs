// SPDX-License-Identifier: MPL-2.0
import { binding, aliasRoot } from './scope.mjs';
import { Boundary } from './contracts.mjs';

const unresolved = reason => ({ kind: 'unknown', reason, evidence: [] });
const staticValue = (value, evidence = []) => ({ kind: 'static', value, evidence });
function step(ctx, depth) { if (++ctx.steps > ctx.limits.evaluationSteps) throw new Boundary('evaluation_budget'); return depth <= 32; }
function constBinding(ctx, expr, seen) {
  const b = binding(ctx, expr);
  return b && b.kind === 'const' && b.init && !b.written && b.id.start < expr.start && !seen.has(b) && !ctx.loopDepth.get(b.init) ? b : null;
}
export function value(ctx, expr, depth = 0, seen = new Set()) {
  if (!step(ctx, depth) || !expr) return unresolved('expression_depth_or_missing');
  switch (expr.type) {
    case 'Literal':
      return expr.regex || typeof expr.value === 'number' && !Number.isFinite(expr.value) ? unresolved('unsupported_literal') : staticValue(expr.value, [expr]);
    case 'Identifier': {
      const b = constBinding(ctx, expr, seen);
      if (!b) {
        const raw = binding(ctx, expr);
        return raw && raw.kind !== 'parameter' ? unresolved(raw.kind === 'let' || raw.kind === 'var' ? 'mutable_binding_unresolved' : 'unresolved_binding') : { kind: 'unproven', reason: 'unproven_data', evidence: [expr] };
      }
      const next = new Set(seen); next.add(b); const v = value(ctx, b.init, depth + 1, next); return { ...v, evidence: [b.id, ...v.evidence] };
    }
    case 'UnaryExpression': {
      const v = value(ctx, expr.argument, depth + 1, seen); if (v.kind !== 'static') return unresolved('unsupported_coercion');
      if (expr.operator === '!') return staticValue(!v.value, v.evidence);
      if ((expr.operator === '-' || expr.operator === '+') && (typeof v.value === 'number' || expr.operator === '-' && typeof v.value === 'bigint')) {
        const n = expr.operator === '-' ? -v.value : +v.value; return typeof n === 'number' && !Number.isFinite(n) ? unresolved('unsupported_numeric_value') : staticValue(n, v.evidence);
      }
      return unresolved('unsupported_unary');
    }
    case 'BinaryExpression': {
      const a = value(ctx, expr.left, depth + 1, seen), b = value(ctx, expr.right, depth + 1, seen);
      if (expr.operator !== '+') return unresolved('unsupported_binary');
      if (a.kind === 'sanitized' || b.kind === 'sanitized') return unresolved('sanitizer_composition_context');
      if (a.kind === 'unknown' || b.kind === 'unknown') return unresolved('unresolved_composition');
      if (a.kind === 'unproven' || b.kind === 'unproven') return { kind: 'unproven', reason: 'unproven_composition', evidence: [...a.evidence, ...b.evidence] };
      if (a.kind !== 'static' || b.kind !== 'static') return unresolved('unresolved_composition');
      try { const n = a.value + b.value; if (typeof n === 'number' && !Number.isFinite(n) || typeof n === 'string' && Buffer.byteLength(n) > ctx.limits.tokenBytes) return unresolved('constant_value_budget'); return staticValue(n, [...a.evidence, ...b.evidence]); } catch { return unresolved('invalid_primitive_composition'); }
    }
    case 'TemplateLiteral': {
      let text = ''; const evidence = [];
      for (let i = 0; i < expr.quasis.length; i++) {
        const q = expr.quasis[i].value.cooked; if (q === null) return unresolved('invalid_template'); text += q;
        if (i < expr.expressions.length) {
          const v = value(ctx, expr.expressions[i], depth + 1, seen);
          if (v.kind === 'sanitized') return unresolved('sanitizer_composition_context');
          if (v.kind === 'unproven') return v;
          if (v.kind !== 'static') return unresolved('unresolved_template'); text += String(v.value); evidence.push(...v.evidence);
        }
        if (Buffer.byteLength(text) > ctx.limits.tokenBytes) return unresolved('constant_value_budget');
      }
      return staticValue(text, evidence.length ? evidence : [expr]);
    }
    case 'ConditionalExpression': {
      const test = value(ctx, expr.test, depth + 1, seen); if (test.kind !== 'static') return unresolved('conditional_selection_unresolved'); return value(ctx, test.value ? expr.consequent : expr.alternate, depth + 1, seen);
    }
    case 'CallExpression': {
      const f = sanitizer(ctx, expr.callee, depth + 1, new Set());
      if (!f || expr.optional || expr.arguments.length !== 1 || expr.arguments[0].type === 'SpreadElement') return unresolved('sanitizer_binding_or_arguments_unproved');
      return { kind: 'sanitized', reason: 'asserted_import_sanitizer_contract', evidence: [...f.evidence, expr] };
    }
    case 'MemberExpression': return { kind: 'unproven', reason: 'unproven_member_data', evidence: [expr] };
    case 'TaggedTemplateExpression': return unresolved('tagged_sanitizer_not_supported');
    case 'ChainExpression': return unresolved('optional_value_unresolved');
    default: return unresolved('unsupported_value_expression');
  }
}
export function property(ctx, member) {
  if (!member.computed) return member.property.type === 'Identifier' ? member.property.name : null;
  const v = value(ctx, member.property); return v.kind === 'static' && typeof v.value === 'string' ? v.value : null;
}
function importedObject(ctx, expr, depth = 0, seen = new Set()) {
  if (!step(ctx, depth) || expr?.type !== 'Identifier') return null;
  const b = binding(ctx, expr); if (!b || b.written || seen.has(b)) return null;
  if (b.kind === 'import') return ctx.dirtyObjects.has(b) ? null : { b, evidence: [b.id] };
  const local = constBinding(ctx, expr, seen); if (!local) return null;
  const next = new Set(seen); next.add(b); const v = importedObject(ctx, b.init, depth + 1, next); return v && { ...v, evidence: [b.id, ...v.evidence] };
}
export function sanitizer(ctx, expr, depth = 0, seen = new Set()) {
  if (!step(ctx, depth) || !expr || expr.optional) return null;
  let root, member = null, detached = false;
  if (expr.type === 'Identifier') {
    const b = binding(ctx, expr); if (!b || b.written || seen.has(b)) return null;
    if (b.kind === 'const' && b.init && b.id.start < expr.start && !ctx.loopDepth.get(b.init)) {
      const next = new Set(seen); next.add(b); const f = sanitizer(ctx, b.init, depth + 1, next); return f && !f.memberCall ? { ...f, evidence: [b.id, ...f.evidence] } : null;
    }
    root = importedObject(ctx, expr, depth + 1, seen);
  } else if (expr.type === 'MemberExpression') { root = importedObject(ctx, expr.object, depth + 1, seen); member = property(ctx, expr); detached = true; }
  if (!root || member === null && expr.type !== 'Identifier') return null;
  const contract = ctx.options.sanitizers.find(x => x.module === root.b.module && x.imported === root.b.imported && x.member === member);
  return contract ? { memberCall: detached, evidence: root.evidence } : null;
}
export function host(ctx, expr, depth = 0, seen = new Set()) {
  if (!step(ctx, depth) || !expr || ctx.dynamicScope || ctx.hostUncertain || expr.start >= ctx.hostCaptureStart || ctx.options.host !== 'browser') return 'unknown';
  if (expr.type === 'Identifier') {
    const b = binding(ctx, expr);
    if (!b) return ctx.dirtyGlobals.has(expr.name) || ctx.dirtyGlobals.has('document') ? 'unknown' : expr.name === 'document' ? 'document' : ['window', 'globalThis'].includes(expr.name) ? 'window' : 'unknown';
    if (ctx.dirtyHostObjects.has(aliasRoot(ctx, expr))) return 'unknown';
    const local = constBinding(ctx, expr, seen); if (!local) return 'unknown'; const next = new Set(seen); next.add(b); return host(ctx, b.init, depth + 1, next);
  }
  if (expr.type === 'ObjectExpression' || expr.type === 'ArrayExpression' || expr.type === 'Literal') return 'ordinary';
  if (expr.type === 'MemberExpression' && !expr.optional) {
    const h = host(ctx, expr.object, depth + 1, seen), p = property(ctx, expr);
    if (h === 'window' && p === 'document' && !ctx.dirtyGlobals.has('document')) return 'document';
    if (h === 'document' && ['body', 'documentElement'].includes(p)) return 'element';
    if (h === 'element' && ['parentElement', 'firstElementChild', 'lastElementChild'].includes(p)) return 'element';
    if (h === 'element' && p === 'shadowRoot') return 'shadow';
    if ((h === 'element' || h === 'shadow') && p === 'ownerDocument') return 'document';
  }
  if (expr.type === 'CallExpression' && !expr.optional && expr.callee.type === 'MemberExpression' && !expr.callee.optional && !expr.arguments.some(x => x.type === 'SpreadElement')) {
    const h = host(ctx, expr.callee.object, depth + 1, seen), p = property(ctx, expr.callee);
    if (h === 'document' && p === 'createRange' && expr.arguments.length === 0) return 'range';
    if (h === 'document' && ['createElement', 'getElementById', 'querySelector'].includes(p) && expr.arguments.length === 1) return 'element';
    if (((h === 'element' || h === 'shadow') && p === 'querySelector' || h === 'element' && p === 'closest') && expr.arguments.length === 1) return 'element';
    if (h === 'element' && p === 'attachShadow' && expr.arguments.length === 1) return 'shadow';
  }
  return 'unknown';
}
