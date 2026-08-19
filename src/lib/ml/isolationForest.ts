interface TreeNode {
  isLeaf: boolean;
  size?: number;
  featureIndex?: number;
  splitValue?: number;
  left?: TreeNode;
  right?: TreeNode;
}

function buildTree(
  data: number[][],
  depth: number,
  maxDepth: number
): TreeNode {
  if (data.length <= 1 || depth >= maxDepth) {
    return { isLeaf: true, size: data.length };
  }

  const numFeatures = data[0].length;
  const featureIndex = Math.floor(Math.random() * numFeatures);
  const values = data.map(d => d[featureIndex]);
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return { isLeaf: true, size: data.length };
  }

  const splitValue = min + Math.random() * (max - min);
  const left  = data.filter(d => d[featureIndex] < splitValue);
  const right = data.filter(d => d[featureIndex] >= splitValue);

  return {
    isLeaf: false,
    featureIndex,
    splitValue,
    left:  buildTree(left,  depth + 1, maxDepth),
    right: buildTree(right, depth + 1, maxDepth),
  };
}

function pathLength(point: number[], node: TreeNode, depth: number): number {
  if (node.isLeaf) {
    return depth + averagePathLength(node.size ?? 1);
  }
  const fi = node.featureIndex!;
  if (point[fi] < node.splitValue!) {
    return pathLength(point, node.left!, depth + 1);
  }
  return pathLength(point, node.right!, depth + 1);
}

function averagePathLength(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
}

export class IsolationForest {
  private trees: TreeNode[] = [];
  private _isTrained = false;
  private subsampleSize: number;

  constructor(
    private numTrees = 100,
    subsampleSize = 256
  ) {
    this.subsampleSize = subsampleSize;
  }

  get isTrained(): boolean { return this._isTrained; }

  train(data: number[][]): void {
    if (data.length < 2) {
      console.warn('[IsolationForest] Need at least 2 samples to train');
      return;
    }

    const maxDepth = Math.ceil(Math.log2(Math.min(this.subsampleSize, data.length)));
    this.trees = [];

    for (let t = 0; t < this.numTrees; t++) {
      const subsample = this.sample(data, Math.min(this.subsampleSize, data.length));
      this.trees.push(buildTree(subsample, 0, maxDepth));
    }

    this._isTrained = true;
  }

  anomalyScore(point: number[]): number {
    if (!this._isTrained || this.trees.length === 0) return 0;

    const avgPath = this.trees.reduce(
      (sum, tree) => sum + pathLength(point, tree, 0),
      0
    ) / this.trees.length;

    const c = averagePathLength(this.subsampleSize);
    return Math.pow(2, -avgPath / c);
  }

  private sample<T>(arr: T[], n: number): T[] {
    const result: T[] = [];
    const copy = [...arr];
    for (let i = 0; i < n && copy.length > 0; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      result.push(copy.splice(idx, 1)[0]);
    }
    return result;
  }
}
