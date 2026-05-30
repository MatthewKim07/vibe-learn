const MAX_ENTRIES = 20;

export interface WorkspaceContext {
  workspaceName: string;
  folders: string[];
  files: string[];
}

export async function getWorkspaceContext(): Promise<WorkspaceContext | null> {
  // Import vscode lazily so this module can be loaded in unit tests without the VS Code runtime.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const vscode = require('vscode');

  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return null;

  const root = folders[0];
  const workspaceName = root.name;

  const entries: [string, number][] = await vscode.workspace.fs.readDirectory(root.uri);

  const dirNames: string[] = [];
  const fileNames: string[] = [];

  for (const [name, type] of entries) {
    if (name.startsWith('.')) continue;
    if (type === 2 /* FileType.Directory */) {
      dirNames.push(name);
    } else {
      fileNames.push(name);
    }
    if (dirNames.length + fileNames.length >= MAX_ENTRIES) break;
  }

  return { workspaceName, folders: dirNames, files: fileNames };
}

export function formatWorkspaceContextForPrompt(ctx: WorkspaceContext): string {
  if (ctx.folders.length === 0 && ctx.files.length === 0) return '';

  const lines = ['## Workspace Context', `Workspace: ${ctx.workspaceName}`];

  if (ctx.folders.length > 0) {
    lines.push('', 'Folders:');
    ctx.folders.forEach((f) => lines.push(`- ${f}`));
  }

  if (ctx.files.length > 0) {
    lines.push('', 'Files:');
    ctx.files.forEach((f) => lines.push(`- ${f}`));
  }

  lines.push(
    '',
    'Use this only to make guidance more relevant. Do not assume implementation details. Do not invent code.'
  );

  return lines.join('\n');
}
