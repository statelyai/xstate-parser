import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import { MachineCallExpression, parse, ParseContext } from "./parseTypes";

const testParser = (fileContents: string): ParseContext => {
  const parseResult = parser.parse(fileContents, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });
  let result: any;
  traverse(parseResult as any, {
    CallExpression(path: any) {
      result = parse(path.node, MachineCallExpression);
    },
  });

  return result;
};

describe("parseTypes", () => {
  test("bleh", () => {
    const result = testParser(`createMachine({ id: 'wow' })`);

    console.log(result);
  });
});
