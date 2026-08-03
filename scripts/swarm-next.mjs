#!/usr/bin/env node
/**
 * Swarm next - picks the highest-priority unassigned open issue
 * Usage: npm run swarm:next
 */
import { execSync } from 'node:child_process';

const REPO = 'tuannx/Adaptive-Generative-UI-Library';
const PHASE_ORDER = [
  'phase:0-infra',
  'phase:1-library',
  'phase:2-agent-api',
  'phase:3-features',
  'phase:4-production',
];

function gh(cmd) {
  return execSync(`gh ${cmd}`, { encoding: 'utf8' }).trim();
}

try {
  const raw = gh(
    `issue list --repo ${REPO} --state open --label swarm --json number,title,labels,assignees,body --limit 100`,
  );
  const issues = JSON.parse(raw);

  const unassigned = issues.filter((i) => i.assignees.length === 0);
  if (unassigned.length === 0) {
    console.log('All swarm issues are assigned. Run: npm run swarm:status');
    process.exit(0);
  }

  unassigned.sort((a, b) => {
    const phaseA = PHASE_ORDER.indexOf(
      a.labels.find((l) => l.name.startsWith('phase:'))?.name ?? 'phase:99',
    );
    const phaseB = PHASE_ORDER.indexOf(
      b.labels.find((l) => l.name.startsWith('phase:'))?.name ?? 'phase:99',
    );
    return (phaseA === -1 ? 99 : phaseA) - (phaseB === -1 ? 99 : phaseB) || a.number - b.number;
  });

  const next = unassigned[0];
  const phase = next.labels.find((l) => l.name.startsWith('phase:'))?.name ?? 'unknown';

  console.log('\n🎯 Next Swarm Task\n');
  console.log(`Issue: #${next.number}`);
  console.log(`Phase: ${phase}`);
  console.log(`Title: ${next.title}`);
  console.log(`URL:   https://github.com/${REPO}/issues/${next.number}`);
  console.log('\n--- Agent Prompt ---\n');
  console.log(`Work on GitHub issue #${next.number}: ${next.title}`);
  console.log(`Branch: feat/issue-${next.number}-<short-slug>`);
  console.log('Steps:');
  console.log('  1. gh issue view <number> --comments');
  console.log('  2. Implement in smallest safe diff');
  console.log('  3. npm run build && npm run test');
  console.log('  4. gh pr create --title "fix: ..." --body "Closes #<number>"');
  console.log('');
} catch (err) {
  console.error('Failed to pick next task:', err.message);
  process.exit(1);
}
