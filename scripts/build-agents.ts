#!/usr/bin/env npx ts-node

/**
 * Build script for generating AGENTS.md from individual rule files
 *
 * Usage: npx ts-node scripts/build-agents.ts
 *
 * This script:
 * 1. Reads all rule files from the rules/ directory
 * 2. Parses YAML frontmatter for metadata
 * 3. Groups rules by category based on filename prefix
 * 4. Generates a consolidated AGENTS.md file
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Category definitions with ordering and metadata
const CATEGORIES = [
  { prefix: 'arch-', name: 'Architecture', impact: 'CRITICAL', section: 1 },
  { prefix: 'di-', name: 'Dependency Injection', impact: 'CRITICAL', section: 2 },
  { prefix: 'error-', name: 'Error Handling', impact: 'HIGH', section: 3 },
  { prefix: 'security-', name: 'Security', impact: 'HIGH', section: 4 },
  { prefix: 'perf-', name: 'Performance', impact: 'HIGH', section: 5 },
  { prefix: 'test-', name: 'Testing', impact: 'MEDIUM-HIGH', section: 6 },
  { prefix: 'db-', name: 'Database & ORM', impact: 'MEDIUM-HIGH', section: 7 },
  { prefix: 'api-', name: 'API Design', impact: 'MEDIUM', section: 8 },
  { prefix: 'micro-', name: 'Microservices', impact: 'MEDIUM', section: 9 },
  { prefix: 'devops-', name: 'DevOps & Deployment', impact: 'LOW-MEDIUM', section: 10 },
  { prefix: 'ddd-', name: 'Domain-Driven Design & Modular Monolith', impact: 'MEDIUM-HIGH', section: 11 },
];

interface RuleFrontmatter {
  title: string;
  impact: string;
  impactDescription: string;
  tags: string[];
}

interface Rule {
  filename: string;
  frontmatter: RuleFrontmatter;
  content: string;
  category: string;
  categorySection: number;
}

function parseFrontmatter(content: string): { frontmatter: RuleFrontmatter | null; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: null, body: content };
  }

  const frontmatterStr = match[1];
  const body = match[2];

  // Simple YAML parsing for our expected format
  const frontmatter: Partial<RuleFrontmatter> = {};
  const lines = frontmatterStr.split('\n');
  let currentKey = '';
  let inArray = false;
  const arrayItems: string[] = [];

  for (const line of lines) {
    if (line.match(/^[a-zA-Z]+:/)) {
      // Save previous array if we were collecting one
      if (inArray && currentKey === 'tags') {
        frontmatter.tags = arrayItems;
      }
      inArray = false;
      arrayItems.length = 0;

      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();
      currentKey = key.trim();

      if (value === '') {
        // Might be start of array
        inArray = true;
      } else {
        (frontmatter as any)[currentKey] = value;
      }
    } else if (inArray && line.trim().startsWith('-')) {
      arrayItems.push(line.trim().replace(/^-\s*/, ''));
    }
  }

  // Save final array if needed
  if (inArray && currentKey === 'tags') {
    frontmatter.tags = arrayItems;
  }

  return {
    frontmatter: frontmatter as RuleFrontmatter,
    body: body.trim()
  };
}

function getCategoryForFile(filename: string): { name: string; section: number } | null {
  for (const cat of CATEGORIES) {
    if (filename.startsWith(cat.prefix)) {
      return { name: cat.name, section: cat.section };
    }
  }
  return null;
}

function readMetadata(): any {
  const metadataPath = path.join(__dirname, '..', 'metadata.json');
  return JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
}

function readRules(): Rule[] {
  const rulesDir = path.join(__dirname, '..', 'skills', 'nestjs-best-practices', 'rules');
  const files = fs.readdirSync(rulesDir)
    .filter(f => f.endsWith('.md') && !f.startsWith('_'));

  const rules: Rule[] = [];

  for (const file of files) {
    const filePath = path.join(rulesDir, file);
    // Normalize CRLF so frontmatter parsing works on Windows checkouts
    const content = fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');
    const { frontmatter, body } = parseFrontmatter(content);

    if (!frontmatter) {
      console.warn(`Warning: No frontmatter found in ${file}`);
      continue;
    }

    const category = getCategoryForFile(file);
    if (!category) {
      console.warn(`Warning: Unknown category for ${file}`);
      continue;
    }

    rules.push({
      filename: file,
      frontmatter,
      content: body,
      category: category.name,
      categorySection: category.section
    });
  }

  return rules;
}

