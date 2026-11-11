---
"@aikitstudio/agul-mcp": minor
---

`agul-mcp --http` serves MCP over Streamable HTTP at `http://127.0.0.1:3333/mcp` (stateless), for hosts that add servers by URL. It binds to this machine only by default and rejects Host headers other than localhost unless listed with `--allowed-host`. stdio stays the default. New exports: `startAGULHttpServer`, `startAGULStdioServer`.
