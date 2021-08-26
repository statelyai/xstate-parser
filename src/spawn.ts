import * as t from "@babel/types";
import {
  createParser,
  GetParserResult,
  namedFunctionCall,
  wrapParserResult,
} from "./utils";

export type SpawnActionParseResult = GetParserResult<typeof SpawnAction>;

export const SpawnAction = wrapParserResult(
  namedFunctionCall(
    "spawn",
    createParser({
      babelMatcher: t.isIdentifier,
      parseNode: (node) => {
        return node;
      },
    }),
  ),
  (result) => {
    return {
      node: result.node,
      machineName: result.argument1Result?.name,
      machineIdentifier: result.argument1Result,
    };
  },
);
