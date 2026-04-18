# Kubernetes MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for Kubernetes cluster management.

## Requirements

- Node.js >= 18
- npm >= 9

## Getting Started

```bash
# Install dependencies
npm install

# Build
npm run build

# Run
npm start
```

## Development

```bash
# Watch mode (auto-recompile on changes)
npm run dev

# Lint
npm run lint

# Lint & auto-fix
npm run lint:fix
```

## Project Structure

```
src/
├── index.ts          # Server entry point
├── tools/
│   ├── index.ts      # Tool registry & dispatcher
│   └── ping.ts       # Example tool
└── resources/
    └── index.ts      # Resource registry & dispatcher
```

## Adding a New Tool

1. Create `src/tools/<your-tool>.ts` and export a `Tool` definition + handler function.
2. Register the tool in `src/tools/index.ts`.

## CI/CD

GitHub Actions runs on every push to `main` and on pull requests:

- Linting (`eslint`)
- TypeScript build (`tsc`)
- Tested against Node 18, 20, and 22

See [`.github/workflows/build.yml`](.github/workflows/build.yml).

## License

MIT
