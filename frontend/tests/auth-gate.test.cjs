const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function render(overrides = {}) {
  let requests = 0;
  const effects = [];
  const exports = {};
  const element = (type, props) => ({ type, props });
  const modules = {
    react: { useState: () => ['', () => {}], useRef: () => ({ current: false }), useEffect: effect => effects.push(effect) },
    'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'fragment' },
    '@/services/auth-session': { signIn: async () => { requests++; } },
  };
  const code = ts.transpileModule(fs.readFileSync('src/components/CentralAuthGate.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: name => modules[name] });
  const view = exports.default({ active: true, loading: false, authenticated: false, error: null, onSignOut: async () => {}, children: 'app-content', ...overrides });
  effects.forEach(effect => effect());
  return { view, requests };
}
test('signed-out entry opens Keycloak without mounting app/login content', () => {
  const { view, requests } = render();
  assert.equal(requests, 1);
  assert.equal(view.props.role, 'status');
});
test('an access denial displays recovery without another automatic login', () => {
  const { view, requests } = render({ error: 'Access denied' });
  assert.equal(requests, 0);
  assert.equal(view.type, 'main');
  assert.ok(JSON.stringify(view).includes('Retry access'));
  assert.ok(!JSON.stringify(view).includes('Sign in with Chiro Auth'));
});
test('logout/loading blocks another login even after local user clears', () => {
  const { view, requests } = render({ loading: true });
  assert.equal(requests, 0);
  assert.equal(view.props.role, 'status');
});
test('authenticated user sees the app', () => {
  const { view, requests } = render({ authenticated: true });
  assert.equal(requests, 0);
  assert.equal(view.props.children, 'app-content');
});
test('explicit local mode retains its own content', () => {
  const { view, requests } = render({ active: false });
  assert.equal(requests, 0);
  assert.equal(view.props.children, 'app-content');
});
