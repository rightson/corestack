// Real in-memory PostgreSQL regression for email auth and impersonation flows.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const { drizzle } = require('drizzle-orm/pglite');
const orm = require('drizzle-orm');
const core = require('drizzle-orm/pg-core');

function load(file, imports) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    Date,
    console,
    require: (name) => {
      if (name in imports) return imports[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return exports;
}

(async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`
      CREATE TABLE users (
        id serial PRIMARY KEY, username varchar(255) UNIQUE NOT NULL,
        name varchar(255) NOT NULL, email varchar(255) UNIQUE NOT NULL,
        password varchar(255), auth_type varchar(50) NOT NULL DEFAULT 'email',
        must_change_password boolean DEFAULT false, created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL, last_login timestamp
      );
      CREATE TABLE groups (
        id serial PRIMARY KEY, name varchar(255) NOT NULL, description text,
        group_type varchar(50) NOT NULL, metadata jsonb,
        created_at timestamp DEFAULT now() NOT NULL, updated_at timestamp DEFAULT now() NOT NULL
      );
      CREATE TABLE group_members (
        id serial PRIMARY KEY, group_id integer NOT NULL, user_id integer NOT NULL,
        joined_at timestamp DEFAULT now() NOT NULL
      );
      CREATE TABLE impersonation_sessions (
        id serial PRIMARY KEY, admin_user_id integer NOT NULL, impersonated_user_id integer NOT NULL,
        session_token varchar(255) UNIQUE NOT NULL, reason text, ip_address varchar(45),
        user_agent text, is_active boolean DEFAULT true NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL, expires_at timestamp NOT NULL, ended_at timestamp
      );
    `);

    const schema = load('lib/db/schema.ts', { 'drizzle-orm/pg-core': core });
    const db = drizzle(pg);
    const noop = () => {};
    const logger = { debug: noop, info: noop, warn: noop, error: noop };

    const auth = load('lib/auth/service.ts', {
      '@/lib/db': { db },
      '@/lib/db/schema': schema,
      'drizzle-orm': orm,
      './password': {
        hashPassword: async (value) => `hash:${value}`,
        verifyPassword: async (value, hash) => hash === `hash:${value}`,
      },
      './ldap': { authenticateLDAP: async () => ({ success: false }) },
      './jwt': { signToken: async (payload) => `token:${payload.userId}` },
    });

    const [admin, target, outsider] = await db
      .insert(schema.users)
      .values([
        { username: 'admin', name: 'Admin', email: 'admin@test', password: 'hash:secret' },
        { username: 'target', name: 'Target', email: 'target@test' },
        { username: 'outsider', name: 'Outsider', email: 'outsider@test' },
      ])
      .returning();

    const authenticated = await auth.authenticateUser('admin', 'secret');
    assert.equal(authenticated.success, true);
    assert.equal(authenticated.token, `token:${admin.id}`);
    assert.equal((await auth.authenticateUser('admin', 'wrong')).success, false);
    assert.equal((await auth.authenticateUser('missing', 'secret')).success, false);
    assert.equal((await auth.changePassword(admin.id, 'next')).success, true);
    const [changed] = await db.select().from(schema.users).where(orm.eq(schema.users.id, admin.id));
    assert.equal(changed.password, 'hash:next');

    const [group] = await db
      .insert(schema.groups)
      .values({ name: 'super_admins', groupType: 'functional' })
      .returning();
    await db.insert(schema.groupMembers).values({ groupId: group.id, userId: admin.id });

    const impersonation = load('lib/rbac/impersonation-service.ts', {
      '@/lib/db': { db },
      '@/lib/db/schema': schema,
      'drizzle-orm': orm,
      './audit-service': { logAccessAttempt: noop },
      '@/lib/observability/logger': { createLogger: () => logger },
      crypto,
    });

    assert.equal(await impersonation.isSuperAdmin(admin.id), true);
    assert.equal(await impersonation.isSuperAdmin(outsider.id), false);
    assert.equal(await impersonation.canImpersonate(admin.id, target.id), true);
    assert.equal(await impersonation.canImpersonate(admin.id, admin.id), false);
    assert.equal(await impersonation.startImpersonation({
      adminUserId: outsider.id,
      impersonatedUserId: target.id,
    }), null);

    const session = await impersonation.startImpersonation({
      adminUserId: admin.id,
      impersonatedUserId: target.id,
      reason: 'support',
    });
    assert.ok(session);
    assert.equal((await impersonation.getImpersonationSession(session.sessionToken)).id, session.id);
    assert.equal(await impersonation.endImpersonation(session.sessionToken), true);
    assert.equal(await impersonation.getImpersonationSession(session.sessionToken), null);

    console.log('PASS: database-backed email auth, password change, and impersonation lifecycle');
  } finally {
    await pg.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
