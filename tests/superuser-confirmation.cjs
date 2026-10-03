// Run with: node tests/superuser-confirmation.cjs (no DB or terminal required).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const noop = () => {};
const logger = new Proxy({}, { get: () => noop });
const chalk = { red: text => text, green: text => text, bold: text => text };
function load(relative, imports) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    if (Object.hasOwn(imports, name)) return imports[name];
    throw new Error('Unexpected import: ' + name);
  }, process: { cwd: () => root, env: { DATABASE_URL: 'mock-only' }, exit: code => {
    throw new Error('Unexpected exit ' + code);
  } }, console: { log: noop } });
  return exports;
}
const validators = load('lib/manage/utils/validators.ts', { './platform.js': {} });
let inserts = 0;
const sql = async strings => {
  const query = strings.join('?');
  if (query.includes('information_schema')) return [{ exists: true }];
  if (query.includes('INSERT INTO users')) inserts++;
  return [];
};
sql.end = async () => {};
const command = load('lib/manage/commands/createsuperuser.ts', {
  fs: { existsSync: () => true }, path: { join: path.join }, chalk,
  ora: () => ({ start: () => ({ succeed: noop, fail: noop }) }),
  dotenv: { config: noop }, postgres: () => sql, bcryptjs: { hash: async () => 'mock-hash' },
  '../utils/logger.js': { logger }, '../utils/validators.js': validators,
  inquirer: { prompt: async questions => {
    const password = questions.find(q => q.name === 'password');
    const confirm = questions.find(q => q.name === 'passwordConfirm');
    // Inquirer 10 can call validation with only the input argument.
    assert.equal(typeof password.validate('short'), 'string');
    assert.equal(password.validate('Valid-Secret9!'), true);
    assert.equal(confirm.validate('Different-Secret9!'), 'Passwords do not match');
    assert.equal(confirm.validate('Valid-Secret9!'), true);
    // Rejected input must not replace the last accepted password.
    assert.equal(typeof password.validate('short'), 'string');
    assert.equal(confirm.validate('short'), 'Passwords do not match');
    assert.equal(confirm.validate('Valid-Secret9!'), true);
    return { username: 'admin', email: 'admin@example.test', password: 'Valid-Secret9!' };
  } }
});
command.createSuperuserCommand().then(() => {
  assert.equal(inserts, 1);
  console.log('PASS: input-only validation, mismatch rejection, accepted-password retention, user creation');
}).catch(error => { console.error(error); process.exitCode = 1; });
