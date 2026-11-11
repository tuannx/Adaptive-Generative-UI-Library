---
"@aikitstudio/agul-mcp": minor
---

MCP Apps support: both tools now point to a `ui://agul/view.html` view (`_meta.ui.resourceUri`), served with the `text/html;profile=mcp-app` MIME type. Hosts that support MCP Apps (Claude, ChatGPT, VS Code and others) show the generated resources, pages and layout decisions instead of raw JSON. Clients without MCP Apps support see the same text result as before. Built on `@modelcontextprotocol/ext-apps` 1.7.5.
