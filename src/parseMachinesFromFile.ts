import * as parser from "@babel/parser";
import * as t from "@babel/types";
import traverse from "@babel/traverse";
import { MachineConfig } from "xstate";
import { MachineCallExpression } from "./machineCallExpression";
import { MachineParseResult } from "./MachineParseResult";
import { SpawnAction, SpawnActionParseResult } from "./spawn";
import { toMachineConfig } from "./toMachineConfig";
import { ParseResult } from "./types";

export const parseMachinesFromFile = (fileContents: string): ParseResult => {
  if (
    !fileContents.includes("createMachine") &&
    !fileContents.includes("Machine")
  ) {
    return {
      machines: [],
      links: [],
    };
  }

  const parseResult = parser.parse(fileContents, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });

  let result: ParseResult = {
    machines: [],
    links: [],
  };

  const spawnCalls: SpawnActionParseResult[] = [];

  traverse(parseResult as any, {
    CallExpression(path: any) {
      const ast = MachineCallExpression.parse(path.node, {
        file: parseResult,
      });
      if (ast) {
        result.machines.push(new MachineParseResult({ ast }));
      }

      const spawnAst = SpawnAction.parse(path.node, { file: parseResult });

      if (spawnAst) {
        spawnCalls.push(spawnAst);
      }
    },
  });

  spawnCalls.forEach((spawnCall) => {
    if (!spawnCall?.machineName) return;

    const sourceMachineIndex = result.machines.findIndex(
      (machine) => machine.ast?.machineVariableName === spawnCall.machineName,
    );

    const parentMachineIndex = result.machines.findIndex((machine) =>
      isWithinLoc(machine.ast?.definition?.node, spawnCall.node),
    );

    if (sourceMachineIndex === -1 || parentMachineIndex === -1) {
      return;
    }

    result.links.push({
      parentIndex: parentMachineIndex,
      sourceIndex: sourceMachineIndex,
    });
  });

  return result;
};

const isWithinLoc = (parent: t.Node | undefined, child: t.Node | undefined) => {
  if (!parent?.loc || !child?.loc) return false;

  const isBeforeFirst =
    child.loc?.start.line < parent.loc?.start.line ||
    (child.loc?.start.line === parent.loc?.start.line &&
      child.loc?.start.column < parent.loc?.start.column);

  const isAfterLast =
    child.loc?.end.line > parent.loc?.end.line ||
    (child.loc?.end.line === parent.loc?.end.line &&
      child.loc?.end.column > parent.loc?.end.column);

  return !(isBeforeFirst || isAfterLast);
};
