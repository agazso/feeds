# Agent Guidelines

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
