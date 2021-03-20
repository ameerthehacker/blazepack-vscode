const vscode = require('vscode');
const bp = require('blazepack');
const path = require('path');
const UI_MESSGAGES = require('./ui/src/constansts');

let activeBlazepackServer;

function activate(context) {
	let environment;
	const bpWebviewProvider = new BpDevServerWebViewProvider(context.extensionUri);
	// TODO: eventually we want to move this into a setting
	const DEV_SERVER_PORT = 3000;
	const isBpDevServerRunning = () => activeBlazepackServer && activeBlazepackServer.address();
	const startBpDevServer = async () => {
		if (isBpDevServerRunning()) {
			vscode.window.showErrorMessage(`Blazepack dev server is already running!`);

			return;
		}

		const workspaceFolders = vscode.workspace.workspaceFolders;

		if (workspaceFolders) {
			const directory = workspaceFolders[0].uri.path;

			try {
				environment = bp.utils.detectTemplate(directory);
				activeBlazepackServer = await bp.commands.startDevServer({ directory, port: DEV_SERVER_PORT });
				
				vscode.window.showInformationMessage(`⚡ Blazepack dev server running at ${DEV_SERVER_PORT}`);

				bpWebviewProvider.sendStartDevServer(environment);
			} catch (err) {
				vscode.window.showErrorMessage(err);
			}
		} else {
			vscode.window.showErrorMessage('Working folder not found, open a folder and try again');
		}
	}
	const stopBpDevServer = () => {
		if (!isBpDevServerRunning()) {
			vscode.window.showErrorMessage(`Blazepack dev server is not running!`);

			return;
		}

		activeBlazepackServer.close();

		bpWebviewProvider.sendStopDevServer();

		vscode.window.showInformationMessage("Blazepack dev server stopped!");
	}

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(BpDevServerWebViewProvider.viewType, bpWebviewProvider)
	);

	bpWebviewProvider.onLoad(() => {
		if (isBpDevServerRunning()) {
			bpWebviewProvider.sendStartDevServer(null);
		} else {
			bpWebviewProvider.sendStopDevServer();
		}
	});

	bpWebviewProvider.onStartDevServer(startBpDevServer);
	bpWebviewProvider.onStopDevServer(stopBpDevServer);

	let startDevServerDisposable = vscode.commands.registerCommand('blazepack.startDevServer', startBpDevServer);
	let stopDevServerDisposable = vscode.commands.registerCommand('blazepack.stopDevServer', stopBpDevServer);

	context.subscriptions.push(startDevServerDisposable);
	context.subscriptions.push(stopDevServerDisposable);
}

function deactivate() {
	if (activeBlazepackServer) {
		// clean up the dev server
		activeBlazepackServer.close();
	}
}

class BpDevServerWebViewProvider {
	static viewType = 'blazepack.devServer';

	constructor(extensionUri) { 
		this._extensionUri = extensionUri;
		this._view = null;
		this._onLoadFn = null;
		this._onStartDevServer = null;
		this._onStopDevServer = null;
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

		if (this._onLoadFn) {
			this._onLoadFn();
		}

		this._view.webview.onDidReceiveMessage((data) => {
			const { type } = data;

			switch (type) {
				case UI_MESSGAGES.START_DEV_SERVER: {
					if (this._onStartDevServer) {
						this._onStartDevServer();
					}

					break;
				}
				case UI_MESSGAGES.STOP_DEV_SERVER: {
					if (this._onStopDevServer) {
						this._onStopDevServer();
					}

					break;
				}
			}
		});
	}

	onStartDevServer(fn) {
		this._onStartDevServer = fn;
	}

	onStopDevServer(fn) {
		this._onStopDevServer = fn;
	}

	onLoad(fn) {
		this._onLoadFn = fn;
	}

	sendStartDevServer(environment) {
		if (this._view) {
			this._view.webview.postMessage({
				type: UI_MESSGAGES.START_DEV_SERVER,
				environment
			})
		}
	}

	sendStopDevServer() {
		if (this._view) {
			this._view.webview.postMessage({
				type: UI_MESSGAGES.STOP_DEV_SERVER
			})
		}
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
