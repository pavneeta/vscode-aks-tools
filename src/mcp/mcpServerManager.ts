import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

/**
 * Configuration interface for AKS-MCP server
 */
interface MCPServerConfig {
    serverPath?: string;
    autoStart: boolean;
    accessLevel: 'readonly' | 'readwrite' | 'admin';
    additionalTools: string[];
    serverPort: number;
    timeout: number;
    showNotifications: boolean;
}

/**
 * Manages the lifecycle of the AKS-MCP server for GitHub Copilot integration
 */
export class AKSMCPServerManager {
    private serverProcess: ChildProcess | null = null;
    private serverPort: number = 8000;
    private serverPath: string = '';
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Start the AKS-MCP server instance
     */
    async startMCPServer(): Promise<void> {
        try {
            // Ensure AKS-MCP binary is available
            await this.ensureServerBinary();
            
            // Get configuration
            const config = this.getConfiguration();
            this.serverPort = config.serverPort;
            
            // Start MCP server in SSE mode for GitHub Copilot integration
            this.serverProcess = spawn(this.serverPath, [
                '--transport', 'sse',
                '--host', '127.0.0.1',
                '--port', this.serverPort.toString(),
                '--access-level', config.accessLevel,
                '--additional-tools', config.additionalTools.join(','),
                '--timeout', config.timeout.toString()
            ]);

            // Handle server process events
            this.setupServerEventHandlers();
            
            // Wait for server to be ready
            await this.waitForServerReady();
            
            // Auto-configure GitHub Copilot integration
            await this.configureCopilotIntegration();
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to start AKS-MCP server: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Stop the AKS-MCP server instance
     */
    async stopMCPServer(): Promise<void> {
        if (this.serverProcess) {
            this.serverProcess.kill('SIGTERM');
            this.serverProcess = null;
        }
    }

    /**
     * Check if the MCP server is currently running
     */
    isServerRunning(): boolean {
        return this.serverProcess !== null && !this.serverProcess.killed;
    }

    /**
     * Restart the MCP server
     */
    async restartServer(): Promise<void> {
        await this.stopMCPServer();
        await this.startMCPServer();
    }

    /**
     * Get the current server configuration from VS Code settings
     */
    private getConfiguration(): MCPServerConfig {
        const config = vscode.workspace.getConfiguration('aks.ai');
        return {
            serverPath: config.get('serverPath'),
            autoStart: config.get('autoStart', true),
            accessLevel: config.get('accessLevel', 'readonly'),
            additionalTools: config.get('additionalTools', []),
            serverPort: config.get('serverPort', 8000),
            timeout: config.get('timeout', 600),
            showNotifications: config.get('showNotifications', true)
        };
    }

    /**
     * Ensure the AKS-MCP server binary is available
     */
    private async ensureServerBinary(): Promise<void> {
        const config = this.getConfiguration();
        
        // Use configured path or default location
        this.serverPath = config.serverPath || this.getDefaultServerPath();
        
        if (!fs.existsSync(this.serverPath)) {
            await this.downloadAndInstallServer();
        }
        
        // TODO: Verify server version and update if needed
        // if (await this.shouldUpdateServer()) {
        //     await this.downloadAndInstallServer();
        // }
    }

    /**
     * Get the default path for the AKS-MCP server binary
     */
    private getDefaultServerPath(): string {
        const platform = process.platform;
        const extension = platform === 'win32' ? '.exe' : '';
        const binaryName = `aks-mcp${extension}`;
        
        // Store in extension's global storage path
        const globalStoragePath = this.context.globalStorageUri.fsPath;
        return path.join(globalStoragePath, 'bin', binaryName);
    }

    /**
     * Download and install the AKS-MCP server binary
     */
    private async downloadAndInstallServer(): Promise<void> {
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Setting up AKS AI capabilities...",
            cancellable: false
        }, async (progress: vscode.Progress<{ increment?: number; message?: string }>) => {
            progress.report({ increment: 10, message: "Downloading AKS-MCP server..." });
            
            // Get the download URL for the current platform
            const downloadUrl = this.getDownloadUrl();
            
            progress.report({ increment: 30, message: "Downloading binary..." });
            
            // Download the binary
            await this.downloadBinary(downloadUrl);
            
            progress.report({ increment: 80, message: "Installing..." });
            
            // Ensure directory exists
            const serverDir = path.dirname(this.serverPath);
            if (!fs.existsSync(serverDir)) {
                fs.mkdirSync(serverDir, { recursive: true });
            }
            
            // Make executable (Unix-like systems)
            if (process.platform !== 'win32') {
                fs.chmodSync(this.serverPath, 0o755);
            }
            
            progress.report({ increment: 100, message: "Ready!" });
        });
    }

