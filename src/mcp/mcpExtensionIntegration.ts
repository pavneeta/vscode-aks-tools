import * as vscode from 'vscode';
import { AKSMCPServerManager } from './mcpServerManager';

/**
 * Integrates MCP server management with the VS Code extension lifecycle
 */
export class MCPExtensionIntegration {
    private serverManager: AKSMCPServerManager;

    constructor(private context: vscode.ExtensionContext) {
        this.serverManager = new AKSMCPServerManager(context);
    }

    /**
     * Activate MCP integration - start server and register commands
     */
    async activate(): Promise<void> {
        // Auto-start MCP server if enabled in settings
        const config = vscode.workspace.getConfiguration('aks.ai');
        if (config.get('autoStart', true)) {
            try {
                await this.serverManager.startMCPServer();
            } catch (error) {
                console.error('Failed to auto-start AKS-MCP server:', error);
                // Don't fail extension activation if MCP server fails to start
            }
        }

        // Register MCP-related commands
        this.registerCommands();

        // Setup context monitoring for cluster selection changes
        this.setupContextMonitoring();

        // Cleanup on extension deactivation
        this.context.subscriptions.push({
            dispose: () => this.serverManager.stopMCPServer()
        });
    }

    /**
     * Register MCP-related commands
     */
    private registerCommands(): void {
        // Command to toggle MCP server on/off
        const toggleCommand = vscode.commands.registerCommand('aks.ai.toggle', async () => {
            try {
                if (this.serverManager.isServerRunning()) {
                    await this.serverManager.stopMCPServer();
                    vscode.window.showInformationMessage('AKS AI capabilities disabled');
                } else {
                    await this.serverManager.startMCPServer();
                    // Success message is shown by the server manager
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                vscode.window.showErrorMessage(`Failed to toggle AKS AI: ${errorMessage}`);
            }
        });

        // Command to restart MCP server (useful for configuration changes)
        const restartCommand = vscode.commands.registerCommand('aks.ai.restart', async () => {
            try {
                await this.serverManager.restartServer();
                vscode.window.showInformationMessage('AKS AI server restarted');
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                vscode.window.showErrorMessage(`Failed to restart AKS AI server: ${errorMessage}`);
            }
        });

        // Command to open GitHub Copilot with AKS context
        const askCopilotCommand = vscode.commands.registerCommand('aks.ai.askCopilot', async (cluster?: { name?: string; resourceGroupName?: string }) => {
            // Check if MCP server is running
            if (!this.serverManager.isServerRunning()) {
                const result = await vscode.window.showInformationMessage(
                    'AKS AI is not running. Start it now?',
                    'Start', 'Cancel'
                );
                if (result === 'Start') {
                    try {
                        await this.serverManager.startMCPServer();
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        vscode.window.showErrorMessage(`Failed to start AKS AI: ${errorMessage}`);
                        return;
                    }
                } else {
                    return;
                }
            }

            // Prepare context-aware prompt for GitHub Copilot
            let prompt = 'How can I help with your AKS clusters?';
            
            if (cluster && cluster.name && cluster.resourceGroupName) {
                prompt = `Please analyze my AKS cluster "${cluster.name}" in resource group "${cluster.resourceGroupName}"`;
            }

            // Open GitHub Copilot with the prepared prompt
            try {
                await vscode.commands.executeCommand('github.copilot.interactiveSession.open', {
                    initialPrompt: prompt
                });
            } catch {
                // Fallback to inline session if the above command doesn't work
                try {
                    await vscode.commands.executeCommand('github.copilot.interactiveSession.openInline');
                } catch {
                    vscode.window.showErrorMessage('Failed to open GitHub Copilot. Please ensure GitHub Copilot extension is installed and active.');
                }
            }
        });

        // Command to check MCP server status
        const statusCommand = vscode.commands.registerCommand('aks.ai.status', () => {
            const isRunning = this.serverManager.isServerRunning();
            const status = isRunning ? 'running' : 'stopped';
            vscode.window.showInformationMessage(`AKS AI server is ${status}`);
        });

        // Add commands to context subscriptions for cleanup
        this.context.subscriptions.push(toggleCommand, restartCommand, askCopilotCommand, statusCommand);
    }

    /**
     * Setup monitoring for cluster selection changes to provide context
     */
    private setupContextMonitoring(): void {
        // Monitor when users change the active text editor or selection
        // This could potentially provide context to the MCP server in the future
        vscode.window.onDidChangeActiveTextEditor(() => {
            // Could send context updates to MCP server if needed
            // For now, we'll just log that the context might have changed
            console.log('Active editor changed - MCP context might need updating');
        });

        // Monitor workspace configuration changes
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('aks.ai')) {
                console.log('AKS AI configuration changed');
                
                // If auto-start setting changed and server is not running, potentially start it
                const config = vscode.workspace.getConfiguration('aks.ai');
                const autoStart = config.get('autoStart', true);
                
                if (autoStart && !this.serverManager.isServerRunning()) {
                    // Optionally restart server with new configuration
                    this.serverManager.startMCPServer().catch(error => {
                        console.error('Failed to start MCP server after configuration change:', error);
                    });
                }
            }
        });
    }

    /**
     * Deactivate MCP integration - cleanup resources
     */
    async deactivate(): Promise<void> {
        try {
            await this.serverManager.stopMCPServer();
        } catch (error) {
            console.error('Error stopping MCP server during deactivation:', error);
        }
    }

    /**
     * Get the server manager instance (for access from other parts of the extension)
     */
    getServerManager(): AKSMCPServerManager {
        return this.serverManager;
    }
}
