import * as t from "@babel/types";
import { Parser } from "./types";
import {
  arrayOf,
  createParser,
  eventUtils,
  objectTypeWithKnownKeys,
  objectTypeWithUnknownKeys,
  unionType,
  wrapParserResult,
} from "./utils";

const ActionAsIdentifier = createParser({
  babelMatcher: t.isIdentifier,
  parseNode: (node) => {
    return [
      {
        type: "ACTION",
        name: node.name,
        loc: node.loc,
      },
    ];
  },
});

const ActionAsString = createParser({
  babelMatcher: t.isStringLiteral,
  parseNode: (node) => {
    return [
      {
        type: "ACTION",
        name: node.value,
        loc: node.loc,
      },
    ];
  },
});

const ActionAsNode = createParser({
  babelMatcher: t.isNode,
  parseNode: (node) => {
    return [
      {
        type: "ACTION",
        name: "anonymous",
        loc: node.loc,
      },
    ];
  },
});

const Action = unionType([ActionAsString, ActionAsIdentifier, ActionAsNode]);

const ArrayOfActions = (
  keyType: "ENTRY_ACTIONS" | "EXIT_ACTIONS" | "TRANSITION_ACTIONS",
) =>
  wrapParserResult(unionType([arrayOf(Action), Action]), (events, node) => {
    const actions = eventUtils.filter("ACTION", events);

    return [
      {
        type: keyType,
        actions,
        loc: node.loc,
      },
    ];
  });

const StateNodeId = createParser({
  babelMatcher: t.isStringLiteral,
  parseNode: (node) => {
    return [
      {
        type: "ID",
        loc: node.loc,
        value: node.value,
      },
    ];
  },
});

const StateNodeInitial = createParser({
  babelMatcher: t.isStringLiteral,
  parseNode: (node) => {
    return [
      {
        type: "INITIAL",
        loc: node.loc,
        value: node.value,
      },
    ];
  },
});

const TransitionTargetLiteral = createParser({
  babelMatcher: t.isStringLiteral,
  parseNode: (node) => {
    return [
      {
        type: "TRANSITION_TARGET_LITERAL",
        target: node.value,
        loc: node.loc,
      },
    ];
  },
});

const CondAsStringLiteral = createParser({
  babelMatcher: t.isStringLiteral,
  parseNode: (node) => {
    return [
      {
        type: "COND",
        loc: node.loc,
        name: node.value,
      },
    ];
  },
});

const CondAsNode = createParser({
  babelMatcher: t.isNode,
  parseNode: (node) => {
    return [
      {
        type: "COND",
        loc: node.loc,
        name: "anonymous",
      },
    ];
  },
});

const Cond = unionType([CondAsStringLiteral, CondAsNode]);

const TransitionConfig = objectTypeWithKnownKeys({
  target: TransitionTargetLiteral,
  actions: ArrayOfActions("TRANSITION_ACTIONS"),
  cond: Cond,
});

const TransitionConfigOrLiteral = wrapParserResult(
  unionType([TransitionTargetLiteral, TransitionConfig]),
  (events, node) => {
    return [
      {
        type: "TRANSITION_TARGET",
        target: eventUtils.find("TRANSITION_TARGET_LITERAL", events),
        loc: node.loc,
        actions: eventUtils.find("TRANSITION_ACTIONS", events),
        cond: eventUtils.find("COND", events),
      },
    ];
  },
);

const TransitionArray = unionType([
  arrayOf(TransitionConfigOrLiteral),
  TransitionConfigOrLiteral,
]);

const OnDeclaration = wrapParserResult(
  objectTypeWithUnknownKeys,
  (events, node) => {
    const keys = eventUtils.filter("KEY_OF_OBJECT", events);
    return [
      {
        type: "ON_DECLARATION",
        loc: node.loc,
        transitions: keys.map((key) => {
          const result = TransitionArray.parse(key.valueNode);
          return {
            type: "TRANSITION_ARRAY_DECLARATION",
            event: key.key,
            eventLoc: key.keyNode.loc,
            transitions: eventUtils.filter("TRANSITION_TARGET", result),
          };
        }),
      },
    ];
  },
);

const InvokeIdStringLiteral = createParser({
  babelMatcher: t.isStringLiteral,
  parseNode: (node) => {
    return [
      {
        type: "INVOKE_ID",
        loc: node.loc,
        value: node.value,
      },
    ];
  },
});

const InvokeSrcStringLiteral = createParser({
  babelMatcher: t.isStringLiteral,
  parseNode: (node) => {
    return [
      {
        type: "INVOKE_SRC",
        loc: node.loc,
        value: node.value,
      },
    ];
  },
});

