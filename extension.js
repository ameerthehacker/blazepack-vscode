const vscode = require('vscode');
const bp = require('blazepack');

function activate(context) {
	const provider = new BpDevServerWebViewProvider(context.extensionUri);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(BpDevServerWebViewProvider.viewType, provider));

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

class BpDevServerWebViewProvider {
	static viewType = 'blazepack.devServer';

	constructor(extensionUri) { 
		this._extensionUri = extensionUri;
		this._view = null;
	}

	resolveWebviewView(webviewView, context, _token) {
		this._view = webviewView;

		webviewView.webview.options = {
			// Allow scripts in the webview
			// enableScripts: true,

			localResourceRoots: [
				this._extensionUri
			]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
	}

	_getHtmlForWebview(webview) {
		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<title>Cat Colors</title>
			</head>
			<body>
				<ul class="color-list">
				</ul>
				<button style="background: red;" class="add-color-button">Add Color</button>
			</body>
			</html>`;
	}
}

module.exports = {
	activate,
	deactivate
}
