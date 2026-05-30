import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { WorkspaceContext, formatWorkspaceContextForPrompt } from './workspaceContext';

describe('formatWorkspaceContextForPrompt', () => {
  it('returns empty string when no files or folders', () => {
    const ctx: WorkspaceContext = { workspaceName: 'my-app', folders: [], files: [] };
    assert.equal(formatWorkspaceContextForPrompt(ctx), '');
  });

  it('includes workspace name', () => {
    const ctx: WorkspaceContext = { workspaceName: 'vibe-learn', folders: ['src'], files: [] };
    assert.match(formatWorkspaceContextForPrompt(ctx), /vibe-learn/);
  });

  it('lists folders', () => {
    const ctx: WorkspaceContext = { workspaceName: 'app', folders: ['src', 'tests'], files: [] };
    const out = formatWorkspaceContextForPrompt(ctx);
    assert.match(out, /- src/);
    assert.match(out, /- tests/);
  });

  it('lists files', () => {
    const ctx: WorkspaceContext = { workspaceName: 'app', folders: [], files: ['package.json', 'README.md'] };
    const out = formatWorkspaceContextForPrompt(ctx);
    assert.match(out, /- package\.json/);
    assert.match(out, /- README\.md/);
  });

  it('includes the do-not-invent instruction', () => {
    const ctx: WorkspaceContext = { workspaceName: 'app', folders: ['src'], files: [] };
    assert.match(formatWorkspaceContextForPrompt(ctx), /Do not invent code/);
  });

  it('respects max 20 entry limit when caller enforces it', () => {
    // formatWorkspaceContextForPrompt renders whatever is passed; the cap is in getWorkspaceContext.
    // Verify it renders all entries passed without truncating.
    const folders = Array.from({ length: 10 }, (_, i) => `dir${i}`);
    const files = Array.from({ length: 10 }, (_, i) => `file${i}.ts`);
    const ctx: WorkspaceContext = { workspaceName: 'app', folders, files };
    const out = formatWorkspaceContextForPrompt(ctx);
    assert.match(out, /dir0/);
    assert.match(out, /file9\.ts/);
  });
});
