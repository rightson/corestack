# RBAC Test Suite

This directory contains comprehensive tests for the Role-Based Access Control (RBAC) system.

## Test Files

### 1. `permission-checker.test.ts`
Tests for core permission checking logic:
- ✅ Permission granting when user has role
- ✅ Permission denial when user lacks role
- ✅ Non-existent permission handling
- ✅ Permission caching functionality
- ✅ Project-scoped permissions
- ✅ Multiple permission checking
- ✅ Cache invalidation
- ✅ Edge cases (non-existent users, empty strings, null values)

### 2. `impersonation.test.ts`
Tests for user impersonation functionality:
- ✅ Super admin identification
- ✅ Impersonation session creation
- ✅ Permission checks for non-super admins
- ✅ Self-impersonation prevention
- ✅ Non-existent user impersonation prevention
- ✅ Session expiration
- ✅ Ending previous sessions
- ✅ Session retrieval
- ✅ Auto-expiration of timed-out sessions
- ✅ Audit trail logging

### 3. `integration.test.ts`
End-to-end integration tests:
- ✅ Complete permission lifecycle (create → assign → check → revoke)
- ✅ Project-scoped permission isolation
- ✅ Group-based permission grants
- ✅ Permission hierarchy (system + project + group)
- ✅ Super admin impersonation workflow
- ✅ Permission caching and invalidation

## Running Tests

### Prerequisites

1. Install Jest and TypeScript testing dependencies:
```bash
npm install --save-dev jest @jest/globals @types/jest ts-jest
```

2. Create `jest.config.js`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'lib/rbac/**/*.ts',
    '!lib/rbac/examples.ts',
    '!lib/rbac/types.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

3. Update `package.json` scripts:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:rbac": "jest __tests__/rbac"
  }
}
```

### Running Tests

```bash
# Run all tests
npm test

# Run only RBAC tests
npm run test:rbac

# Run with coverage
npm run test:coverage

# Watch mode (for development)
npm run test:watch
```

## Test Database Setup

These tests require a test database. You have two options:

### Option 1: Separate Test Database
Create a separate database for testing:

```bash
# Create test database
createdb corestack_test

# Set environment variable
export DATABASE_URL_TEST="postgresql://user:password@localhost:5432/corestack_test"
```

### Option 2: Use Docker for Tests
```bash
# Start test database
docker run -d \
  --name corestack-test-db \
  -e POSTGRES_PASSWORD=testpassword \
  -e POSTGRES_DB=corestack_test \
  -p 5433:5432 \
  postgres:16

export DATABASE_URL_TEST="postgresql://postgres:testpassword@localhost:5433/corestack_test"
```

## Test Coverage

Run tests with coverage to ensure all code paths are tested:

```bash
npm run test:coverage
```

Expected coverage:
- **Statements**: > 80%
- **Branches**: > 80%
- **Functions**: > 80%
- **Lines**: > 80%

## Writing New Tests

### Test Structure
```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('Feature Name', () => {
  beforeEach(async () => {
    // Set up test data
  });

  afterEach(async () => {
    // Clean up test data
  });

  it('should do something specific', async () => {
    // Arrange
    const input = setupTestData();

    // Act
    const result = await functionUnderTest(input);

    // Assert
    expect(result).toBe(expected);
  });
});
```

### Best Practices

1. **Isolation**: Each test should be independent
2. **Clean Up**: Always clean up test data in `afterEach`
3. **Descriptive Names**: Use clear, descriptive test names
4. **AAA Pattern**: Arrange, Act, Assert
5. **One Assertion**: Test one thing per test when possible
6. **Edge Cases**: Test boundary conditions and error cases

## Manual Testing Checklist

If automated tests aren't set up yet, use this checklist:

### Permission Checker
- [ ] User with role has permission
- [ ] User without role doesn't have permission
- [ ] Non-existent permission returns false
- [ ] Project-scoped permissions work correctly
- [ ] Multiple permissions checked in batch
- [ ] Cache stores and retrieves correctly
- [ ] Cache invalidation works

### Impersonation
- [ ] Super admin can start impersonation
- [ ] Non-super admin cannot start impersonation
- [ ] Cannot impersonate self
- [ ] Cannot impersonate non-existent user
- [ ] Session expires after timeout
- [ ] Previous sessions end when starting new one
- [ ] Session can be ended manually
- [ ] Audit logs created for all operations

### Integration
- [ ] Complete workflow: create perm → create role → assign → check
- [ ] Project permissions isolated correctly
- [ ] Group permissions work
- [ ] Multiple roles grant multiple permissions
- [ ] Revoking role removes permission

## Troubleshooting

### Tests fail with database connection errors
- Ensure test database is running
- Check `DATABASE_URL_TEST` environment variable
- Run migrations on test database

### Tests fail with "table does not exist"
```bash
# Run migrations on test database
DATABASE_URL=$DATABASE_URL_TEST npm run db:push
```

### Tests are slow
- Use in-memory database for tests
- Mock database calls for unit tests
- Use transactions that rollback after each test

## CI/CD Integration

Add to `.github/workflows/test.yml`:
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: testpassword
          POSTGRES_DB: corestack_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:coverage
        env:
          DATABASE_URL_TEST: postgresql://postgres:testpassword@localhost:5432/corestack_test
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Test-Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
