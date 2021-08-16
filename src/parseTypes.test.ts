import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import { MachineCallExpression, parse, ParseResult } from "./parseTypes";

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
    const result = testParser(`createMachine({ id: 'wow' })`);

    expect(result[1].id?.value).toEqual("wow");
  });
});
