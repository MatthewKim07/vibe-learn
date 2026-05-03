import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const openChat = vscode.commands.registerCommand('vibelearn.openChat', () => {
    vscode.window.showInformationMessage('VibeLearn chat coming soon.');
  });

  context.subscriptions.push(openChat);
}

export function deactivate() {}
