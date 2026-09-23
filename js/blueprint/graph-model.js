/**
 * Graph Model & DAG Reactive Execution Engine
 * Manages Blueprint nodes, connections, dependency evaluation, and caching.
 */

class GraphModel {
  constructor() {
    this.nodes = new Map();         // id -> NodeInstance
    this.connections = [];          // Array of { id, fromNode, fromPin, toNode, toPin }
    this.isEvaluating = false;
    this.dirty = true;
    this.onGraphUpdate = () => {};
    this.onGraphExecuted = () => {};
  }

  addNode(type, x = 100, y = 100, initialParams = {}) {
    const def = window.NODE_DEFINITIONS[type];
    if (!def) {
      throw new Error(`未知节点类型: ${type}`);
    }

    // 约束：终点输出节点全局仅允许放置一个
    if (type === 'output_export') {
      const hasOutput = Array.from(this.nodes.values()).some(n => n.type === 'output_export');
      if (hasOutput) {
        if (typeof window.showToast === 'function') {
          window.showToast('画布已存在终点输出节点，仅允许放置一个');
        }
        return null;
      }
    }

    const id = 'node_' + Math.random().toString(36).substr(2, 9);
    const nodeInstance = {
      id,
      type,
      x: Math.round(x),
      y: Math.round(y),
      params: { ...def.defaultParams, ...initialParams },
      cachedOutputs: null,
      isExecuting: false,
      error: null
    };

    this.nodes.set(id, nodeInstance);
    this.notifyUpdate();
    this.requestEvaluate();
    return nodeInstance;
  }

  removeNode(nodeId) {
    if (!this.nodes.has(nodeId)) return;
    // Remove all associated connections
    this.connections = this.connections.filter(c => c.fromNode !== nodeId && c.toNode !== nodeId);
    this.nodes.delete(nodeId);
    this.notifyUpdate();
    this.requestEvaluate();
  }

