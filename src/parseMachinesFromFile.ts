import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import { MachineConfig } from "xstate";
import { MachineCallExpression } from "./machineCallExpression";
import { MachineParseResult } from "./MachineParseResult";
import { toMachineConfig } from "./toMachineConfig";
import { ParseResult } from "./types";

export const parseMachinesFromFile = (fileContents: string): ParseResult => {
  if (
    !fileContents.includes("createMachine") &&
    !fileContents.includes("Machine")
  ) {
    return {
      machines: [],
      unparseableNodes: [],
    };
  }

  const parseResult = parser.parse(fileContents, {
    sourceType: "module",
    plugins: [
      "typescript",
      "jsx",
      ["decorators", { decoratorsBeforeExport: false }],
    ],
  });

  let result: ParseResult = {
    machines: [],
    unparseableNodes: [],
  };

  traverse(parseResult as any, {
    CallExpression(path: any) {
      const ast = MachineCallExpression.parse(path.node, {
        file: parseResult,
        reportCouldNotParseError: (node) => {
          result.unparseableNodes.push({ node });
        },
      });
      if (ast) {
        result.machines.push(new MachineParseResult({ ast }));
      }
    },
  });

  return result;
};
