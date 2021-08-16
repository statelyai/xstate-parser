import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import { parse } from "./parse";
import { MachineCallExpression } from "./parseTypes";
import { ParseResult } from "./types";

const testParser = (fileContents: string) => {
  const parseResult = parser.parse(fileContents, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });
  let result: ParseResult = undefined as unknown as ParseResult;
  traverse(parseResult as any, {
    CallExpression(path: any) {
      result = parse(path.node, MachineCallExpression);
    },
  });

  return result;
};

describe("parseTypes", () => {
  test("it should handle ids correctly", () => {
    const result = testParser(`createMachine({ id: 'wow', type: 'atomic' })`);

    expect(result[1].meta.id?.value).toEqual("wow");
    expect(result[1].meta.type?.value).toEqual("atomic");
  });

  test("it should handle nested states correctly", () => {
    const result = testParser(`createMachine({ states: {
      a: {},
      b: {
        states: {
          b1: {},
          b2: {}
        },
      },
      c: {}
    } })`);

    expect(Object.keys(result[1].meta.states)).toEqual(["a", "b", "c"]);
    expect(Object.keys(result[1].meta.states.b.states)).toEqual(["b1", "b2"]);
  });
});