// AGENTS.md is loaded into an agent's context on every session, so it stays a
// short index. Full explanations and code examples live in the rule files.
const RULES_PATH = 'skills/nestjs-best-practices/rules';
const MAX_AGENTS_LINES = 500;

const CATEGORY_NOTES: Record<string, string> = {
  'Domain-Driven Design & Modular Monolith':
    'Opt-in. Use only for modular monoliths with real business rules. Skip for simple CRUD apps.',
};

function generateAgentsMd(rules: Rule[], metadata: any): string {
  // Group rules by category
  const rulesByCategory = new Map<string, Rule[]>();

  for (const rule of rules) {
    if (!rulesByCategory.has(rule.category)) {
      rulesByCategory.set(rule.category, []);
    }
    rulesByCategory.get(rule.category)!.push(rule);
  }

  // Sort rules within each category alphabetically
  for (const [category, categoryRules] of rulesByCategory) {
    categoryRules.sort((a, b) => a.filename.localeCompare(b.filename));
  }

  // Build document
  let doc = `# NestJS Best Practices

Version ${metadata.version} · ${rules.length} rules in ${rulesByCategory.size} sections · generated by \`scripts/build-agents.ts\`, do not edit by hand.

## How to use this file

This is an index. Each line below is one rule: what to do, why it matters, and the file with full wrong/right code examples.

1. Find the rules that match the code you are writing, reviewing, or refactoring.
2. Open the linked rule file and follow its **Correct** example.
3. Sections are ordered by impact. When rules conflict, the higher section wins.
4. Do not load every rule file at once. Read only the ones you need.

`;

  for (const cat of CATEGORIES) {
    const categoryRules = rulesByCategory.get(cat.name);
    if (!categoryRules || categoryRules.length === 0) continue;

    doc += `## ${cat.section}. ${cat.name} (${cat.impact})\n\n`;
    const note = CATEGORY_NOTES[cat.name];
    if (note) doc += `${note}\n\n`;

    for (const rule of categoryRules) {
      const why = (rule.frontmatter.impactDescription || '').replace(/^"|"$/g, '');
      doc += `- **${rule.frontmatter.title}** — ${why}. [\`${rule.filename}\`](${RULES_PATH}/${rule.filename})\n`;
    }
    doc += '\n';
  }

  doc += `## Learn skills (separate)

\`skills/nestjs-learn-*\` are three separate skills for learning NestJS by typing your own app: \`nestjs-learn-pick-task\` (scan the app, offer 3 tasks), \`nestjs-learn-write-lesson\` (build and prove the solution in a Git worktree, write the lesson), and \`nestjs-learn-coach\` (done / stuck / check / ship). They are not part of this index and use the rules above only as a code-quality source.

Each learn skill folder is self-contained. Six files are copied into each one's \`references/\`: \`hard-rules.md\`, \`layout.md\`, \`project-config.md\`, \`code-quality.md\`, \`review-rules.md\`, \`voice.md\`. Change all three copies together.

## Contributing

Edit or add files in \`${RULES_PATH}/\` (see \`_template.md\` and \`_sections.md\`), then run \`npm run build\` in \`scripts/\` to regenerate this file.

## References

`;
  for (const ref of metadata.references) {
    doc += `- ${ref}\n`;
  }

  return doc;
}

function main() {
  console.log('Building AGENTS.md...\n');

  const metadata = readMetadata();
  console.log(`Version: ${metadata.version}`);
  console.log(`Organization: ${metadata.organization}\n`);

  const rules = readRules();
  console.log(`Found ${rules.length} rules\n`);

  // Count by category
  const counts = new Map<string, number>();
  for (const rule of rules) {
    counts.set(rule.category, (counts.get(rule.category) || 0) + 1);
  }

  console.log('Rules by category:');
  for (const cat of CATEGORIES) {
    const count = counts.get(cat.name) || 0;
    if (count > 0) {
      console.log(`  ${cat.name}: ${count}`);
    }
  }
  console.log('');

  const agentsMd = generateAgentsMd(rules, metadata);

  const outputPath = path.join(__dirname, '..', 'AGENTS.md');
  fs.writeFileSync(outputPath, agentsMd);

  const lineCount = agentsMd.split('\n').length;
  if (lineCount > MAX_AGENTS_LINES) {
    console.warn(`Warning: AGENTS.md has ${lineCount} lines (limit ${MAX_AGENTS_LINES}). Keep it an index.`);
  }

  console.log(`Generated AGENTS.md (${lineCount} lines, ${agentsMd.length} bytes)`);
  console.log(`Output: ${outputPath}`);
}

main();
