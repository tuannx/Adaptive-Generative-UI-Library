---
"@aikitstudio/agul-mcp": minor
---

Both tools now declare an `outputSchema` and return the generated config as `structuredContent`, so UI-capable hosts can read it without parsing text. The same JSON is still sent as a text block for older clients. Each tool now lives in its own file under `src/tools/`.
