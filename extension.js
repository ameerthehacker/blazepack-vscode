const vscode = require('vscode');
const bp = require('blazepack');
const path = require('path');

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
			enableScripts: true,
			localResourceRoots: [
				this._extensionUri
			]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
	}

	getExtension(filename) {
		const parts = filename.split('.');

		if (parts.length === 1) return null;
		else return parts[parts.length - 1];
	}

	_getHtmlForWebview(webview) {
		const nonce = getNonce();
		const manifest = require(path.join(this._extensionUri.fsPath, 'ui', 'build', 'asset-manifest.json'));
		const entryPoints = manifest['entrypoints'];
		const styles = entryPoints.filter(entryPoint => this.getExtension(entryPoint) === 'css')
															.map(style => {
																const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'ui', 'build', style));

																return `<link href="${styleUri}" rel="stylesheet">`
															}).join('\n');
		const scripts = entryPoints.filter(entryPoint => this.getExtension(entryPoint) === 'js')
															.map(script => {
																const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'ui', 'build', script));

																return `<script nonce="${nonce}" src="${scriptUri}"></script>`
															}).join('\n');

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				${styles}
				<title>Blazepack VSCode</title>
			</head>
			<body>
				<div id="root"></div>
				${scripts}
			</body>
			</html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

module.exports = {
	activate,
	deactivate
}
