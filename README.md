# Azure Kubernetes Service (AKS) Extension for Visual Studio Code

[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/8315/badge)](https://www.bestpractices.dev/projects/8315) [![Build & Publish](https://github.com/Azure/vscode-aks-tools/actions/workflows/publish-v2.yml/badge.svg)](https://github.com/Azure/vscode-aks-tools/actions/workflows/publish-v2.yml) [![Build](https://github.com/Azure/vscode-aks-tools/actions/workflows/build.yml/badge.svg)](https://github.com/Azure/vscode-aks-tools/actions/workflows/build.yml) [![CodeQL](https://github.com/Azure/vscode-aks-tools/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/Azure/vscode-aks-tools/actions/workflows/codeql-analysis.yml)
[![Prettier Check](https://github.com/Azure/vscode-aks-tools/actions/workflows/format-check.yml/badge.svg)](https://github.com/Azure/vscode-aks-tools/actions/workflows/format-check.yml)

* [Introduction](https://azure.github.io/vscode-aks-tools/index.html)
* [Development](https://azure.github.io/vscode-aks-tools/development/development.html)
* [Installation](https://azure.github.io/vscode-aks-tools/installation.html#installation)
* [Feature List](https://azure.github.io/vscode-aks-tools/features/features.html)

## AKS AI Capabilities with GitHub Copilot Integration

The AKS extension now includes powerful AI-driven capabilities through integration with GitHub Copilot and the Model Context Protocol (MCP). This feature provides intelligent assistance for managing, troubleshooting, and optimizing your Azure Kubernetes Service clusters directly within VS Code.

### Overview

AKS AI capabilities leverage the [AKS-MCP server](https://github.com/Azure/aks-mcp) to provide context-aware assistance through GitHub Copilot. The extension automatically manages the MCP server lifecycle, enabling seamless AI-powered interactions with your AKS clusters.

### Features

* **Intelligent Cluster Management**: Get AI-powered suggestions for cluster configuration, scaling, and optimization
* **Smart Troubleshooting**: Receive contextual guidance for diagnosing and resolving cluster issues
* **Resource Analysis**: AI-driven insights into resource utilization, performance, and cost optimization
* **Best Practices**: Automated recommendations for security, reliability, and operational excellence
* **Natural Language Queries**: Ask questions about your clusters in plain English through GitHub Copilot

### Prerequisites

* **GitHub Copilot**: Ensure you have an active GitHub Copilot subscription and the extension installed
* **Azure Authentication**: Sign in to your Azure account through the AKS extension
* **AKS Clusters**: Have at least one AKS cluster accessible in your Azure subscription

### Getting Started

#### 1. Enable AKS AI Capabilities

The AI features are enabled by default. If you need to manually start the service:

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run: `AKS AI: Toggle AKS AI`
3. Wait for the "AKS AI capabilities enabled!" notification

#### 2. Verify Setup

Check that the AI service is running:

1. Open Command Palette
2. Run: `AKS AI: Check AKS AI Status`
3. You should see "AKS AI Server Status: Running"

#### 3. Start Using AI Assistance

Once enabled, you can interact with AKS AI in several ways:

**Through GitHub Copilot Chat:**

1. Open GitHub Copilot Chat (`Ctrl+Alt+I` / `Cmd+Alt+I`)
2. Ask questions about your AKS clusters:
   * "What's the current status of my AKS clusters?"
   * "How can I troubleshoot pod startup issues?"
   * "What are the best practices for scaling my cluster?"
   * "Help me optimize resource usage in my cluster"

**Through Command Palette:**

1. Run: `AKS AI: Ask GitHub Copilot about AKS`
2. This opens Copilot with AKS context automatically loaded

### Configuration

The AKS AI service can be customized through VS Code settings:

```json
{
  "aks.ai.autoStart": true,              // Auto-start AI service when extension loads
  "aks.ai.accessLevel": "readonly",      // Access level: readonly, readwrite, admin
  "aks.ai.serverPort": 8000,             // Port for the MCP server
  "aks.ai.timeout": 600,                 // Timeout in seconds for operations
  "aks.ai.showNotifications": true,      // Show status notifications
  "aks.ai.additionalTools": ["helm"],    // Additional tools to enable
  "aks.ai.serverPath": ""                // Custom binary path (optional)
}
```

Access these settings through:

1. `File > Preferences > Settings` (or `Ctrl+,`)
2. Search for "AKS AI"

### Available Commands

| Command | Description |
|---------|-------------|
| `AKS AI: Toggle AKS AI` | Start or stop the AI service |
| `AKS AI: Ask GitHub Copilot about AKS` | Open Copilot with AKS context |
| `AKS AI: Check AKS AI Status` | View current service status |
| `AKS AI: Restart AKS AI Server` | Restart the AI service |

### Testing and Development

#### Local Testing

For development and testing purposes:

1. **Extension Development Host**: Press `F5` to launch a new VS Code window with the extension loaded
2. **Test AI Integration**: Use the commands above to verify functionality
3. **Check Logs**: View the Output panel (AKS extension) for detailed logs

#### Manual Binary Management

The extension automatically downloads and manages the AKS-MCP binary. For custom setups:

1. Download the appropriate binary from [AKS-MCP releases](https://github.com/Azure/aks-mcp/releases)
2. Set `aks.ai.serverPath` to point to your custom binary location
3. Restart the AI service

#### Troubleshooting

**AI Service Won't Start:**

* Check your internet connection (required for initial binary download)
* Verify GitHub Copilot is installed and authenticated
* Check VS Code Output panel for error messages
* Try restarting with: `AKS AI: Restart AKS AI Server`

**No AI Responses:**

* Ensure GitHub Copilot subscription is active
* Verify you're signed into Azure through the AKS extension
* Check that you have accessible AKS clusters in your subscription
* Look for error messages in the Output panel

**Performance Issues:**

* Adjust `aks.ai.timeout` setting for slower networks
* Consider changing `aks.ai.accessLevel` to "readonly" for faster responses
* Restart the AI service if it becomes unresponsive

### Architecture

The AKS AI integration consists of:

* **AKS-MCP Server**: Provides cluster context and operations to GitHub Copilot
* **VS Code Extension**: Manages server lifecycle and provides commands
* **GitHub Copilot**: Processes natural language queries with AKS context
* **Model Context Protocol**: Enables secure communication between components

The server runs locally and communicates with GitHub Copilot through the MCP protocol, ensuring your cluster data remains secure while providing rich context for AI assistance.

## Telemetry

This extension collects telemetry data to help us build a better experience for building applications with Azure Kubernetes Service and VS Code. We only collect the following data:

* Which commands are executed.

We do not collect any information about image names, paths, etc. Read our [privacy statement](https://privacy.microsoft.com/privacystatement) to learn more. If you don’t wish to send usage data to Microsoft, you can set the `telemetry.enableTelemetry` setting to `false`. Learn more in our [FAQ](https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting).

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
