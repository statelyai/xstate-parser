import * as t from "@babel/types";

export type BabelMatcher<T extends t.Node> = (node: any) => node is T;

interface MachineMeta {
  callee: {
    name: string;
    loc: t.SourceLocation | null;
  };
}

export type ParseNode<T extends t.Node> = (
  node: T,
  context: ParseContext,
) => void;

export type GetChildren<T extends t.Node> = (
  parse: (node: t.Node) => void,
  node: T,
) => void;

export class ParseContext {
  private id = 0;
  private currentMachineId?: string;
  private currentStateId?: string;
  private machineMap: Record<string, Partial<MachineMeta>> = {};

  private incrementInternalId = () => this.id++;

  registerNewMachine = (callee: MachineMeta["callee"]) => {
    this.incrementInternalId();
    this.currentMachineId = `${this.id}`;
    this.machineMap[this.id] = {
      callee,
    };
  };
}

class Parser<T extends t.Node = t.Node> {
  private babelMatcher: BabelMatcher<T>;
  private getMetaFromNode?: ParseNode<T>;
  private getChildren?: GetChildren<T>;
  constructor(props: {
    babelMatcher: BabelMatcher<T>;
    getMetaFromNode?: ParseNode<T>;
    getChildren?: GetChildren<T>;
  }) {
    this.babelMatcher = props.babelMatcher;
    this.getMetaFromNode = props.getMetaFromNode;
  }

  parse = (node: t.Node, context: ParseContext) => {
    const result = this.parseNode(node, context);

    if (!result) return result;

    const parseChildren = (node: t.Node) => {
      this.parseNode(node, context);
    };

    this.getChildren?.(parseChildren, node as any);
  };

  private parseNode = (node: t.Node, context: ParseContext) => {
    if (!this.babelMatcher(node)) return null;

    this.getMetaFromNode?.(node, context);
  };
}

const StateNodeId = new Parser({
  babelMatcher: t.isStringLiteral,
  getMetaFromNode: (node) => {
    return {
      stateMeta: {
        id: {
          value: node.value,
          loc: node.loc,
        },
      },
    };
  },
});

const StateNodeInitial = new Parser({
  babelMatcher: t.isStringLiteral,
  getMetaFromNode: (node) => {
    return {
      stateMeta: {
        id: {
          value: node.value,
          loc: node.loc,
        },
        initial: {
          loc: node.loc,
          value: node.value,
        },
      },
    };
  },
});

const StateNodeType = new Parser({
  babelMatcher: t.isStringLiteral,
  getMetaFromNode: (node) => {
    return {
      stateMeta: {
        type: {
          loc: node.loc,
          value: node.value,
        },
      },
    };
  },
});

const Identifier = new Parser({
  babelMatcher: t.isIdentifier,
});

const TransitionTarget = new Parser({
  babelMatcher: t.isStringLiteral,
  getMetaFromNode: (node) => {
    return {
      machineMeta: {
        newTarget: {
          target: node.value,
          loc: node.loc,
        },
      },
      stateMeta: {
        newTarget: {
          target: node.value,
          loc: node.loc,
        },
      },
    };
  },
});

export const MachineCallExpression = new Parser<t.CallExpression>({
  babelMatcher: (node): node is t.CallExpression => {
    if (!t.isCallExpression(node)) {
      return false;
    }
    let calleeName = "";

    if (t.isIdentifier(node.callee)) {
      calleeName = node.callee.name;
    } else if (t.isMemberExpression(node.callee)) {
      if (t.isIdentifier(node.callee.property)) {
        calleeName = node.callee.property.name;
      }
    }

    return ["Machine", "createMachine"].includes(calleeName);
  },
  getChildren: (parse, node) => {
    parse(node.callee);
  },
  getMetaFromNode: (node, context) => {
    let calleeName = "";

    if (t.isIdentifier(node.callee)) {
      calleeName = node.callee.name;
    } else if (t.isMemberExpression(node.callee)) {
      if (t.isIdentifier(node.callee.property)) {
        calleeName = node.callee.property.name;
      }
    }

    if (!calleeName) return;

    context.registerNewMachine({
      loc: node.loc,
      name: calleeName,
    });
  },
});

// const TransitionConfigObject = ObjectExpressionWithKnownKeys({
//   target: {
//     key: Identifier,
//     value: TransitionTarget,
//   },
// });

// const TransitionConfigOrTarget = UnionType([
//   TransitionTarget,
//   TransitionConfigObject,
// ]);

// const TransitionConfigOrArray = UnionType(
//   TransitionConfigOrTarget,
//   ArrayOf(TransitionConfigOrTarget),
// );

// const StateNode = ObjectExpressionWithKnownKeys({
//   id: {
//     key: Identifier,
//     value: StateNodeId,
//   },
//   initial: {
//     key: Identifier,
//     value: StateNodeInitial,
//   },
//   states: {
//     key: Identifier,
//     value: ObjectExpressionWithUnknownKeys({
//       key: Identifier,
//       value: StateNode,
//     }),
//   },
//   type: {
//     key: Identifier,
//     value: StateNodeType,
//   },
//   on: {
//     key: Identifier,
//     value: ObjectExpressionWithUnknownKeys({
//       key: Identifier,
//       value: TransitionConfigOrArray,
//     }),
//   },
// });

export const parse = (node: t.Node, parser: Parser<any>) => {
  const context = new ParseContext();
  parser.parse(node, context);
  return context;
};
