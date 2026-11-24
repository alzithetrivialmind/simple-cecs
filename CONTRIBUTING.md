# Contributing

Thanks for helping improve CECS.

1. Open an issue first for larger changes, so the approach can be agreed on.
2. Follow the [quick start](README.md#quick-start) to run the app locally.
3. Read [AGENTS.md](AGENTS.md) for the project rules.
4. Before opening a pull request, run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm check:security
pnpm build
```

Never commit real company data, credentials, or `.env` files. Use fictional records in seeds, tests, and screenshots.

Please report security problems privately through GitHub's "Report a vulnerability" button, not in a public issue.
