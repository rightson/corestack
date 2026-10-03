const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { z } = require('zod');
const seen = [];
const noop = () => {};
const moduleValue = { exports: {} };
const mocks = {
  '@/lib/observability/logger': { createLogger: () => ({ debug: noop, info: noop, error: noop }) },
  '@/lib/observability/metrics': {
    trpcRequestsTotal: { inc: noop }, trpcRequestDuration: { observe: noop },
  },
  '@/lib/rbac': { checkPermission: async (options) => {
    seen.push(options);
    return options.projectId === 100;
  } },
};
const code = ts.transpileModule(fs.readFileSync('lib/trpc/trpc.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    esModuleInterop: true },
}).outputText;
vm.runInNewContext(code, {
  module: moduleValue, exports: moduleValue.exports,
  require: (name) => mocks[name] || require(name), Date, console,
}, { filename: 'lib/trpc/trpc.ts' });
const { router, permissionProcedure } = moduleValue.exports;
const api = router({
  read: permissionProcedure('project.read')
    .input(z.object({ projectId: z.number() }))
    .query(({ input }) => input.projectId),
});
(async () => {
  const caller = api.createCaller({ user: { userId: 7 } });
  assert.equal(await caller.read({ projectId: 100 }), 100);
  assert.equal(seen[0].projectId, 100);
  await assert.rejects(caller.read({ projectId: 200 }), (error) => error.code === 'FORBIDDEN');
  const before = seen.length;
  await assert.rejects(caller.read({ projectId: '100' }), (error) => error.code === 'BAD_REQUEST');
  assert.equal(seen.length, before, 'malformed project scope never reaches authorization');
  await assert.rejects(api.createCaller({ user: null }).read({ projectId: 100 }),
    (error) => error.code === 'UNAUTHORIZED');
  console.log('PASS: real tRPC scope parsing, project denial, malformed input, authentication');
})().catch((error) => { console.error(error); process.exitCode = 1; });
