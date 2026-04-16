export interface ToolTextContent {
    type: string;
    text: string;
}

export interface ToolResult {
    content: ToolTextContent[];
}

export interface McpServerInstance {
    connect(transport: unknown): Promise<void>;
    close(): Promise<void>;
    registerTool(
        name: string,
        config: { description: string; inputSchema: unknown },
        handler: (...args: unknown[]) => unknown,
    ): void;
}

export const McpServer: {
    new(
        info: { name: string; version: string },
        options?: { instructions?: string },
    ): McpServerInstance;
};

export class StdioServerTransport {
    constructor();
}

export class Client {
    constructor(info: { name: string; version: string });
    connect(transport: unknown): Promise<void>;
    close(): Promise<void>;
    callTool(request: {
        name: string;
        arguments?: Record<string, unknown>;
    }): Promise<ToolResult>;
}

export class InMemoryTransport {
    static createLinkedPair(): [unknown, unknown];
}
