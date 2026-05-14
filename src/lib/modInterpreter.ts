
import { Node, Edge } from '@xyflow/react';

export interface ModVariable {
  [key: string]: any;
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export class ModInterpreter {
  private nodes: Node[];
  private edges: Edge[];
  private variables: ModVariable = {};
  private onShowUI?: (layoutData: any) => Promise<ModVariable>;
  private onAICall?: (system: string, user: string) => Promise<string>;

  constructor(nodes: Node[], edges: Edge[], initialVars: ModVariable = {}) {
    this.nodes = nodes;
    this.edges = edges;
    this.variables = { ...initialVars };
  }

  setUIHandler(handler: (layoutData: any) => Promise<ModVariable>) {
    this.onShowUI = handler;
  }

  setAICallHandler(handler: (system: string, user: string) => Promise<string>) {
    this.onAICall = handler;
  }

  async run(triggerType: 'pre-battle' | 'post-battle' = 'pre-battle') {
    // Find Start node with matching trigger
    const startNode = this.nodes.find(n => n.type === 'start' && (n.data.trigger || 'pre-battle') === triggerType);
    if (!startNode) return this.variables;

    await this.executeNode(startNode.id);
    return this.variables;
  }

  private async executeNode(nodeId: string): Promise<void> {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;

    let nextHandle = 'trigger-out';

    const type = node.type as string;

    switch (type) {
      case 'start':
        await delay(50);
        break;

      case 'variable':
        {
          const varName = (node.data.varName as string) || 'new_var';
          const varValue = this.resolveValue(node.data.varValue || '');
          this.variables[varName] = varValue;
        }
        break;

      case 'math':
        {
            const target = (node.data.targetVar as string);
            const op = (node.data.op as string) || '+';
            const value = parseFloat(this.resolveValue(node.data.value || '0'));
            const current = parseFloat(this.variables[target] || '0');
            if (op === '+') this.variables[target] = current + value;
            if (op === '-') this.variables[target] = current - value;
            if (op === '*') this.variables[target] = current * value;
            if (op === '/') this.variables[target] = value !== 0 ? current / value : 0;
        }
        break;

      case 'prompt':
        {
          this.variables['__SYSTEM_PROMPT__'] = this.resolveValue(node.data.systemPrompt || '');
          this.variables['__USER_PROMPT__'] = this.resolveValue(node.data.userPrompt || '');
        }
        break;

      case 'aicall':
        if (this.onAICall) {
          const sys = this.resolveValue(node.data.systemPrompt || '');
          const user = this.resolveValue(node.data.userPrompt || '');
          const result = await this.onAICall(sys, user);
          const outputVar = node.data.outputVar as string;
          if (outputVar) {
            this.variables[outputVar] = result;
          }
        }
        break;

      case 'showui':
        if (this.onShowUI) {
          const result = await this.onShowUI(node.data.layoutData);
          this.variables = { ...this.variables, ...result };
        }
        break;
    }

    const outgoingEdges = this.edges.filter(e => e.source === nodeId);
    if (outgoingEdges.length > 0) {
      await Promise.all(outgoingEdges.map(edge => this.executeNode(edge.target)));
    }
  }

  private resolveValue(val: any): string {
    if (typeof val !== 'string') return String(val || '');
    return val.replace(/\{([^}]+)\}/g, (_, name) => {
      return this.variables[name] !== undefined ? this.variables[name] : `{${name}}`;
    });
  }
}
