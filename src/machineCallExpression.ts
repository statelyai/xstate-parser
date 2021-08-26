import * as t from "@babel/types";
import { StateNode } from "./stateNode";
import { createParser, GetParserResult } from "./utils";
import { MachineOptions } from "./options";
import traverse from "@babel/traverse";

export type TMachineCallExpression = GetParserResult<
  typeof MachineCallExpression
>;

export const MachineCallExpression = createParser({
  babelMatcher: t.isCallExpression,
  parseNode: (node, context) => {
    if (
      t.isMemberExpression(node.callee) &&
      t.isIdentifier(node.callee.property) &&
      ["createMachine", "Machine"].includes(node.callee.property.name)
    ) {
      return {
        callee: node.callee,
        calleeName: node.callee.property.name,
        definition: StateNode.parse(node.arguments[0], context),
        options: MachineOptions.parse(node.arguments[1], context),
        variableDeclarator: undefined,
        machineVariableName: undefined,
      };
    }

    if (
      t.isIdentifier(node.callee) &&
      ["createMachine", "Machine"].includes(node.callee.name)
    ) {
      let variableDeclarator: t.VariableDeclarator | undefined = undefined;
      let machineVariableName: string | undefined = undefined;

      traverse(context.file as any, {
        VariableDeclarator: (variableDeclaratorPath) => {
          if (
            t.isCallExpression(variableDeclaratorPath.node.init) &&
            t.isIdentifier(variableDeclaratorPath.node.init.callee) &&
            isInSameLoc(variableDeclaratorPath.node.init.callee, node.callee)
          ) {
            variableDeclarator =
              variableDeclaratorPath.node as t.VariableDeclarator;

            if (t.isIdentifier(variableDeclaratorPath.node.id)) {
              machineVariableName = variableDeclaratorPath.node.id.name;
            }
          }
        },
      });

      return {
        callee: node.callee,
        calleeName: node.callee.name,
        definition: StateNode.parse(node.arguments[0], context),
        options: MachineOptions.parse(node.arguments[1], context),
        variableDeclarator,
        machineVariableName,
      };
    }
  },
});

const isInSameLoc = (node1: t.Node, node2: t.Node) => {
  return (
    node1.loc?.start.line === node2.loc?.start.line &&
    node1.loc?.end.line === node2.loc?.end.line &&
    node1.loc?.start.column === node2.loc?.start.column &&
    node1.loc?.end.column === node2.loc?.end.column
  );
};
