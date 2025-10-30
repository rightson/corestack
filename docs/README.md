# Documentation

Welcome to the lightweight-web-seed documentation. This documentation is organized into three main categories to help you find what you need quickly.

## Directory Structure

```
docs/
├── evaluation/         # Research, proposals, and things being evaluated
├── features/          # Implemented features and usage guides
└── architecture/      # System architecture and design decisions
```

## 📊 Evaluation

**Path:** `evaluation/`

Documentation for features and technologies being researched, evaluated, or planned. These represent potential future directions that are not yet implemented.

**What you'll find here:**
- Technology evaluations and comparisons
- Adoption proposals and strategies
- Performance benchmarks and analysis
- Decision matrices
- Migration plans

**Example:**
- [Bun Adoption](./evaluation/BUN_ADOPTION.md) - Evaluation of Bun runtime for the stack

**When to add docs here:**
- When researching new technologies
- When proposing major changes
- When evaluating alternatives
- Before implementation begins

---

## ✨ Features

**Path:** `features/`

Documentation for implemented features and how to use them. These are production-ready features that are currently part of the application.

**What you'll find here:**
- Feature guides and tutorials
- API usage examples
- Configuration instructions
- Feature-specific implementation details
- How-to guides

**Examples:**
- [SSH Remote Operations](./features/SSH.md) - SSH feature with detailed subdocs
- [WebSocket](./features/WEBSOCKET.md) - Real-time communication guide
- [Task Queue](./features/TASK_QUEUE.md) - Background job processing
- [Authentication](./features/AUTHENTICATION.md) - Auth setup and usage
- [CLI](./features/CLI.md) - Command-line interface guide

**When to add docs here:**
- After implementing a feature
- When documenting feature usage
- When explaining how to configure a feature
- For user-facing documentation

---

## 🏗️ Architecture

**Path:** `architecture/`

System-level architecture documentation, design decisions, and technical reference materials that apply across the entire application.

**What you'll find here:**
- System architecture overviews
- Flow diagrams and sequences
- Database schema and design
- API reference documentation
- Development guides
- Deployment procedures

**Examples:**
- [Architecture Overview](./architecture/ARCHITECTURE.md) - System design and components
- [API Documentation](./architecture/API.md) - tRPC endpoints reference
- [Database Guide](./architecture/DATABASE.md) - Schema and queries
- [Development Guide](./architecture/DEVELOPMENT.md) - Dev setup and workflows
- [Deployment](./architecture/DEPLOYMENT.md) - Production deployment
- Flow diagrams: [Request Flow](./architecture/request-flow.md), [WebSocket Flow](./architecture/websocket-flow.md), [Job Flow](./architecture/job-flow.md), [Auth Flow](./architecture/auth-flow.md)

**When to add docs here:**
- When documenting system design
- When creating architectural diagrams
- When documenting cross-cutting concerns
- For technical reference materials
- When documenting deployment or infrastructure

---

## Quick Navigation

### For Developers
1. Start with [Architecture Overview](./architecture/ARCHITECTURE.md) to understand the system
2. Check [Development Guide](./architecture/DEVELOPMENT.md) for dev setup
3. Browse [Features](./features/) for specific feature documentation

### For Contributors
1. Review [Architecture](./architecture/) to understand the system design
2. Check [Evaluation](./evaluation/) to see what's being planned
3. Add new docs in the appropriate category

### For Evaluators
1. Check [Evaluation](./evaluation/) for research and proposals
2. Review decision matrices and benchmarks
3. Provide feedback on proposed changes

---

## Documentation Guidelines

### Choosing the Right Category

**Use `evaluation/` when:**
- The feature/technology is NOT yet implemented
- You're researching or proposing something new
- You need to document a decision-making process
- You're comparing alternatives

**Use `features/` when:**
- The feature IS implemented and working
- You're documenting how to use something
- You're writing user-facing documentation
- You're creating feature-specific guides

**Use `architecture/` when:**
- Documenting system-wide design
- Creating technical reference materials
- Documenting infrastructure or deployment
- Creating flow diagrams and architecture docs
- Writing development setup guides

### Moving Docs Between Categories

As features progress through their lifecycle:

1. **Research Phase** → `evaluation/`
   - Create proposal and evaluation docs

2. **Implementation Phase** → Keep in `evaluation/`
   - Update with implementation status

3. **Completed & Deployed** → Move to `features/`
   - Move the doc to `features/`
   - Update references
   - Archive evaluation docs or update with "Implemented - see features/"

### Cross-References

When referencing docs in other categories:
- From `features/` to `architecture/`: `../architecture/FILE.md`
- From `architecture/` to `features/`: `../features/FILE.md`
- From `evaluation/` to other categories: `../features/` or `../architecture/`

---

## Contributing to Documentation

### Adding New Documentation

1. **Determine the category** - Is it evaluation, feature, or architecture?
2. **Create the file** in the appropriate directory
3. **Update this README** if adding a major new section
4. **Update cross-references** in related documents
5. **Follow markdown best practices** - clear headings, code examples, diagrams where helpful

### Documentation Standards

- Use clear, descriptive headings
- Include code examples where appropriate
- Add links to related documentation
- Keep docs up-to-date as code changes
- Use diagrams for complex flows
- Include both "what" and "why"

### File Naming

- Use UPPERCASE for major docs: `ARCHITECTURE.md`, `SSH.md`
- Use lowercase with hyphens for flow/detail docs: `auth-flow.md`, `request-flow.md`
- Use descriptive names that indicate content
- Keep names concise but clear

---

## Getting Help

- **For feature usage questions**: Check `features/`
- **For system design questions**: Check `architecture/`
- **For proposed changes**: Check `evaluation/`
- **For development setup**: See [Development Guide](./architecture/DEVELOPMENT.md)

---

*Last Updated: 2025-10-30*
