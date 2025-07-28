/**
 * Simple test script to verify MCP integration works locally
 * Run this with: npm run test-mcp
 */

import * as vscode from 'vscode';
import { MCPExtensionIntegration } from './src/mcp/mcpExtensionIntegration';

async function testMCPIntegration() {
    console.log('🧪 Testing MCP Integration...');
    
    // Create a mock context for testing
    const mockContext: Partial<vscode.ExtensionContext> = {
        subscriptions: [],
        globalStorageUri: vscode.Uri.file('C:\\temp\\test-storage'),
        globalState: {
            get: (key: string) => undefined,
            update: (key: string, value: any) => Promise.resolve(),
            keys: () => []
        } as any,
        workspaceState: {
            get: (key: string) => undefined,
            update: (key: string, value: any) => Promise.resolve(),
            keys: () => []
        } as any
    };

    try {
        // Test 1: Create MCP integration instance
        console.log('✅ Test 1: Creating MCP integration instance...');
        const mcpIntegration = new MCPExtensionIntegration(mockContext as vscode.ExtensionContext);
        console.log('✅ MCP integration instance created successfully');

        // Test 2: Check server manager creation
        console.log('✅ Test 2: Checking server manager...');
        const serverManager = mcpIntegration.getServerManager();
        console.log('✅ Server manager accessible');

        // Test 3: Check initial server state
        console.log('✅ Test 3: Checking initial server state...');
        const isRunning = serverManager.isServerRunning();
        console.log(`✅ Initial server state: ${isRunning ? 'running' : 'stopped'}`);

        // Test 4: Test configuration reading
        console.log('✅ Test 4: Testing configuration...');
        const config = vscode.workspace.getConfiguration('aks.ai');
        const autoStart = config.get('autoStart', true);
        const accessLevel = config.get('accessLevel', 'readonly');
        console.log(`✅ Configuration - autoStart: ${autoStart}, accessLevel: ${accessLevel}`);

        console.log('🎉 All MCP integration tests passed!');
        return true;

    } catch (error) {
        console.error('❌ MCP integration test failed:', error);
        return false;
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testMCPIntegration().then(success => {
        process.exit(success ? 0 : 1);
    });
}

export { testMCPIntegration };