const InvokeSrcNode = createParser({
  babelMatcher: t.isNode,
  parseNode: (node) => {
    return [
      {
        type: "INVOKE_SRC",
        value: "anonymous",
        loc: node.loc,
      },
    ];
  },
});

const InvokeConfigObject = wrapParserResult(
  objectTypeWithKnownKeys({
    id: InvokeIdStringLiteral,
    src: unionType([InvokeSrcStringLiteral, InvokeSrcNode]),
    onDone: wrapParserResult(TransitionArray, (events, node) => {
      return [
        {
          type: "INVOKE_ON_DONE",
          loc: node.loc,
          transitions: eventUtils.filter("TRANSITION_TARGET", events),
        },
      ];
    }),
    onError: wrapParserResult(TransitionArray, (events, node) => {
      return [
        {
          type: "INVOKE_ON_ERROR",
          loc: node.loc,
          transitions: eventUtils.filter("TRANSITION_TARGET", events),
        },
      ];
    }),
  }),
  (events, node) => {
    return [
      {
        type: "INVOKE",
        id: eventUtils.find("INVOKE_ID", events),
        src: eventUtils.find("INVOKE_SRC", events),
        loc: node.loc,
        onDone: eventUtils.find("INVOKE_ON_DONE", events),
        onError: eventUtils.find("INVOKE_ON_ERROR", events),
      },
    ];
  },
);

const Invoke = wrapParserResult(
  unionType([arrayOf(InvokeConfigObject), InvokeConfigObject]),
  (events, node) => {
    return [
      {
        type: "INVOKE_ARRAY",
        loc: node.loc,
        services: eventUtils.filter("INVOKE", events),
      },
    ];
  },
);

const AlwaysDeclaration = wrapParserResult(TransitionArray, (events, node) => {
  return [
    {
      type: "ALWAYS_DECLARATION",
      loc: node.loc,
      transitions: eventUtils.filter("TRANSITION_TARGET", events),
    },
  ];
});

const StatesDeclaration: Parser = wrapParserResult(
  objectTypeWithUnknownKeys,
  (events, node) => {
    const keys = eventUtils.filter("KEY_OF_OBJECT", events);

    return [
      {
        type: "STATES",
        loc: node.loc,
        nodes: keys.map((key) => {
          const stateNode = eventUtils.find(
            "STATE_NODE",
            StateNode.parse(key.valueNode),
          );

          return {
            type: "CHILD_STATE",
            key: key.key,
            keyLoc: key.keyNode.loc,
            node: stateNode,
          };
        }),
      },
    ];
  },
);

const StateNode = wrapParserResult(
  objectTypeWithKnownKeys({
    id: StateNodeId,
    initial: StateNodeInitial,
    onEntry: ArrayOfActions("ENTRY_ACTIONS"),
    onExit: ArrayOfActions("EXIT_ACTIONS"),
    entry: ArrayOfActions("ENTRY_ACTIONS"),
    exit: ArrayOfActions("EXIT_ACTIONS"),
    on: OnDeclaration,
    always: AlwaysDeclaration,
    states: StatesDeclaration,
    invoke: Invoke,
  }),
  (events, node) => {
    return [
      {
        type: "STATE_NODE",
        loc: node.loc,
        entryActions: eventUtils.find("ENTRY_ACTIONS", events),
        exitActions: eventUtils.find("EXIT_ACTIONS", events),
        states: eventUtils.find("STATES", events),
        id: eventUtils.find("ID", events),
        initial: eventUtils.find("INITIAL", events),
        on: eventUtils.find("ON_DECLARATION", events),
        invoke: eventUtils.find("INVOKE_ARRAY", events),
      },
    ];
  },
);

export const MachineCallExpression = createParser({
  babelMatcher: t.isCallExpression,
  parseNode: (node) => {
    if (
      t.isMemberExpression(node.callee) &&
      t.isIdentifier(node.callee.property) &&
      ["createMachine", "Machine"].includes(node.callee.property.name)
    ) {
      return [
        {
          type: "MACHINE_CALLEE",
          callee: node.callee,
          calleeName: node.callee.property.name,
          definition: eventUtils.find(
            "STATE_NODE",
            StateNode.parse(node.arguments[0]),
          ),
        },
      ];
    }

    if (
      t.isIdentifier(node.callee) &&
      ["createMachine", "Machine"].includes(node.callee.name)
    ) {
      return [
        {
          type: "MACHINE_CALLEE",
          callee: node.callee,
          calleeName: node.callee.name,
          definition: eventUtils.find(
            "STATE_NODE",
            StateNode.parse(node.arguments[0]),
          ),
        },
      ];
    }
  },
});
