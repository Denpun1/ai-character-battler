
import { supabase } from "@/lib/supabase";

export interface PluginContext {
  userId: string;
  battleResult?: any;
  systemPrompt?: string;
  variables: Record<string, any>;
}

/**
 * 堅牢なMod実行エンジン (REBUILT FROM ZERO)
 * 依存関係の解決 (Lazy Evaluation) と 確実な順次実行 を組み合わせたアーキテクチャ。
 */
export async function runPluginFlow(
  nodes: any[], 
  edges: any[], 
  triggerType: string, 
  context: PluginContext,
  startNodeId?: string
) {
  const executedNodes = new Set<string>();
  const variables = context.variables;

  const logToUI = (msg: string) => {
    window.dispatchEvent(new CustomEvent('plugin:ui:display', {
      detail: { message: `[Mod Engine] ${msg}`, mode: 'plain', slot: 'sidebar', posMode: 'slot' }
    }));
  };

  /**
   * 指定したノードの指定したハンドルの値を解決する。
   * まだ実行されていないノードに依存している場合、可能な限り再帰的に解決を試みる。
   */
  const resolveValue = async (nodeId: string, handleId: string, fallback: any): Promise<any> => {
    const edge = edges.find(e => e.target === nodeId && e.targetHandle === `in-${handleId}`);
    if (!edge) return fallback;

    const sourceNode = nodes.find(n => n.id === edge.source);
    if (!sourceNode) return fallback;

    const varKey = `${edge.source}_${edge.sourceHandle}`;

    // すでに値がある場合はそれを返す
    if (varKey in variables) return variables[varKey];

    // 値がない場合、そのソースノードがAIノードなら自動で実行を試みる (フールプルーフ)
    if (sourceNode.type === 'ai' && !executedNodes.has(sourceNode.id)) {
      logToUI(`Dependency detected: Triggering AI Node (${sourceNode.id}) to resolve data for ${nodeId}...`);
      await executeNode(sourceNode);
    }

    return variables[varKey] ?? fallback;
  };

  /**
   * 個別のノードを実行するメインロジック
   */
  const executeNode = async (node: any) => {
    if (executedNodes.has(node.id)) return;
    executedNodes.add(node.id);

    logToUI(`Executing: ${node.type} (${node.id})`);

    try {
      switch (node.type) {
        case "start":
          break;

        case "ai": {
          const nodePrompt = await resolveValue(node.id, "prompt", node.data.prompt || "");
          const model = node.data.model === 'custom' ? node.data.customModel : node.data.model;
          
          logToUI(`AI Generation starting... (Model: ${model || 'default'})`);
          
          const combinedSystemPrompt = context.systemPrompt 
            ? `${context.systemPrompt}\n\n${nodePrompt}`
            : nodePrompt;

          const response = await fetch("/api/battle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemPrompt: combinedSystemPrompt,
              model: model || "gemini-1.5-flash",
              playerInfo: "Plugin Context:\n" + JSON.stringify(context.battleResult || "No battle result yet")
            }),
          });

          if (!response.ok) throw new Error(`AI API Error: ${response.status}`);
          
          const reader = response.body?.getReader();
          if (!reader) throw new Error("No response body");
          
          const decoder = new TextDecoder();
          let text = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            text += decoder.decode(value);
          }
          
          variables[`${node.id}_out-text`] = text;
          logToUI(`AI generation complete (${text.length} chars).`);
          break;
        }

        case "log": {
          const rawMessage = await resolveValue(node.id, "message", undefined);
          const fallback = node.data.message || "Empty log message";
          const message = (rawMessage === undefined || rawMessage === '') ? fallback : rawMessage;
          
          const slot = node.data.slot || "battle";
          logToUI(`Displaying output to [${slot}] slot.`);

          window.dispatchEvent(new CustomEvent('plugin:ui:display', {
            detail: { 
              message, 
              mode: node.data.mode || "box", 
              slot, 
              posMode: node.data.posMode || 'slot', 
              posX: node.data.posX || 0, 
              posY: node.data.posY || 0, 
              width: node.data.width || 300, 
              height: node.data.height || 100, 
              id: node.id 
            }
          }));
          break;
        }

        case "button": {
          const label = node.data.label || "Next Step";
          logToUI(`Creating interactive button: [${label}]`);
          window.dispatchEvent(new CustomEvent('plugin:ui:button', {
            detail: { 
              label, 
              slot: node.data.slot || "actions", 
              posMode: node.data.posMode || 'slot', 
              posX: node.data.posX || 0, 
              posY: node.data.posY || 0, 
              width: node.data.width || 150, 
              height: node.data.height || 40, 
              nodeId: node.id 
            }
          }));
          break;
        }

        default:
          logToUI(`Node type ${node.type} has no side-effects, skipping.`);
      }
    } catch (err: any) {
      logToUI(`[ERROR] ${node.type}: ${err.message}`);
      console.error(err);
    }

    // 次のノードへ（実行線に従う。または全ての出力を辿る）
    const nextExecutionEdges = edges.filter(e => e.source === node.id && (e.sourceHandle === 'trigger-out' || !e.sourceHandle));
    for (const edge of nextExecutionEdges) {
      const nextNode = nodes.find(n => n.id === edge.target);
      if (nextNode) await executeNode(nextNode);
    }
  };

  // --- メイン実行エントリポイント ---
  logToUI(`--- Starting Engine (Trigger: ${triggerType}) ---`);

  let startNodes: any[] = [];
  if (triggerType === 'node_click' && startNodeId) {
    const startNode = nodes.find(n => n.id === startNodeId);
    if (startNode) startNodes = [startNode];
  } else {
    startNodes = nodes.filter(n => 
      n.type === 'start' && 
      (n.data.triggerType === triggerType || (!n.data.triggerType && triggerType === 'start'))
    );
  }

  if (startNodes.length === 0) {
    logToUI(`No matching start nodes for trigger: ${triggerType}`);
    return;
  }

  for (const startNode of startNodes) {
    await executeNode(startNode);
  }

  logToUI(`--- Flow execution finished ---`);
}

