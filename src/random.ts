import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";
import { Parser, ParserContext } from ".";
import { createParser } from "./createParser";
import { unionType } from "./unionType";
import { GetParserResult } from "./utils";

export const parseControlFlowFromFunction = (fileContents: string) => {
  const parseResult = parser.parse(fileContents, {
    sourceType: "module",
    plugins: [
      "typescript",
      "jsx",
      ["decorators", { decoratorsBeforeExport: false }],
    ],
  });

  const result: (GetParserResult<typeof arrowFunction> | undefined)[] = [];

  traverse(parseResult as any, {
    ArrowFunctionExpression(path) {
      result.push(
        arrowFunction.parse(path.node as any, {
          file: parseResult,
        }),
      );
    },
  });

  return result;
};

const arrowFunction = createParser({
  babelMatcher: t.isArrowFunctionExpression,
  parseNode(node, context) {
    return {
      _node: node,
      body: blockStatementToStateNode.parse(node.body, context),
    };
  },
});

const blockStatementToStateNode = createParser({
  babelMatcher: t.isBlockStatement,
  parseNode(node, context): StateNodeElement {
    return {
      _node: node,
      type: "task-state",
      states: node.body
        .filter((element) => stateNodeElement.matches(element))
        .map((element) => {
          return stateNodeElement.parse(element, context);
        }) as StateNodeElement[],
      comments: getComments(node, context),
    };
  },
});

const tryCatch = createParser({
  babelMatcher: t.isTryStatement,
  parseNode(node, context): StateNodeElement {
    return {
      type: "task-state",
      _node: node,
      onDone: stateNodeElement.parse(node.block, context),
      onError: stateNodeElement.parse(node.handler?.body, context),
      comments: getComments(node, context),
      // Consider finally clause
    };
  },
});

const ifStatement = createParser({
  babelMatcher: t.isIfStatement,
  parseNode(node, context): StateNodeElement {
    return {
      type: "choice-node",
      _node: node,
      onTrue: stateNodeElement.parse(node.consequent, context),
      onFalse: stateNodeElement.parse(node.alternate, context),
      comments: getComments(node, context),
    };
  },
});

const returnStatement = createParser({
  babelMatcher: t.isReturnStatement,
  parseNode(node, context): StateNodeElement {
    return {
      _node: node,
      type: "final-state",
      comments: getComments(node, context),
    };
  },
});

export interface StateNodeElement {
  type: "throw-final-state" | "final-state" | "task-state" | "choice-node";
  comments: string[];
  _node: t.Node;
  onTrue?: StateNodeElement;
  onFalse?: StateNodeElement;
  onDone?: StateNodeElement;
  onError?: StateNodeElement;
  states?: StateNodeElement[];
}

const getComments = (node: t.Node, context: ParserContext): string[] => {
  return (
    context.file.comments
      ?.filter((comment) => {
        if (!node.loc) return false;
        return comment.loc.start.line === node.loc?.start.line - 1;
      })
      .map((comment) => comment.value.replace(/^\*/, "").trim()) || []
  );
};

const throwStatement = createParser({
  babelMatcher: t.isThrowStatement,
  parseNode(node, context): StateNodeElement {
    return {
      _node: node,
      type: "throw-final-state",
      comments: getComments(node, context),
    };
  },
});

const stateNodeElement: Parser<t.Node, StateNodeElement> =
  unionType<StateNodeElement>([
    tryCatch,
    ifStatement,
    returnStatement,
    blockStatementToStateNode,
    throwStatement,
  ]);
