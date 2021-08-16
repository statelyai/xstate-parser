import * as t from "@babel/types";
import { Parser } from "./Parser";
import { Location, ParserOptionalProps } from "./types";

const StateNodeId = new Parser({
  name: "StateNodeId",
  babelMatcher: t.isStringLiteral,
  getMetaFromNode: (node, context) => {
    context.updateCurrentState((state) => {
      state.id = {
        value: node.value,
        loc: node.loc,
      };
    });
  },
});

const StateNodeInitial = new Parser({
  name: "StateNodeInitial",
  babelMatcher: t.isStringLiteral,
  getMetaFromNode: (node, context) => {
    context.updateCurrentState((state) => {
      state.initial = {
        value: node.value,
        loc: node.loc,
      };
    });
  },
});

const StateNodeType = new Parser({
  name: "StateNodeType",
  babelMatcher: t.isStringLiteral,
  getMetaFromNode: (node, ctx) => {
    ctx.updateCurrentState((state) => {
      state.type = {
        loc: node.loc,
        value: node.value,
      };
    });
  },
});

const UnionType = (parsers: Parser<any>[]) =>
  new Parser({
    name: "UnionType",
    babelMatcher: (node: any): node is any => {
      return parsers.some((parser) => parser.matches(node));
    },
    getMetaFromNode: (node, context, parse) => {
      const matchingParser = parsers.find((parser) => parser.matches(node));
      if (matchingParser) {
        parse(node, matchingParser);
      }
    },
  });

const Identifier = new Parser({
  babelMatcher: t.isIdentifier,
  name: "Identifier",
});

const StringLiteral = (opts?: ParserOptionalProps<t.StringLiteral>) =>
  new Parser({
    ...opts,
    babelMatcher: t.isStringLiteral,
    name: "StringLiteral",
  });

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
  getMetaFromNode: (node, context, parse) => {
    let calleeName = "";

    if (t.isIdentifier(node.callee)) {
      calleeName = node.callee.name;
    } else if (t.isMemberExpression(node.callee)) {
      if (t.isIdentifier(node.callee.property)) {
        calleeName = node.callee.property.name;
      }
    }

    if (!calleeName) return;

    context.enterNewMachine({
      loc: node.loc,
      name: calleeName,
    });

    parse(node.arguments[0], StateNode());
  },
});

