// SPDX-License-Identifier: MPL-2.0
import { children } from './parser.mjs';
import { Boundary } from './contracts.mjs';

const functions = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const loops = new Set(['ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement']);
const htmlProperties = new Set(['innerHTML', 'outerHTML']);
class Scope {
  constructor(parent = null, kind = 'block') { this.parent = parent; this.kind = kind; this.bindings = new Map(); }
}
function patternNames(node, out = []) {
  if (!node) return out;
  switch (node.type) {
    case 'Identifier': out.push(node); break;
    case 'RestElement': patternNames(node.argument, out); break;
    case 'AssignmentPattern': patternNames(node.left, out); break;
    case 'ArrayPattern': for (const x of node.elements) patternNames(x, out); break;
    case 'ObjectPattern': for (const x of node.properties) patternNames(x.type === 'RestElement' ? x.argument : x.value, out); break;
  }
  return out;
}
function declare(scope, id, kind, init = null, extra = {}) {
  if (!id) return;
  if (scope.bindings.has(id.name)) { scope.bindings.get(id.name).kind = 'duplicate'; return; }
  scope.bindings.set(id.name, { id, kind, init, scope, written: false, ...extra });
}
export function bindTree(ast, limits) {
  const root = new Scope(null, 'program');
  const ctx = { root, nodes: [], scopes: new WeakMap(), parents: new WeakMap(), edge: new WeakMap(), loopDepth: new WeakMap(), dirtyObjects: new Set(), dirtyHostObjects: new Set(), dirtyGlobals: new Set(), dynamicScope: false, hostUncertain: false, steps: 0, limits };
  const stack = [{ node: ast, scope: root, parent: null, key: null, depth: 1, loop: 0 }];
  while (stack.length) {
    const item = stack.pop(), { node, parent, key, depth } = item; let { scope, loop } = item;
    if (ctx.nodes.length >= limits.nodes || depth > limits.astDepth) throw new Boundary('ast_budget');
    ctx.nodes.push(node); ctx.parents.set(node, parent); ctx.edge.set(node, key);
    if (functions.has(node.type)) {
      if (node.type === 'FunctionDeclaration') declare(scope, node.id, 'function');
      scope = new Scope(scope, 'function');
      if (node.type === 'FunctionExpression') declare(scope, node.id, 'function');
      for (const p of node.params) for (const id of patternNames(p)) declare(scope, id, 'parameter');
    } else if (node.type === 'BlockStatement' || node.type === 'StaticBlock' || loops.has(node.type) || node.type === 'SwitchStatement') scope = new Scope(scope);
    else if (node.type === 'CatchClause') { scope = new Scope(scope); for (const id of patternNames(node.param)) declare(scope, id, 'parameter'); }
    else if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
      if (node.type === 'ClassDeclaration') declare(scope, node.id, 'class');
      scope = new Scope(scope); declare(scope, node.id, 'class');
    }
    if (loops.has(node.type)) loop++;
    ctx.scopes.set(node, scope); ctx.loopDepth.set(node, loop);
    if (node.type === 'VariableDeclarator') {
      let target = scope; const kind = parent.kind;
      if (kind === 'var') while (target.parent && target.kind !== 'function' && target.kind !== 'program') target = target.parent;
      for (const id of patternNames(node.id)) declare(target, id, node.id.type === 'Identifier' ? kind : 'pattern', node.id.type === 'Identifier' ? node.init : null);
    } else if (node.type === 'ImportDeclaration') {
      for (const spec of node.specifiers) declare(scope, spec.local, 'import', null, { module: node.source.value, imported: spec.type === 'ImportDefaultSpecifier' ? 'default' : spec.type === 'ImportNamespaceSpecifier' ? '*' : spec.imported.name ?? spec.imported.value });
    }
    const next = children(node); for (let i = next.length - 1; i >= 0; i--) stack.push({ node: next[i][1], scope, parent: node, key: next[i][0], depth: depth + 1, loop });
  }
  return ctx;
}
export function binding(ctx, id) {
  if (id?.type !== 'Identifier') return null;
  let s = ctx.scopes.get(id);
  for (let i = 0; s && i <= ctx.limits.astDepth; i++, s = s.parent) if (s.bindings.has(id.name)) return s.bindings.get(id.name);
  return null;
}
export function aliasRoot(ctx, expr, depth = 0, seen = new Set()) {
  if (depth > 32 || !expr) return null;
  if (expr.type === 'MemberExpression') return aliasRoot(ctx, expr.object, depth + 1, seen);
  if (expr.type !== 'Identifier') return null;
  const b = binding(ctx, expr); if (!b || seen.has(b)) return b; seen.add(b);
  if (b.kind === 'const' && b.init && !b.written && b.id.start < expr.start && b.init.type === 'Identifier') return aliasRoot(ctx, b.init, depth + 1, seen);
  return b;
}
function rootIdentifier(expr) { for (let i = 0; expr && i < 33; i++) { if (expr.type === 'Identifier') return expr; if (expr.type !== 'MemberExpression') return null; expr = expr.object; } return null; }
function capturedReferences(ctx, expr, callback, depth = 0) {
  if (!expr) return;
  if (++ctx.steps > ctx.limits.evaluationSteps || depth > 32) throw new Boundary('capture_budget');
  if (expr.type === 'Identifier' || expr.type === 'MemberExpression') { callback(expr); return; }
  const visit = child => capturedReferences(ctx, child, callback, depth + 1);
  if (expr.type === 'ObjectExpression') for (const p of expr.properties) visit(p.type === 'SpreadElement' ? p.argument : p.value);
  else if (expr.type === 'ArrayExpression') for (const e of expr.elements) visit(e);
  else if (expr.type === 'ConditionalExpression') { visit(expr.consequent); visit(expr.alternate); }
  else if (expr.type === 'LogicalExpression' || expr.type === 'BinaryExpression') { visit(expr.left); visit(expr.right); }
  else if (expr.type === 'SequenceExpression') for (const e of expr.expressions) visit(e);
  else if (expr.type === 'SpreadElement' || expr.type === 'AwaitExpression' || expr.type === 'YieldExpression') visit(expr.argument);
  else if (expr.type === 'ChainExpression') visit(expr.expression);
}
export function markMutations(ctx, property, host) {
  for (const n of ctx.nodes) {
    const targets = n.type === 'AssignmentExpression' ? [n.left] : n.type === 'UpdateExpression' || n.type === 'UnaryExpression' && n.operator === 'delete' ? [n.argument] : n.type === 'ForInStatement' || n.type === 'ForOfStatement' ? [n.left] : [];
    for (const target of targets) {
      for (const id of patternNames(target)) { const b = binding(ctx, id); if (b) b.written = true; else ctx.dirtyGlobals.add(id.name); }
    }
    if (n.type === 'WithStatement' || (n.type === 'CallExpression' || n.type === 'NewExpression') && n.callee.type === 'Identifier' && ['eval', 'Function'].includes(n.callee.name) && !binding(ctx, n.callee)) ctx.dynamicScope = true;
  }
  // A captured provider/DOM object enters a heap model we do not resolve.
  // Invalidate immediately, without guessing whether a container later escapes.
  let hostCaptureStart = Infinity;
  const capture = expr => capturedReferences(ctx, expr, ref => {
    const b = aliasRoot(ctx, ref); if (b?.kind === 'import') ctx.dirtyObjects.add(b);
    if (['document', 'window', 'element', 'range', 'shadow'].includes(host(ref))) hostCaptureStart = Math.min(hostCaptureStart, ref.start);
  });
  for (const n of ctx.nodes) {
    if (n.type === 'ObjectExpression') for (const p of n.properties) capture(p.type === 'SpreadElement' ? p.argument : p.value);
    else if (n.type === 'ArrayExpression') for (const e of n.elements) capture(e);
    else if (n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression') capture(n.right);
    else if (n.type === 'VariableDeclarator' && (ctx.parents.get(n).kind !== 'const' || n.id.type !== 'Identifier')) capture(n.init);
    else if (n.type === 'ReturnStatement' || n.type === 'YieldExpression') capture(n.argument);
    else if (n.type === 'ArrowFunctionExpression' && n.body.type !== 'BlockStatement') capture(n.body);
    else if (n.type === 'CallExpression' || n.type === 'NewExpression') for (const a of n.arguments) if (a.type === 'SpreadElement') capture(a.argument);
  }
  ctx.hostCaptureStart = hostCaptureStart;
  for (const n of ctx.nodes) {
    const target = n.type === 'AssignmentExpression' ? n.left : n.type === 'UpdateExpression' || n.type === 'UnaryExpression' && n.operator === 'delete' ? n.argument : null;
    if (target?.type === 'MemberExpression') {
      const b = aliasRoot(ctx, target.object); if (b) ctx.dirtyObjects.add(b);
      const id = rootIdentifier(target); const name = property(target);
      const critical = ['document', 'body', 'documentElement', 'ownerDocument', 'shadowRoot', 'parentElement', 'firstElementChild', 'lastElementChild', 'createElement', 'getElementById', 'querySelector', 'createRange', 'insertAdjacentHTML', 'createContextualFragment', 'setHTMLUnsafe', 'write', 'writeln', 'closest', 'attachShadow'];
      const h = host(target.object);
      if (critical.includes(name) && h === 'unknown' || ['__proto__', 'prototype'].includes(name)) ctx.hostUncertain = true;
      if (b && (name === null || critical.includes(name))) ctx.dirtyHostObjects.add(b);
      if ((h === 'document' || h === 'window') && (name === null || critical.includes(name))) ctx.dirtyGlobals.add('document');
      if (id && !binding(ctx, id) && ['document', 'window', 'globalThis'].includes(id.name) && !htmlProperties.has(name) && (name === null || ['document', 'body', 'documentElement', 'createElement', 'getElementById', 'querySelector', 'createRange', 'write', 'writeln'].includes(name))) ctx.dirtyGlobals.add('document');
    }
    if (n.type === 'CallExpression' || n.type === 'NewExpression') {
      const knownHostCall = n.callee.type === 'MemberExpression' && ['document', 'element', 'shadow', 'range'].includes(host(n.callee.object)) && ['createElement', 'getElementById', 'querySelector', 'createRange', 'insertAdjacentHTML', 'createContextualFragment', 'setHTMLUnsafe', 'write', 'writeln', 'closest', 'attachShadow'].includes(property(n.callee));
      for (const arg of n.arguments) {
        const b = aliasRoot(ctx, arg); if (b?.kind === 'import') ctx.dirtyObjects.add(b);
        if (!knownHostCall && ['document', 'window', 'element', 'range', 'shadow'].includes(host(arg))) ctx.hostUncertain = true;
      }
    }
  }
}
