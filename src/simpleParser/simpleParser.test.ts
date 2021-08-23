import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import { MachineCallExpression, TMachineCallExpression } from "./simpleParser";
import { toMachineConfig } from "./toMachineConfig";

const testParser = (fileContents: string) => {
  const parseResult = parser.parse(fileContents, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });
  let result: TMachineCallExpression;
  traverse(parseResult as any, {
    CallExpression(path: any) {
      result = MachineCallExpression.parse(path.node);
    },
  });

  return toMachineConfig(result);
};

describe("parseTypes", () => {
  test("it should handle ids correctly", () => {
    const result = testParser(`createMachine({ id: 'wow', type: 'atomic' })`);

    // expect(result[1].meta.id?.value).toEqual("wow");
    // expect(result[1].meta.type?.value).toEqual("atomic");
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

    // expect(Object.keys(result[1].meta.states)).toEqual(["a", "b", "c"]);
    // expect(Object.keys(result[1].meta.states.b.states)).toEqual(["b1", "b2"]);
  });

  test("it should handle nested states correctly", () => {
    const result = testParser(`createMachine({ states: {
      a: {
        initial: 'wow',
        id: 'a',
      },
      b: {
        states: {
          b1: {},
          b2: {}
        },
      },
      c: {}
    } })`);

    // expect(Object.keys(result[1].meta.states)).toEqual(["a", "b", "c"]);
    // expect(Object.keys(result[1].meta.states.b.states)).toEqual(["b1", "b2"]);
  });

  test("it should handle entry actions", () => {
    const result = testParser(
      `createMachine({
        id: 'wow',
        entry: ['awesome', () => {}, function() {}],
        always: [],
        on: {
          COOL: [{
            target: 'yes',
            cond: 'yeah',
            actions: [() => {}, 'amazing']
          }, {
            target: 'next',
            cond: 'epic',
            actions: [() => {}, 'amazing']
          }],
        }

    })`,
    );
    console.log(JSON.stringify(result, null, 2));

    // expect(Object.keys(result[1].meta.states)).toEqual(["a", "b", "c"]);
    // expect(Object.keys(result[1].meta.states.b.states)).toEqual(["b1", "b2"]);
  });
});