const ObjectExpressionWithKnownKeys = (
  object: Record<string, Parser<any>>,
  opts?: ParserOptionalProps<t.ObjectExpression>,
) =>
  new Parser({
    ...opts,
    name: "ObjectExpressionWithKnownKeys",
    babelMatcher: t.isObjectExpression,
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

const ObjectExpressionWithUnknownKeys = (
  getParser: (key: string) => Parser<any>,
  opts?: ParserOptionalProps<t.ObjectExpression>,
) =>
  new Parser({
    ...opts,
    name: "ObjectExpressionWithUnknownKeys",
    babelMatcher: t.isObjectExpression,
    getChildren: (parse, node) => {
      node.properties.forEach((property) => {
        if (t.isObjectProperty(property)) {
          if (t.isIdentifier(property.key)) {
            parse(property.value, getParser(property.key.name));
          }
        }
      });
    },
  });

const StateNode = () =>
  ObjectExpressionWithKnownKeys({
    id: StateNodeId,
    initial: StateNodeInitial,
    states: StateNodeStates,
    type: StateNodeType,
    invoke: Invoke,
    on: TransitionsMap,
  });

const TransitionTarget = (key: string) =>
  StringLiteral({
    getMetaFromNode: (node, context) => {
      context.updateCurrentState((state) => {
        state.transitions[key].targets.push({
          target: node.value,
        });
      });
    },
  });

const TransitionConfig = (key: string) =>
  ObjectExpressionWithKnownKeys({
    target: TransitionTarget(key),
  });

const ArrayOf = (parser: Parser<any>) =>
  new Parser({
    babelMatcher: t.isArrayExpression,
    name: "ArrayOf",
    getChildren: (parse, node) => {
      node.elements.forEach((element) => {
        parse(node, parser);
      });
    },
  });

const TransitionConfigOrTarget = (key: string) =>
  UnionType([TransitionTarget(key), TransitionConfig(key)]);

const TransitionConfigOrArray = (key: string) =>
  UnionType([
    TransitionConfigOrTarget(key),
    ArrayOf(TransitionConfigOrTarget(key)),
  ]);

const TransitionsMap = ObjectExpressionWithUnknownKeys(
  (key) => TransitionConfigOrArray(key),
  {
    getMetaFromNode: (node, context) => {
      node.properties.forEach((property) => {
        if (t.isObjectProperty(property)) {
          context.updateCurrentState((state) => {
            if (t.isIdentifier(property.key)) {
              state.transitions[property.key.name] = {
                keyLoc: property.key.loc,
                valueLoc: property.value.loc,
                targets: [],
              };
            }
          });
        }
      });
    },
  },
);

const StateNodeStates = new Parser({
  babelMatcher: t.isObjectExpression,
  name: "StateNodeStates",
  getMetaFromNode: (node, ctx, parse) => {
    node.properties.forEach((property) => {
      if (t.isObjectProperty(property)) {
        if (t.isIdentifier(property.key)) {
          ctx.enterNewState(
            property.key.name,
            property.key.loc,
            property.value.loc,
          );
          parse(property.value, StateNode());
          ctx.exitState();
        }
      }
    });
  },
});

const InvokeSrc = new Parser({
  name: "InvokeSrc",
  babelMatcher: t.isStringLiteral,
  getMetaFromNode: (node, ctx) => {
    ctx.updateCurrentState((state) => {
      state.invokes[state.invokes.length - 1].src = {
        value: node.value,
        loc: node.loc,
      };
    });
  },
});

const InvokeId = new Parser({
  name: "InvokeId",
  babelMatcher: t.isStringLiteral,
  getMetaFromNode: (node, ctx) => {
    ctx.updateCurrentState((state) => {
      state.invokes[state.invokes.length - 1].id = {
        value: node.value,
        loc: node.loc,
      };
    });
  },
});

const InvokeConfig = ObjectExpressionWithKnownKeys(
  {
    src: InvokeSrc,
    id: InvokeId,
  },
  {
    getMetaFromNode: (node, ctx) => {
      ctx.updateCurrentState((state) => {
        state.invokes.push({
          loc: node.loc,
        });
      });
    },
  },
);

const Invoke = UnionType([InvokeConfig]);

interface SimpleParser<T extends t.Node> {
  parse: (node: T) => void;
  matches: (node: T) => boolean;
}

const simpleParser =
  <Props, T extends t.Node>(params: {
    babelMatcher: (node: any) => node is T;
    parseNode: (node: T, props: Props) => void;
  }) =>
  (props: Props): SimpleParser<T> => {
    const matches = (node: T) => {
      return params.babelMatcher(node);
    };
    const parse = (node: T) => {
      if (!matches(node)) return;
      params.parseNode(node, props);
    };
    return {
      parse,
      matches,
    };
  };

const ActionAsIdentifier = simpleParser({
  babelMatcher: t.isIdentifier,
  parseNode: (
    node,
    props: {
      onActionFound: (value: string, loc: Location) => void;
    },
  ) => {
    props.onActionFound(node.name, node.loc);
  },
});

const ActionAsString = simpleParser({
  babelMatcher: t.isStringLiteral,
  parseNode: (
    node,
    props: {
      onActionFound: (value: string, loc: Location) => void;
    },
  ) => {
    props.onActionFound(node.value, node.loc);
  },
});

const unionType =
  <Props>(parsers: ((props: Props) => SimpleParser<any>)[]) =>
  (props: Props): SimpleParser<any> => {
    const parsersWithProps = parsers.map((parser) => parser(props));
    const matches = (node: any) => {
      return parsersWithProps.some((parser) => parser.matches(node));
    };
    const parse = (node: any) => {
      const parser = parsersWithProps.find((parser) => parser.matches(node));
      parser?.parse(node);
    };

    return {
      matches,
      parse,
    };
  };

const Action = unionType([ActionAsIdentifier, ActionAsString]);
