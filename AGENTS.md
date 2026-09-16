# Agent Guidelines

## Architecture

Before changing feed discovery, parsing, or post enrichment, read
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — it maps the core pipeline and lists
the non-obvious invariants (§5) that, when violated, cause regressions.

## Package Manager

This project uses **pnpm** (not npm or yarn). Always use `pnpm` commands:

- `pnpm install` - Install dependencies
- `pnpm add <package>` - Add a dependency
- `pnpm dev` - Run development server
- `pnpm build` - Build for production

## Design Principles

### No Counts or Numbers
The UI should not display counts or numerical indicators such as:
- Unread item counts
- Total item counts
- List lengths
- Badge numbers

These metrics are intentionally omitted to create a calmer, less anxiety-inducing experience. The focus should be on content consumption, not tracking completion.

## Code Style

- Prefer `const` over `let` whenever the variable is not reassigned

## Commits

- Conventional commits, lowercase, imperative: `fix: show share URL input on iOS Safari`.
- One commit per change — squash, don't stack fixups.
- Subject only. Add a body just when the *why* isn't obvious from the diff, and keep
  it to a few wrapped lines.
- No `Co-Authored-By`, no `Generated with Claude Code`, no session links, no emoji.

## Modules

- Use ESM `import`, not CommonJS `require` — in source, scripts, and ad-hoc
  verification snippets (e.g. `node --input-type=module -e "import { x } from './packages/core/dist/index.js'"`).
