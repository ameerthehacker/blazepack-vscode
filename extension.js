const vscode = require('vscode');
const bp = require('blazepack');

function activate(context) {
	let disposable = vscode.commands.registerCommand('blazepack.startDevServer', async () => {
		const workspaceFolders = vscode.workspace.workspaceFolders;

		if (workspaceFolders) {
			const directory = workspaceFolders[0].uri.path;

			try {
				bp.commands.startDevServer({ directory, port: 3000 });
			} catch (err) {
				vscode.window.showErrorMessage(err);
			}
		} else {
			vscode.window.showErrorMessage('Working folder not found, open a folder an try again');
		}
	});

	context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}