  updateNodeParams(nodeId, newParams) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.params = { ...node.params, ...newParams };
    this.requestEvaluate();
  }

  updateNodePosition(nodeId, x, y) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.x = Math.round(x);
    node.y = Math.round(y);
    this.notifyUpdate(false); // don't need re-evaluation for drag
  }

  connect(fromNode, fromPin, toNode, toPin) {
    if (fromNode === toNode) return false;

    // Check if toPin is already connected; standard single-input behavior
    this.connections = this.connections.filter(c => !(c.toNode === toNode && c.toPin === toPin));

    const id = `conn_${fromNode}_${fromPin}_to_${toNode}_${toPin}`;
    this.connections.push({
      id,
      fromNode,
      fromPin,
      toNode,
      toPin
    });

    this.notifyUpdate();
    this.requestEvaluate();
    return true;
  }

  disconnect(connectionId) {
    this.connections = this.connections.filter(c => c.id !== connectionId);
    this.notifyUpdate();
    this.requestEvaluate();
  }

  notifyUpdate(needsRender = true) {
    this.onGraphUpdate({
      nodes: Array.from(this.nodes.values()),
      connections: this.connections,
      needsRender
    });
  }

  /**
   * Request async DAG evaluation with debouncing
   */
  requestEvaluate() {
    if (this.isEvaluating) {
      this.hasPendingEvaluate = true;
      return;
    }
    if (this.evalTimeout) clearTimeout(this.evalTimeout);
    this.evalTimeout = setTimeout(() => {
      this.evaluate();
    }, 25);
  }

  /**
   * Evaluates the graph in topological order
   */
  async evaluate() {
    if (this.isEvaluating) {
      this.hasPendingEvaluate = true;
      return;
    }
    this.isEvaluating = true;

    try {
      // Find execution order using Kahn's algorithm or reverse dependency search
      const order = this.getTopologicalOrder();

      const nodeOutputs = new Map(); // nodeId -> { [pinId]: result }

      for (const nodeId of order) {
        const node = this.nodes.get(nodeId);
        if (!node) continue;
        const def = window.NODE_DEFINITIONS[node.type];
        if (!def) continue;

        // Gather inputs from incoming connections
        const inputs = {};
        const incoming = this.connections.filter(c => c.toNode === nodeId);

        for (const conn of incoming) {
          const sourceOutputs = nodeOutputs.get(conn.fromNode);
          if (sourceOutputs && sourceOutputs[conn.fromPin] !== undefined) {
            inputs[conn.toPin] = sourceOutputs[conn.fromPin];
          }
        }

        node.isExecuting = true;
        node.error = null;

        try {
          const outputs = await def.execute(inputs, node.params);
          nodeOutputs.set(nodeId, outputs);
          node.cachedOutputs = outputs;
        } catch (err) {
          console.error(`节点 [${node.title || node.type}] 执行错误:`, err);
          node.error = err.message;
          nodeOutputs.set(nodeId, {});
        } finally {
          node.isExecuting = false;
        }
      }

      // Strict requirement: Only display output if an output_export node is placed AND connected
      let finalResult = null;
      const outputNodes = Array.from(this.nodes.values()).filter(n => n.type === 'output_export');

      if (outputNodes.length > 0) {
        const outNode = outputNodes[0];
        const outData = nodeOutputs.get(outNode.id);
        if (outData && outData.finalFrames && outData.finalFrames.length > 0) {
          finalResult = outData.finalFrames;
        }
      }

      this.onGraphExecuted(finalResult, nodeOutputs);
    } catch (graphErr) {
      console.error('蓝图计算引擎异常:', graphErr);
    } finally {
      this.isEvaluating = false;
      if (this.hasPendingEvaluate) {
        this.hasPendingEvaluate = false;
        this.requestEvaluate();
      }
    }
  }

  getTopologicalOrder() {
    const nodeIds = Array.from(this.nodes.keys());
    const inDegree = new Map();
    const adj = new Map();

    nodeIds.forEach(id => {
      inDegree.set(id, 0);
      adj.set(id, []);
    });

    this.connections.forEach(c => {
      if (adj.has(c.fromNode) && inDegree.has(c.toNode)) {
        adj.get(c.fromNode).push(c.toNode);
        inDegree.set(c.toNode, inDegree.get(c.toNode) + 1);
      }
    });

    const queue = [];
    inDegree.forEach((deg, id) => {
      if (deg === 0) queue.push(id);
    });

    const order = [];
    while (queue.length > 0) {
      const u = queue.shift();
      order.push(u);

      for (const v of adj.get(u)) {
        inDegree.set(v, inDegree.get(v) - 1);
        if (inDegree.get(v) === 0) {
          queue.push(v);
        }
      }
    }

    // Add any remaining (in case of cycles or disconnected)
    nodeIds.forEach(id => {
      if (!order.includes(id)) order.push(id);
    });

    return order;
  }

  // --- Serialization ---

  toJSON() {
    return {
      version: '1.0',
      nodes: Array.from(this.nodes.values()).map(n => ({
        id: n.id,
        type: n.type,
        x: n.x,
        y: n.y,
        params: n.params
      })),
      connections: this.connections
    };
  }

  fromJSON(data) {
    if (!data || !data.nodes) return;
    this.nodes.clear();
    this.connections = [];

    let hasOutputNode = false;
    data.nodes.forEach(n => {
      const def = window.NODE_DEFINITIONS[n.type];
      if (def) {
        if (n.type === 'output_export') {
          if (hasOutputNode) return;
          hasOutputNode = true;
        }
        this.nodes.set(n.id, {
          id: n.id,
          type: n.type,
          x: n.x,
          y: n.y,
          params: { ...def.defaultParams, ...n.params },
          cachedOutputs: null,
          isExecuting: false,
          error: null
        });
      }
    });

    if (Array.isArray(data.connections)) {
      this.connections = data.connections.filter(c => 
        this.nodes.has(c.fromNode) && this.nodes.has(c.toNode)
      );
    }

    this.notifyUpdate();
    this.requestEvaluate();
  }
}

window.GraphModel = GraphModel;