    /**
     * Get the download URL for the current platform and architecture
     */
    private getDownloadUrl(): string {
        const platform = process.platform;
        const arch = process.arch;
        const version = 'v0.0.2';
        
        let binaryName: string;
        
        if (platform === 'win32') {
            if (arch === 'arm64') {
                binaryName = 'aks-mcp-windows-arm64.exe';
            } else {
                binaryName = 'aks-mcp-windows-amd64.exe';
            }
        } else if (platform === 'darwin') {
            if (arch === 'arm64') {
                binaryName = 'aks-mcp-darwin-arm64';
            } else {
                binaryName = 'aks-mcp-darwin-amd64';
            }
        } else {
            // Default to Linux
            if (arch === 'arm64') {
                binaryName = 'aks-mcp-linux-arm64';
            } else {
                binaryName = 'aks-mcp-linux-amd64';
            }
        }
        
        return `https://github.com/Azure/aks-mcp/releases/download/${version}/${binaryName}`;
    }

    /**
     * Download binary from URL to the server path
     */
    private async downloadBinary(url: string): Promise<void> {
        try {
            const https = await import('https');
            const fs = await import('fs');
            
            return new Promise((resolve, reject) => {
                const file = fs.createWriteStream(this.serverPath);
                
                https.get(url, (response) => {
                    // Handle redirects
                    if (response.statusCode === 302 || response.statusCode === 301) {
                        const redirectUrl = response.headers.location;
                        if (redirectUrl) {
                            https.get(redirectUrl, (redirectResponse) => {
                                redirectResponse.pipe(file);
                                file.on('finish', () => {
                                    file.close();
                                    resolve();
                                });
                            }).on('error', reject);
                        } else {
                            reject(new Error('Redirect without location header'));
                        }
                        return;
                    }
                    
                    if (response.statusCode !== 200) {
                        reject(new Error(`Download failed with status ${response.statusCode}`));
                        return;
                    }
                    
                    response.pipe(file);
                    
                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
                    
                    file.on('error', (err) => {
                        fs.unlink(this.serverPath, () => {}); // Delete partial file
                        reject(err);
                    });
                }).on('error', reject);
            });
        } catch (error) {
            throw new Error(`Failed to download AKS-MCP server: ${error}`);
        }
    }

    /**
     * Setup event handlers for the server process
     */
    private setupServerEventHandlers(): void {
        if (!this.serverProcess) return;

        this.serverProcess.on('error', (error: Error) => {
            console.error('AKS-MCP server error:', error);
            vscode.window.showErrorMessage(`AKS-MCP server error: ${error.message}`);
        });

        this.serverProcess.on('exit', (code: number | null, signal: string | null) => {
            console.log(`AKS-MCP server exited with code ${code}, signal ${signal}`);
            this.serverProcess = null;
        });

        this.serverProcess.stdout?.on('data', (data: string) => {
            console.log('AKS-MCP server stdout:', data.toString());
        });

        this.serverProcess.stderr?.on('data', (data: string) => {
            console.error('AKS-MCP server stderr:', data.toString());
        });
    }

    /**
     * Wait for the server to be ready to accept connections
     */
    private async waitForServerReady(): Promise<void> {
        // TODO: Implement health check by pinging the server endpoint
        // For now, just wait a bit
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    /**
     * Configure GitHub Copilot integration by updating workspace MCP configuration
     */
    private async configureCopilotIntegration(): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            console.warn('No workspace folder found, skipping MCP configuration');
            return;
        }

        const vscodeDir = path.join(workspaceRoot, '.vscode');
        const mcpConfigPath = path.join(vscodeDir, 'mcp.json');

        // Ensure .vscode directory exists
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir, { recursive: true });
        }

        // Create or update MCP configuration
        const mcpConfig = {
            servers: {
                "aks-mcp-server": {
                    type: "sse",
                    url: `http://127.0.0.1:${this.serverPort}/sse`
                }
            }
        };

        fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));

        // Show notification to user if enabled
        const config = this.getConfiguration();
        if (config.showNotifications) {
            const result = await vscode.window.showInformationMessage(
                "AKS AI capabilities enabled! You can now ask GitHub Copilot about your AKS clusters.",
                'Try it now'
            );
            
            if (result === 'Try it now') {
                vscode.commands.executeCommand('github.copilot.interactiveSession.openInline');
            }
        }
    }
}
