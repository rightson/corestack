# Bun Runtime Adoption

## Overview

This document outlines the strategy and considerations for adopting Bun as the JavaScript/TypeScript runtime for the lightweight-web-seed stack. Bun is a modern, fast, all-in-one JavaScript runtime that can significantly improve development experience, build times, and runtime performance.

**Implementation Status**: 🔴 Not Started (0% complete)

## What is Bun?

Bun is a fast, all-in-one JavaScript runtime designed as a drop-in replacement for Node.js. It includes:

- **Native TypeScript support** - Execute .ts files directly without compilation
- **Fast package manager** - 2-3x faster than npm
- **Built-in bundler** - No need for separate build tools for many use cases
- **Built-in test runner** - Integrated testing without additional dependencies
- **Better performance** - Faster startup times and lower memory usage than Node.js

## Benefits for This Stack

### 1. Configuration Simplification

**Current State:**
- Uses `tsx` for TypeScript execution (CLI, WebSocket server, Queue worker)
- Uses `npm` for package management
- Multiple separate tools for different purposes

**With Bun:**
- Native TypeScript execution without `tsx` dependency
- Integrated package manager, bundler, and test runner
- Reduced tooling complexity

**Estimated simplification**: ~10-15% reduction in configuration complexity

### 2. Performance Improvements

#### Package Management
- **Installation speed**: 2-3x faster than npm
- **Disk usage**: More efficient deduplication
- **Example**: Typical install time reduction from 30-60s → 10-20s

#### CLI Performance
- **Startup time**: 2-4x faster than Node.js + tsx
- **Current overhead**: ~100-200ms with tsx
- **With Bun**: ~10-30ms overhead
- **Impact**: CLI commands feel nearly instantaneous

#### Server Performance (WebSocket/Queue)
- **Startup time**: 50-100% faster
- **Runtime performance**: 10-30% improvement
- **Memory usage**: 20-40% reduction
- **Example**: WebSocket server using ~50MB might drop to ~30-40MB

#### Next.js Development
- **Mixed results**: Next.js 15 with Turbopack already optimized for Node.js
- **Compatibility**: Bun supports Next.js but Turbopack may require Node.js
- **Recommendation**: Keep Next.js on Node.js initially

### 3. Developer Experience

- **Faster iterations**: Quicker package installs and script execution
- **Simpler commands**: No need for tsx or other runtime wrappers
- **Built-in testing**: Integrated test runner compatible with Jest API
- **Better error messages**: More readable stack traces

## Adoption Strategy

### Phase 1: Non-Next.js Components (Recommended First Step)

**Scope**: CLI, WebSocket server, Queue worker, scripts

**Changes needed**:
```json
// package.json scripts
{
  "db:seed": "bun scripts/seed.ts",
  "ws:server": "bun server/websocket.ts",
  "queue:worker": "bun server/queue/worker.ts",
  "cli": "bun cli/index.ts"
}
```

