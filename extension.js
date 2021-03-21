const vscode = require('vscode');
const bp = require('blazepack');
const UI_MESSGAGES = require('./ui/src/constansts');
const path = require('path');

let activeBlazepackServer;

function activate(context) {
	let environment;
	const bpWebviewProvider = new BpDevServerWebViewProvider(context.extensionUri);
	// TODO: eventually we want to move this into a setting
	const DEV_SERVER_PORT = 3000;
	const isBpDevServerRunning = () => activeBlazepackServer && activeBlazepackServer.address();
	const selectDirectory = async() => {
		const folderUris = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			title: "Select where to create new project"
		});

		return folderUris && folderUris[0] && folderUris[0].fsPath;
	}
	const openDirectory = (directory) => {
		let uri = vscode.Uri.parse(`file://${directory}`);

		vscode.commands.executeCommand('vscode.openFolder', uri);
	}
	const selectProjectTemplate = async () => {
		const availableTemplates = Object.keys(bp.constants.TEMPLATES);

		return await vscode.window.showQuickPick(
			availableTemplates,
			{
				canPickMany: false,
				placeHolder: "Select the project template"
			}
		);
	}
	const getProjectName = async () => {
		return await vscode.window.showInputBox({
			prompt: "Entern the project name",
			placeHolder: "eg: my-react-app",
		});
	}
	const selectWorkspaceFolder = async () => {
		const workspaces = vscode.workspace.workspaceFolders;
		let selectedWorkspace;

		if (workspaces) {
			if (workspaces.length == 1) {
				selectedWorkspace = workspaces[0];
			} else {
				const availableWorkspaces = workspaces.map(
					workspace => workspace.name
				);
				const result = await vscode.window.showQuickPick(
					availableWorkspaces,
					{
						canPickMany: false,
						placeHolder: "Select the project to run Blazepack dev server"
					}
				);

				if (result) {
					selectedWorkspace = workspaces.find(
						workspace => workspace.name == result
					);
				}
			}
		}

		return selectedWorkspace;
	}
	const startBpDevServer = async () => {
		if (isBpDevServerRunning()) {
			vscode.window.showErrorMessage(`Blazepack dev server is already running!`);

			return;
		}

		const workspaceFolder = await selectWorkspaceFolder();

		if (workspaceFolder) {
			const directory = workspaceFolder.uri.path;

			try {
				environment = bp.utils.detectTemplate(directory);
				bp.commands.startDevServer({ directory, port: DEV_SERVER_PORT, onSuccess: (server) => {
					activeBlazepackServer = server;

					vscode.window.showInformationMessage(`⚡ Blazepack dev server running at ${DEV_SERVER_PORT}`);

					bpWebviewProvider.sendStartDevServer(environment);
				}, onError: (err) => {
					// something went wrong after starting the devserver
					vscode.window.showErrorMessage(err);

					bpWebviewProvider.sendStopDevServer();
				}});
			} catch (err) {
				vscode.window.showErrorMessage(err);

				bpWebviewProvider.sendStopDevServer();
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
	const exportSandbox = async () => {
		const workspaceFolder = await selectWorkspaceFolder();

		if (workspaceFolder) {
			const directory = workspaceFolder.uri.path;

			vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: "Exporting to codesandbox.io...",
				cancellable: false
			}, () => {
				return new Promise((resolve) => {
					bp.commands.exportSandbox({ directory, openInBrowser: true, onSuccess: () => {
						resolve();
					}, onError: (err) => {
						resolve();
						vscode.window.showErrorMessage(err);
					}});
				});
			});
		} else {
			vscode.window.showErrorMessage('Working folder not found, open a folder and try again');
		}
	}
	const createProject = async () => {
		const projectName = await getProjectName();

		if (projectName) {
			const template = await selectProjectTemplate();

			if (template) {
				const directory = await selectDirectory();
				const projectPath = path.join(directory, projectName);
				const relativeProjectPath = path.join(process.cwd(), projectPath);

				if (directory) {
					vscode.window.withProgress({
						location: vscode.ProgressLocation.Notification,
						title: `Creating a new ${template} project...`,
						cancellable: false
					}, () => {
						return new Promise((resolve) => {
							bp.commands.createProject({
								projectName: relativeProjectPath,
								startServer: false,
								templateId: bp.constants.TEMPLATES[template],
								onSuccess: () => {
									resolve();
									openDirectory(projectPath);
								},
								onError: (err) => {
									resolve();
									vscode.window.showErrorMessage(err);
								}
							})
						});
					});
				}
			}
		}
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
	bpWebviewProvider.onExportSandbox(exportSandbox);
	bpWebviewProvider.onNewProject(createProject);

	const startDevServerDisposable = vscode.commands.registerCommand('blazepack.startDevServer', startBpDevServer);
	const stopDevServerDisposable = vscode.commands.registerCommand('blazepack.stopDevServer', stopBpDevServer);
	const exportSandboxDisposable = vscode.commands.registerCommand('blazepack.exportSandbox', exportSandbox);
	const createProjectDisposable = vscode.commands.registerCommand('blazepack.createProject', createProject);

	context.subscriptions.push(startDevServerDisposable);
	context.subscriptions.push(stopDevServerDisposable);
	context.subscriptions.push(exportSandboxDisposable);
	context.subscriptions.push(createProjectDisposable);
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
		this._exportSandbox = null;
		this._onNewProject = null;
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

		this._view.webview.onDidReceiveMessage((data) => {
			const { type } = data;

			switch (type) {
				case UI_MESSGAGES.LOAD: {
					if (this._onLoadFn) {
						this._onLoadFn();
					}
					break;
				}
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
				case UI_MESSGAGES.EXPORT_SANDBOX: {
					if (this._exportSandbox) {
						this._exportSandbox();
					}

					break;
				}
				case UI_MESSGAGES.NEW_PROJECT: {
					if (this._onNewProject) {
						this._onNewProject();
					}
				}
			}
		});
	}

	onStartDevServer(fn) {
		this._onStartDevServer = fn;
	}

	onNewProject(fn) {
		this._onNewProject = fn;
	}

	onStopDevServer(fn) {
		this._onStopDevServer = fn;
	}

	onExportSandbox(fn) {
		this._exportSandbox = fn;
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
