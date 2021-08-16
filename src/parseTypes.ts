import * as t from "@babel/types";
import { Parser } from "./Parser";
import { ParserOptionalProps } from "./types";

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
  getParser: () => Parser<any>,
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
            parse(property.value, getParser());
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
    // on: {
    //   key: Identifier,
    //   value: ObjectExpressionWithUnknownKeys({
    //     key: Identifier,
    //     value: TransitionConfigOrArray,
    //   }),
    // },
  });

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
