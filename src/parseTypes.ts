import * as t from "@babel/types";

export type BabelMatcher<T extends t.Node> = (node: any) => node is T;

interface MachineMeta {
  callee?: {
    name: string;
    loc: t.SourceLocation | null;
  };
  states: Record<string, StateMeta>;
  id?: {
    value: string;
    loc: t.SourceLocation | null;
  };
}

interface StateMeta {
  key: string;
  keyNode: {
    loc: t.SourceLocation | null;
  };
  valueNode: {
    loc: t.SourceLocation | null;
  };
}

export type GetMetaFromNode<T extends t.Node> = (
  node: T,
  context: ParseContext,
) => void;

export type GetChildren<T extends t.Node> = (
  parse: (node: t.Node, parser: Parser<any>) => void,
  node: T,
) => void;

export class ParseContext {
  private id = 0;
  private currentMachineId?: string;
  private currentStateId?: string;
  private machineMap: Record<string, MachineMeta> = {};

  private incrementInternalId = () => this.id++;

  registerNewMachine = (callee: MachineMeta["callee"]) => {
    this.incrementInternalId();
    this.currentMachineId = `${this.id}`;
    this.machineMap[this.id] = {
      callee,
      states: {},
    };
  };

  updateCurrentMachine = (update: (machine: MachineMeta) => void) => {
    if (!this.currentMachineId)
      throw new Error("No machine currently selected!");
    const currentMachine = this.machineMap[this.currentMachineId];
    update(currentMachine);
  };

  updateCurrentState = (update: (state: StateMeta) => void) => {
    if (!this.currentMachineId)
      throw new Error("No machine currently selected!");
    if (!this.currentStateId) throw new Error("No state currently selected!");
    const currentState =
      this.machineMap[this.currentMachineId].states[this.currentStateId];

    if (!currentState) {
      throw new Error("Could not find current state");
    }

    update(currentState);
  };

  registerNewState = (
    key: string,
    keyNodeLoc: t.SourceLocation,
    valueNodeLoc: t.SourceLocation,
  ) => {
    this.incrementInternalId();
    this.currentStateId = `${this.id}`;
    this.updateCurrentMachine((machine) => {
      machine.states[this.id] = {
        key,
        keyNode: {
          loc: keyNodeLoc,
        },
        valueNode: {
          loc: valueNodeLoc,
        },
      };
    });
  };

  getResult = () => this.machineMap;
}

class Parser<T extends t.Node = t.Node> {
  name: string;
  private babelMatcher: BabelMatcher<T>;
  private getMetaFromNode?: GetMetaFromNode<T>;
  private getChildren?: GetChildren<T>;
  constructor(props: {
    name: string;
    babelMatcher: BabelMatcher<T>;
    getMetaFromNode?: GetMetaFromNode<T>;
    getChildren?: GetChildren<T>;
  }) {
    this.name = props.name;
    this.babelMatcher = props.babelMatcher;
    this.getMetaFromNode = props.getMetaFromNode;
    this.getChildren = props.getChildren;
  }

  parse = (node: t.Node, context: ParseContext) => {
    this.parseNode(node, context);

    const parseChildren = (node: t.Node, parser: Parser) => {
      parser.parse(node, context);
    };

    this.getChildren?.(parseChildren, node as T);

    return context.getResult();
  };

  private parseNode = (node: t.Node, context: ParseContext) => {
    // console.log(this.name, node);
    if (!this.babelMatcher(node)) return null;

    this.getMetaFromNode?.(node, context);
  };
}

const StateNodeId = new Parser({
  name: "StateNodeId",
  babelMatcher: t.isStringLiteral,
  getMetaFromNode: (node, context) => {
    context.updateCurrentMachine((machine) => {
      machine.id = {
        value: node.value,
        loc: node.loc,
      };
    });
  },
});

const StateNodeInitial = new Parser({
  name: "StateNodeInitial",
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
  name: "StateNodeType",
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

// const Identifier = new Parser({
//   babelMatcher: t.isIdentifier,
// });

// const TransitionTarget = new Parser({
//   babelMatcher: t.isStringLiteral,
//   getMetaFromNode: (node) => {
//     return {
//       machineMeta: {
//         newTarget: {
//           target: node.value,
//           loc: node.loc,
//         },
//       },
//       stateMeta: {
//         newTarget: {
//           target: node.value,
//           loc: node.loc,
//         },
//       },
//     };
//   },
// });

export const MachineCallExpression = new Parser<t.CallExpression>({
  name: "MachineCallExpression",
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
    // console.log("HAY");
    parse(node.arguments[0], StateNode);
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

const ObjectExpressionWithKnownKeys = (
  object: Record<string, Parser<any>>,
  getMetaFromNode?: GetMetaFromNode<t.ObjectExpression>,
) =>
  new Parser({
    name: "ObjectExpressionWithKnownKeys",
    babelMatcher: t.isObjectExpression,
    getMetaFromNode: getMetaFromNode,
    getChildren: (parse, node) => {
      node.properties.forEach((property) => {
        if (t.isObjectProperty(property)) {
          if (t.isIdentifier(property.key)) {
            const parserForKey = object[property.key.name];
            if (parserForKey) {
              parse(property.value, parserForKey);
            }
          }
        }
      });
    },
  });

const StateNode = ObjectExpressionWithKnownKeys({
  id: StateNodeId,
  initial: StateNodeInitial,
  // states: {
  //   key: Identifier,
  //   value: ObjectExpressionWithUnknownKeys({
  //     key: Identifier,
  //     value: StateNode,
  //   }),
  // },
  type: StateNodeType,
  // on: {
  //   key: Identifier,
  //   value: ObjectExpressionWithUnknownKeys({
  //     key: Identifier,
  //     value: TransitionConfigOrArray,
  //   }),
  // },
});

export type ParseResult = Record<string, MachineMeta>;

export const parse = (node: t.Node, parser: Parser<any>): ParseResult => {
  const context = new ParseContext();
  return parser.parse(node, context);
};
