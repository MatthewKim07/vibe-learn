import * as vscode from 'vscode';
import { ChatViewProvider } from './chatViewProvider';

export function activate(context: vscode.ExtensionContext) {
  const provider = new ChatViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, provider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibelearn.openChat', () => {
      vscode.commands.executeCommand('vibelearn.chatView.focus');
    })
  );
}

export function deactivate() {}
