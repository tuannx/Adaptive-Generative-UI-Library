#!/usr/bin/env node
/**
 * Bootstrap swarm GitHub issues from SWARM_ROADMAP.md phases
 * Usage: node scripts/swarm-bootstrap.mjs
 */
import { execSync } from 'node:child_process';

const REPO = 'tuannx/Adaptive-Generative-UI-Library';

const TASKS = [
  {
    phase: 'phase:1-library',
    title: 'Publish @agul/core and @agul/react to npm',
    body: `## Goal
Make packages installable via npm with proper exports and peer deps.

## Acceptance
- [ ] \`main\`, \`module\`, \`types\`, \`exports\` fields validated
- [ ] Changesets or release workflow
- [ ] README install instructions work

## Ship-Validate
Ship: npm publish config. Validate: fresh \`npm create vite\` app imports @agul/react.`,
  },
  {
    phase: 'phase:2-agent-api',
    title: 'Agent MCP tool: generate_ui_from_openapi',
    body: `## Goal
Expose AGUL as MCP tool so LLM agents can generate UI from OpenAPI spec.

## Acceptance
- [ ] MCP server package or Cloudflare Worker endpoint
- [ ] Tool accepts OpenAPI JSON, returns embeddable config or preview URL
- [ ] Documented in AGENTS.md

## Ship-Validate
Ship: MCP tool. Validate: one agent session builds UI from Petstore spec.`,
  },
  {
    phase: 'phase:2-agent-api',
    title: 'JSON Schema input (non-OpenAPI) for Agent UI generation',
    body: `## Goal
Allow agents to pass plain JSON Schema without full OpenAPI wrapper.

## Acceptance
- [ ] \`AGULRenderer\` accepts \`jsonSchema\` prop
- [ ] Form/list generation from schema alone
- [ ] Tests for schema-only path`,
  },
  {
    phase: 'phase:3-features',
    title: 'API-backed pagination, search, and filter in ListView',
    body: `## Goal
Support OpenAPI query params for page, limit, search.

## Acceptance
- [ ] Detect common pagination params (page, offset, limit)
- [ ] Search input wired to query param
- [ ] Works with Petstore + JSONPlaceholder`,
  },
  {
    phase: 'phase:3-features',
    title: 'Authentication interceptor (JWT/Bearer)',
    body: `## Goal
Configurable auth for generated UI API calls.

## Acceptance
- [ ] \`AGULRenderer\` \`getAuthHeaders\` or \`token\` prop
- [ ] Axios interceptor in shared module
- [ ] Demo with mock token`,
  },
  {
    phase: 'phase:4-production',
    title: 'Plugin system for custom field renderers',
    body: `## Goal
Agents can register custom components for specific schema types.

## Acceptance
- [ ] \`AGULRenderer\` \`plugins\` prop
- [ ] FormView uses plugin registry
- [ ] Example: image upload field plugin`,
  },
  {
    phase: 'phase:4-production',
    title: 'E2E tests with Playwright for demo app',
    body: `## Goal
Regression safety for CRUD flows.

## Acceptance
- [ ] Playwright in CI
- [ ] Petstore list → detail → create flow
- [ ] Screenshots on failure`,
  },
];

function gh(cmd) {
  return execSync(`gh ${cmd}`, { encoding: 'utf8' }).trim();
}

function ensureLabels() {
  const labels = [
    'swarm',
    'phase:0-infra',
    'phase:1-library',
    'phase:2-agent-api',
    'phase:3-features',
    'phase:4-production',
  ];
  for (const name of labels) {
    try {
      gh(`label create "${name}" --repo ${REPO} --color EDEDED --force`);
    } catch {
      // label exists
    }
  }
}

function issueExists(title) {
  const raw = gh(`issue list --repo ${REPO} --state all --json title --limit 200`);
  return JSON.parse(raw).some((i) => i.title === title);
}

ensureLabels();

let created = 0;
for (const task of TASKS) {
  if (issueExists(task.title)) {
    console.log(`Skip (exists): ${task.title}`);
    continue;
  }
  const body = task.body.replace(/"/g, '\\"');
  gh(
    `issue create --repo ${REPO} --title "${task.title}" --body "${body}" --label swarm --label ${task.phase}`,
  );
  console.log(`Created: ${task.title}`);
  created++;
}

console.log(`\nDone. Created ${created} issues. Run: npm run swarm:status`);
