import { parseMachinesFromFile } from "..";
import * as t from "@babel/types";

describe("Unparseable nodes", () => {
  it("Should declare a state from a function as an unparseable node", () => {
    const result = parseMachinesFromFile(`
      const func = () => {}

      createMachine({
        states: func()
      })
    `);

    expect(result.unparseableNodes).toHaveLength(1);

    const node = result.unparseableNodes[0].node;

    expect(t.isCallExpression(node)).toBeTruthy();
  });
});