**Benefits**:
- Immediate performance improvements
- Low risk (doesn't affect Next.js app)
- Easy to test and validate

**Estimated effort**: 1-2 hours

### Phase 2: Package Management

**Scope**: Replace npm with bun for package management

**Changes needed**:
```bash
# Install packages
bun install

# Add packages
bun add <package>

# Remove packages
bun remove <package>
```

**Benefits**:
- 2-3x faster installations
- Better disk usage
- Compatible with package.json

**Estimated effort**: 30 minutes

### Phase 3: Next.js Integration (Optional)

**Scope**: Run Next.js development server with Bun

**Considerations**:
- Turbopack may not work with Bun
- Need to test Next.js 15 compatibility thoroughly
- May need to disable Turbopack: `bun --bun next dev`

**Recommendation**: Wait for better Next.js + Bun + Turbopack integration

**Estimated effort**: 2-4 hours testing and validation

## Migration Steps

### Prerequisites

1. **Install Bun**:
```bash
# Linux/macOS
curl -fsSL https://bun.sh/install | bash

# Verify installation
bun --version
```

2. **Backup current setup**:
```bash
# Commit current state
git add .
git commit -m "Pre-Bun migration checkpoint"
```

### Step 1: Update Scripts (Phase 1)

1. **Update package.json**:
```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build --turbopack",
    "start": "next start",
    "lint": "eslint",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:seed": "bun scripts/seed.ts",
    "ws:server": "bun server/websocket.ts",
    "queue:worker": "bun server/queue/worker.ts",
    "cli": "bun cli/index.ts"
  }
}
```

2. **Test each component**:
```bash
# Test CLI
bun cli/index.ts user list

# Test WebSocket server
bun server/websocket.ts

# Test Queue worker
bun server/queue/worker.ts

# Test seed script
bun scripts/seed.ts
```

3. **Update CLI shebang** (optional):
```typescript
// cli/index.ts
#!/usr/bin/env bun
```

### Step 2: Migrate Package Management (Phase 2)

1. **Install dependencies with Bun**:
```bash
# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Install with Bun
bun install
```

2. **Verify installation**:
```bash
# Test that everything still works
bun run dev
bun run ws:server
bun run queue:worker
```

3. **Add bun.lockb to git**:
```bash
git add bun.lockb
git commit -m "Add Bun lockfile"
```

### Step 3: Update Documentation

1. **Update README.md prerequisites**:
```markdown
### Prerequisites
- Node.js 18+ (for Next.js) or Bun 1.0+
- Docker and Docker Compose
```

2. **Update installation instructions**:
```markdown
# Install with Bun (recommended)
bun install

# Or with npm
npm install
```

## Configuration Files

### Files that remain unchanged:
- `tsconfig.json` - Still needed for TypeScript language server
- `next.config.ts` - Next.js configuration
- `drizzle.config.ts` - Drizzle ORM configuration
- `eslint.config.mjs` - ESLint configuration
- `postcss.config.mjs` - PostCSS configuration
- `tailwindcss.config.js` - Tailwind configuration

### Dependencies to remove (after migration):
```bash
bun remove tsx
```

### Optional: Add bunfig.toml for Bun configuration:
```toml
# bunfig.toml (optional)
[install]
# Faster installs with global cache
cache = "~/.bun/install/cache"

# Enable lockfile
lockfile = true

# Auto install peer dependencies
auto = true
```

## Compatibility Checklist

### Fully Compatible ✅
- TypeScript execution
- WebSocket (ws package)
- PostgreSQL (postgres package)
- Redis (ioredis)
- BullMQ
- tRPC
- Commander (CLI)
- Drizzle ORM
- Zod
- Jose (JWT)
- bcryptjs

### Needs Testing ⚠️
- Next.js 15 with Bun runtime
- Turbopack with Bun
- LDAP authentication package
- ssh2 and node-ssh packages

### Known Issues
- **Turbopack**: Currently optimized for Node.js, may not work with Bun
- **Some native modules**: Occasional compatibility with C++ addons

## Performance Benchmarks

### Expected Improvements (Based on Typical Workloads)

| Component | Metric | Node.js + tsx | Bun | Improvement |
|-----------|--------|---------------|-----|-------------|
| CLI startup | Time | 150ms | 20ms | 7.5x faster |
| Package install | Time | 45s | 15s | 3x faster |
| WebSocket server | Startup | 800ms | 400ms | 2x faster |
| WebSocket server | Memory | 50MB | 35MB | 30% less |
| Queue worker | Startup | 1000ms | 500ms | 2x faster |
| Queue worker | Memory | 60MB | 40MB | 33% less |

**Note**: These are estimates based on typical Bun benchmarks. Actual results may vary.

## Rollback Plan

If issues arise, rolling back is straightforward:

1. **Revert package.json scripts**:
```bash
git checkout HEAD -- package.json
```

2. **Reinstall with npm**:
```bash
rm -rf node_modules bun.lockb
npm install
```

3. **Restore tsx dependency** (if removed):
```bash
npm install -D tsx
```

## Testing Strategy

### Unit Testing
1. Test CLI commands: `bun cli/index.ts user list`
2. Test WebSocket server startup and connections
3. Test Queue worker job processing
4. Test database operations with seed script

### Integration Testing
1. Run full development environment with Bun components
2. Test tRPC calls from CLI
3. Test WebSocket message passing
4. Test queue job creation and processing
5. Verify database migrations work correctly

### Load Testing
1. Benchmark CLI command execution times
2. Measure WebSocket server throughput
3. Monitor memory usage under load
4. Compare with Node.js baseline

## Troubleshooting

### Common Issues

**1. "command not found: bun"**
```bash
# Ensure Bun is in PATH
export PATH="$HOME/.bun/bin:$PATH"

# Add to ~/.bashrc or ~/.zshrc
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
```

**2. Package compatibility issues**
```bash
# Try with Node.js compatibility mode
bun --bun run script.ts

# Or fall back to Node.js for specific scripts
node --loader tsx script.ts
```

**3. TypeScript errors**
```bash
# Bun respects tsconfig.json
# Check that paths and settings are correct
bun tsc --noEmit
```

**4. Native module issues**
```bash
# Some packages may need Node.js
# Use hybrid approach: Bun for some components, Node for others
```

## Hybrid Approach (Recommended)

**Best practice**: Use Bun where it excels, keep Node.js where needed

### Use Bun for:
- ✅ CLI tools (`cli/`)
- ✅ Standalone scripts (`scripts/`)
- ✅ WebSocket server (`server/websocket.ts`)
- ✅ Queue worker (`server/queue/worker.ts`)
- ✅ Package management (`bun install`)

### Keep Node.js for:
- ✅ Next.js development server (with Turbopack)
- ✅ Next.js production server
- ⚠️ Components with native module issues (if any)

## Future Considerations

### When Next.js + Turbopack + Bun integration improves:
- Migrate Next.js development server to Bun
- Potentially remove Node.js dependency entirely
- Unified runtime across entire stack

### Bun-specific optimizations:
- Use Bun's built-in test runner (drop Jest/Vitest)
- Use Bun's built-in bundler for CLI distribution
- Leverage Bun APIs for file system operations
- Use Bun's built-in SQLite for local development (optional)

## Resources

- **Official Bun Documentation**: https://bun.sh/docs
- **Next.js with Bun**: https://bun.sh/guides/runtime/nextjs
- **Package Manager**: https://bun.sh/docs/cli/install
- **TypeScript Support**: https://bun.sh/docs/runtime/typescript
- **Compatibility**: https://bun.sh/docs/runtime/nodejs-apis

## Decision Matrix

| Factor | Weight | Node.js + tsx | Bun | Winner |
|--------|--------|---------------|-----|--------|
| CLI Performance | High | 3/5 | 5/5 | Bun |
| Server Performance | Medium | 3/5 | 4/5 | Bun |
| Memory Usage | Medium | 3/5 | 5/5 | Bun |
| Install Speed | High | 2/5 | 5/5 | Bun |
| Next.js Compatibility | High | 5/5 | 3/5 | Node.js |
| Ecosystem Maturity | High | 5/5 | 3/5 | Node.js |
| Developer Experience | Medium | 3/5 | 4/5 | Bun |

**Recommendation**: Hybrid approach - use Bun for CLI/scripts/workers, keep Node.js for Next.js

## Implementation Timeline

| Phase | Tasks | Estimated Time | Risk Level |
|-------|-------|----------------|------------|
| Phase 1 | Update scripts for CLI/WS/Queue | 2 hours | Low |
| Phase 2 | Migrate package management | 30 minutes | Low |
| Phase 3 | Testing and validation | 4 hours | Low |
| Phase 4 | Documentation updates | 1 hour | Low |
| Phase 5 | Next.js integration (optional) | 4 hours | Medium-High |

**Total estimated time (Phases 1-4)**: ~7.5 hours
**Total with Next.js integration**: ~11.5 hours

## Success Metrics

### Quantitative Metrics
- ✅ CLI startup time reduced by >50%
- ✅ Package installation time reduced by >50%
- ✅ Server memory usage reduced by >20%
- ✅ All existing tests pass
- ✅ No regression in functionality

### Qualitative Metrics
- ✅ Developer experience improved
- ✅ Faster development iteration
- ✅ Simpler tooling setup
- ✅ Team comfortable with Bun

## Conclusion

Bun offers significant performance improvements and simplified tooling for this stack, particularly for CLI tools, standalone scripts, and server components. The recommended hybrid approach provides immediate benefits while maintaining stability for the Next.js application.

**Next Steps**:
1. Review this document with the team
2. Install Bun in development environment
3. Start with Phase 1 (CLI/scripts/workers migration)
4. Measure and document actual performance improvements
5. Decide on Phase 3 (Next.js integration) based on results

**Implementation Status**: 🔴 Not Started (0% complete)

---

*Document Version: 1.0*
*Last Updated: 2025-10-22*
*Status: Design/Planning Phase*
