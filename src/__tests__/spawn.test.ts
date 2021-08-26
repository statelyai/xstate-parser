import { parseMachinesFromFile } from "../parseMachinesFromFile";
import { testUtils } from "../testUtils";
import { ParseResultLink } from "../types";

describe("Links between machines", () => {
  it("Should grab the identifier names", () => {
    const result = parseMachinesFromFile(`
      const childMachine = createMachine({});

      const parentMachine = createMachine({});
    `);

    expect(result.machines[0].ast?.machineVariableName).toEqual("childMachine");
    expect(result.machines[1].ast?.machineVariableName).toEqual(
      "parentMachine",
    );
  });

  it.only("Should grab a parent/child link", () => {
    const result = parseMachinesFromFile(`
      const childMachine = createMachine({});

      const parentMachine = createMachine({
        entry: [
          assign((context, event) => {
            return {
              wow: spawn(childMachine),
            };
          }),
        ],
      });
    `);

    expect(result.links[0]).toEqual({
      sourceIndex: 0,
      parentIndex: 1,
    } as ParseResultLink);
  });
});
