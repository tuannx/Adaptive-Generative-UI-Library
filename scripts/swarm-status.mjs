#!/usr/bin/env node
/**
 * Swarm status - shows open GitHub issues grouped by phase label
 * Usage: npm run swarm:status
 */
import { execSync } from 'node:child_process';

const REPO = 'tuannx/Adaptive-Generative-UI-Library';

function gh(cmd) {
  return execSync(`gh ${cmd}`, { encoding: 'utf8' }).trim();
}

try {
  const raw = gh(
    `issue list --repo ${REPO} --state open --json number,title,labels,assignees --limit 100`,
  );
  const issues = JSON.parse(raw);

  if (issues.length === 0) {
    console.log('No open swarm issues. Run swarm bootstrap or create issues from SWARM_ROADMAP.md');
    process.exit(0);
  }

  const byPhase = {};
  for (const issue of issues) {
    const phase = issue.labels.find((l) => l.name.startsWith('phase:'))?.name ?? 'phase:unlabeled';
    if (!byPhase[phase]) byPhase[phase] = [];
    byPhase[phase].push(issue);
  }

  console.log('\n🐝 AGUL Swarm Status\n');
  for (const [phase, items] of Object.entries(byPhase).sort()) {
    console.log(`## ${phase} (${items.length})`);
    for (const item of items) {
      const assignee = item.assignees[0]?.login ?? 'unassigned';
      console.log(`  #${item.number} [${assignee}] ${item.title}`);
    }
    console.log('');
  }

  const prs = JSON.parse(
    gh(`pr list --repo ${REPO} --state open --json number,title,headRefName --limit 20`),
  );
  if (prs.length > 0) {
    console.log('## Open PRs');
    for (const pr of prs) {
      console.log(`  #${pr.number} ${pr.title} (${pr.headRefName})`);
    }
  }
} catch (err) {
  console.error('Failed to fetch swarm status. Ensure gh CLI is authenticated.');
  console.error(err.message);
  process.exit(1);
}
