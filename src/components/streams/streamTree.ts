import type { PathItem } from '@src/types/stream';

export interface StreamTreeBranch {
  type: 'branch';
  id: string;
  label: string;
  children: StreamTreeNode[];
}

export interface StreamTreeLeaf {
  type: 'leaf';
  id: string;
  label: string;
  stream: PathItem;
}

export type StreamTreeNode = StreamTreeBranch | StreamTreeLeaf;

interface MutableBranch {
  label: string;
  branches: Map<string, MutableBranch>;
  leaves: StreamTreeLeaf[];
}

function createBranch(label: string): MutableBranch {
  return {
    label,
    branches: new Map(),
    leaves: [],
  };
}

function toTreeNodes(branch: MutableBranch, path: string[]): StreamTreeNode[] {
  const branches = Array.from(branch.branches.entries()).map(([segment, child]) => ({
    type: 'branch' as const,
    id: [...path, segment].join('/'),
    label: child.label,
    children: toTreeNodes(child, [...path, segment]),
  }));

  return [...branches, ...branch.leaves];
}

export function buildStreamTree(streams: PathItem[]): StreamTreeNode[] {
  const root = createBranch('');

  streams.forEach((stream) => {
    const segments = stream.name.split('/').filter(Boolean);
    const leafLabel = segments.at(-1) ?? stream.name;
    let current = root;

    segments.slice(0, -1).forEach((segment) => {
      const child = current.branches.get(segment) ?? createBranch(segment);
      current.branches.set(segment, child);
      current = child;
    });

    current.leaves.push({
      type: 'leaf',
      id: stream.name,
      label: leafLabel,
      stream,
    });
  });

  return toTreeNodes(root, []);
}
