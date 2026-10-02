// SPDX-License-Identifier: MPL-2.0
import { property, host, value } from './values.mjs';
import { markMutations } from './scope.mjs';
import { emit, unknown } from './contracts.mjs';

const propertySinks = new Set(['innerHTML', 'outerHTML']);
const methodSinks = new Set(['insertAdjacentHTML', 'createContextualFragment', 'setHTMLUnsafe', 'write', 'writeln']);
function position(ctx, n) { return { source_id: ctx.id, line: n.loc.start.line, utf16_column: n.loc.start.column + 1, byte_offset: ctx.byteOffsets[n.start] }; }
function result(ctx, node, rule, status, reason, evidence = []) { emit(ctx.report, position(ctx, node), rule, status, reason, evidence.slice(0, 32).map(x => position(ctx, x))); }
function checkValue(ctx, node, rule, expr) {
  if (ctx.dynamicScope) { result(ctx, node, rule, 'OPEN', 'dynamic_scope_unresolved'); return; }
  if (ctx.loopDepth.get(node)) { result(ctx, node, rule, 'OPEN', 'loop_flow_unresolved'); return; }
  const v = value(ctx, expr);
  if (v.kind === 'static' || v.kind === 'sanitized') result(ctx, node, rule, 'PASS', v.kind === 'static' ? 'static_primitive_html_data' : 'asserted_import_sanitizer_contract', v.evidence);
  else result(ctx, node, rule, v.kind === 'unproven' ? 'FAIL' : 'OPEN', v.kind === 'unproven' ? 'html_safety_not_established' : v.reason, v.evidence);
}
function propertyAssignment(ctx, n) {
  const left = n.type === 'AssignmentExpression' ? n.left : n.argument;
  if (left.type !== 'MemberExpression') return;
  const p = property(ctx, left), h = host(ctx, left.object);
  if (h === 'ordinary') return;
  if (p === null) { result(ctx, n, 'html_property', 'OPEN', 'computed_property_unresolved'); return; }
  if (!propertySinks.has(p)) return;
  if (h !== 'element' && !(h === 'shadow' && p === 'innerHTML')) { result(ctx, n, p, 'OPEN', 'html_receiver_unresolved'); return; }
  if (n.type !== 'AssignmentExpression' || n.operator !== '=') { result(ctx, n, p, 'OPEN', 'compound_previous_value_unresolved'); return; }
  checkValue(ctx, n, p, n.right);
}
function methodCall(ctx, n) {
  const callee = n.callee;
  if (callee.type !== 'MemberExpression') return;
  const p = property(ctx, callee), h = host(ctx, callee.object);
  if (h === 'ordinary') return;
  if (p === null) { if (h !== 'unknown') result(ctx, n, 'html_method', 'OPEN', 'computed_method_unresolved'); return; }
  if (!methodSinks.has(p)) return;
  const permitted = p === 'write' || p === 'writeln' ? h === 'document' : p === 'createContextualFragment' ? h === 'range' : p === 'setHTMLUnsafe' ? h === 'element' || h === 'shadow' : h === 'element';
  if (!permitted) { result(ctx, n, p, 'OPEN', 'html_receiver_unresolved'); return; }
  if (n.optional || callee.optional) { result(ctx, n, p, 'OPEN', 'optional_sink_unresolved'); return; }
  if (n.arguments.some(x => x.type === 'SpreadElement') || n.arguments.length > 32) { result(ctx, n, p, 'OPEN', 'sink_argument_inventory_unresolved'); return; }
  if (p === 'write' || p === 'writeln') {
    if (!n.arguments.length) { result(ctx, n, p, 'PASS', 'empty_html_argument_inventory'); return; }
    for (const arg of n.arguments) checkValue(ctx, n, p, arg); return;
  }
  if (n.arguments.length !== (p === 'insertAdjacentHTML' ? 2 : 1)) { result(ctx, n, p, 'OPEN', 'sink_arity_unresolved'); return; }
  if (p === 'insertAdjacentHTML') {
    const pos = value(ctx, n.arguments[0]);
    if (pos.kind !== 'static' || typeof pos.value !== 'string' || !['beforebegin', 'afterbegin', 'beforeend', 'afterend'].includes(pos.value.toLowerCase())) { result(ctx, n, p, 'OPEN', 'adjacent_position_unresolved'); return; }
  }
  checkValue(ctx, n, p, n.arguments[p === 'insertAdjacentHTML' ? 1 : 0]);
}
export function analyze(ctx) {
  markMutations(ctx, m => property(ctx, m), expr => host(ctx, expr));
  if (ctx.options.sourceType === 'script' && ctx.ast.body[0]?.directive !== 'use strict' && ctx.nodes.some(n => n.type === 'FunctionDeclaration' && ctx.parents.get(n)?.type !== 'Program')) ctx.dynamicScope = true;
  if (ctx.dynamicScope) unknown(ctx.report, 'dynamic_scope_unresolved');
  if (ctx.hostUncertain) unknown(ctx.report, 'host_mutation_or_escape_unresolved');
  if (ctx.hostCaptureStart !== Infinity) unknown(ctx.report, 'host_heap_capture_unresolved');
  for (const n of ctx.nodes) {
    if (n.type === 'AssignmentExpression' || n.type === 'UpdateExpression') propertyAssignment(ctx, n);
    else if (n.type === 'CallExpression') methodCall(ctx, n);
    else if (n.type === 'ImportExpression') result(ctx, n, 'module_boundary', 'OPEN', 'dynamic_import_not_resolved');
    else if (n.type === 'MemberExpression') {
      const parent = ctx.parents.get(n), edge = ctx.edge.get(n);
      if (parent?.type === 'CallExpression' && edge === 'callee') continue;
      const p = property(ctx, n);
      if (methodSinks.has(p) && host(ctx, n.object) !== 'ordinary') result(ctx, n, p, 'OPEN', 'sink_function_value_unresolved');
    }
  }
}
