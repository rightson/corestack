// In-memory PostgreSQL regression: no external DB or production data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const { drizzle } = require('drizzle-orm/pglite');
const orm = require('drizzle-orm');
const core = require('drizzle-orm/pg-core');
function load(file, imports) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  vm.runInNewContext(code, { exports, Date, Set, console, require: name => {
    if (name in imports) return imports[name];
    throw new Error('Unexpected dependency: ' + name);
  } });
  return exports;
}
(async () => {
  const pg = new PGlite();
  try {
    const schema = load('lib/db/schema.ts', { 'drizzle-orm/pg-core': core });
    const tableNames = ['permissions', 'roles', 'rolePermissions', 'userSystemRoles',
      'userProjectRoles', 'userGroupRoles', 'groupProjects', 'permissionCache'];
    // Match names and types; unrelated constraints are omitted from this fixture.
    for (const key of tableNames) {
      const config = core.getTableConfig(schema[key]);
      await pg.exec(`CREATE TABLE "${config.name}" (${config.columns.map(col =>
        `"${col.name}" ${col.getSQLType()}`).join(',')})`);
    }
    const db = drizzle(pg);
    const noop = () => {};
    const { checkPermission, checkMultiplePermissions } = load('lib/rbac/permission-checker.ts', {
      '@/lib/db': { db }, '@/lib/db/schema': schema, 'drizzle-orm': orm,
      './audit-service': { logPermissionGranted: noop, logPermissionDenied: noop },
      '@/lib/observability/logger': { createLogger: () => ({ debug: noop, info: noop, warn: noop, error: noop }) }
    });
    await db.insert(schema.permissions).values({ id: 1, name: 'project.read', isActive: true });
    await db.insert(schema.roles).values({ id: 1, name: 'reader', isActive: true });
    await db.insert(schema.rolePermissions).values({ roleId: 1, permissionId: 1 });
    await db.insert(schema.userGroupRoles).values({ userId: 7, groupId: 10, roleId: 1 });
    await db.insert(schema.groupProjects).values({ groupId: 10, projectId: 100 });
    assert.equal(await checkPermission({ userId: 7, permission: 'project.read', projectId: 100 }), true);
    assert.equal(await checkPermission({ userId: 7, permission: 'project.read', projectId: 200 }), false);
    assert.equal((await checkMultiplePermissions(7, ['project.read'], 200))['project.read'], false);
    await db.insert(schema.permissionCache).values({ userId: 7, permissionId: 1,
      projectId: 200, cacheKey: 'user:7:perm:project.read:project:200',
      hasPermission: true, expiresAt: new Date(Date.now() + 60000) });
    assert.equal(await checkPermission({ userId: 7, permission: 'project.read', projectId: 200, useCache: true }), false);
    await db.delete(schema.rolePermissions);
    assert.equal(await checkPermission({ userId: 7, permission: 'project.read', projectId: 100, useCache: true }), false);
    await db.insert(schema.rolePermissions).values({ roleId: 1, permissionId: 1 });
    await db.update(schema.userGroupRoles).set({ expiresAt: new Date('2000-01-01') });
    assert.equal(await checkPermission({ userId: 7, permission: 'project.read', projectId: 100 }), false);
    console.log('PASS: project isolation, batch isolation, stale-cache rejection, revocation, expired grants');
  } finally { await pg.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
