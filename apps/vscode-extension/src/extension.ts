import * as vscode from "vscode";

function apiUrl(): string {
  return (
    vscode.workspace.getConfiguration("vane").get<string>("apiUrl") ?? "http://localhost:4000"
  );
}

async function postChat(question: string): Promise<string> {
  const res = await fetch(`${apiUrl()}/v1/debug/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = (await res.json()) as { answer: string };
  return json.answer;
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("vane.explainCallPath", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const sel = editor.document.getText(editor.selection) || editor.document.lineAt(editor.selection.active.line).text;
      const answer = await postChat(
        `Explain this call path from the open file ${editor.document.fileName}:\n${sel}`,
      );
      const doc = await vscode.workspace.openTextDocument({ content: answer, language: "markdown" });
      await vscode.window.showTextDocument(doc, { preview: true });
    }),

    vscode.commands.registerCommand("vane.addChainSupport", async () => {
      const chain = await vscode.window.showQuickPick(
        [
          { label: "Robinhood Chain", description: "4663" },
          { label: "Ethereum", description: "1" },
          { label: "Base", description: "8453" },
        ],
        { placeHolder: "Add chain support stub to workspace" },
      );
      if (!chain) return;
      const snippet = [
        `// Vane — chain config stub`,
        `export const chain = {`,
        `  id: ${chain.description},`,
        `  name: "${chain.label}",`,
        `  rpcEnv: "RPC_URL_${chain.description}",`,
        `};`,
      ].join("\n");
      const doc = await vscode.workspace.openTextDocument({ content: snippet, language: "typescript" });
      await vscode.window.showTextDocument(doc);
    }),

    vscode.commands.registerCommand("vane.generateDeployManifest", async () => {
      const name = await vscode.window.showInputBox({ prompt: "Contract name" });
      if (!name) return;
      const manifest = {
        name,
        chains: [4663],
        simulateBeforeLive: true,
        liveEnabled: false,
        ownershipChecks: true,
        note: "Phase 2 deploy assist — user signs externally in Phase 3",
      };
      const doc = await vscode.workspace.openTextDocument({
        content: JSON.stringify(manifest, null, 2),
        language: "json",
      });
      await vscode.window.showTextDocument(doc);
    }),

    vscode.commands.registerCommand("vane.inspectSelection", async () => {
      const editor = vscode.window.activeTextEditor;
      const text = editor?.document.getText(editor.selection) ?? "";
      const answer = await postChat(text || "What is in this project?");
      void vscode.window.showInformationMessage(answer.slice(0, 200));
    }),
  );
}

export function deactivate() {}
