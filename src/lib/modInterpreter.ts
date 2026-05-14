
import { Node, Edge } from '@xyflow/react';
import { supabase } from './supabase';

export interface ModVariable {
  [key: string]: any;
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export class ModInterpreter {
  private nodes: Node[];
  private edges: Edge[];
  private variables: ModVariable = {};
  private onShowUI?: (layoutData: any) => Promise<ModVariable>;

  constructor(nodes: Node[], edges: Edge[], initialVars: ModVariable = {}) {
    this.nodes = nodes;
    this.edges = edges;
    this.variables = { ...initialVars };
  }

  setUIHandler(handler: (layoutData: any) => Promise<ModVariable>) {
    this.onShowUI = handler;
  }

  async run() {
    const startNode = this.nodes.find(n => n.data.label === 'Start');
    if (!startNode) return this.variables;

    await this.executeNode(startNode.id);
    return this.variables;
  }

  private async executeNode(nodeId: string): Promise<void> {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;

    let nextHandle = 'trigger-out'; // Default

    const label = node.data.label as string;

    switch (label) {
      case 'Start':
        await delay(100);
        break;

      case 'Variable':
        {
          const varName = (node.data.varName as string) || 'new_var';
          const varValue = this.resolveValue(node.data.varValue || '');
          this.variables[varName] = varValue;
        }
        break;

      case 'Math':
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

      case 'Show UI':
        if (this.onShowUI) {
          // Pause execution and wait for user input from the custom layout
          const result = await this.onShowUI(node.data.layoutData);
          this.variables = { ...this.variables, ...result };
        }
        break;

      case 'AI Call':
        // Placeholder for post-battle AI calls
        await delay(500);
        break;
    }

    // Parallel execution for multiple outgoing connections
    const outgoingEdges = this.edges.filter(e => e.source === nodeId);
    if (outgoingEdges.length > 0) {
      await Promise.all(outgoingEdges.map(edge => this.executeNode(edge.target)));
    }
  }

  private resolveValue(val: any): string {
    if (typeof val !== 'string') return String(val || '');
    // Simple {var} interpolation
    return val.replace(/\{([^}]+)\}/g, (_, name) => {
      return this.variables[name] !== undefined ? this.variables[name] : `{${name}}`;
    });
  }
}
