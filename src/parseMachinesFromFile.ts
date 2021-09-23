import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import { MachineConfig } from "xstate";
import { ParseOptions } from ".";
import { MachineCallExpression } from "./machineCallExpression";
import { MachineParseResult } from "./MachineParseResult";
import { toMachineConfig } from "./toMachineConfig";
import { ParseResult } from "./types";

export const parseMachinesFromFile = (
  fileContents: string,
  options?: ParseOptions,
): ParseResult => {
  if (
    !fileContents.includes("createMachine") &&
    !fileContents.includes("Machine")
  ) {
    return {
      machines: [],
    };
  }

  const parseResult = parser.parse(fileContents, {
    sourceType: "module",
    plugins: [
      "typescript",
      "jsx",
      ["decorators", { decoratorsBeforeExport: false }],
    ],
    sourceFilename: options?.sourceFilename,
  });

  let result: ParseResult = {
    machines: [],
  };

  traverse(parseResult as any, {
    CallExpression(path: any) {
      const ast = MachineCallExpression.parse(path.node, {
        file: parseResult,
        resolveRequire: options?.resolveRequire || (() => undefined),
      });
      if (ast) {
        result.machines.push(new MachineParseResult({ ast }));
      }
    },
  });

  return result;
};
