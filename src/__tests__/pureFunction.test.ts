import { parseMachinesFromFile } from "../parseMachinesFromFile";

describe("pureFunction", () => {
  it("Should calculate functions with expressions as pure", () => {
    const { machines } = parseMachinesFromFile(`
      createMachine({
        entry: [(context) => context]
      })
    `);
    const result = machines[0];

    expect(result.ast?.definition?.entry?.[0].isPureFunction).toEqual(true);
  });

  it("Should calculate functions with bodies as pure", () => {
    const { machines } = parseMachinesFromFile(`
      createMachine({
        entry: [(context) => {
          context.cool;
        }]
      })
    `);
    const result = machines[0];

    expect(result.ast?.definition?.entry?.[0].isPureFunction).toEqual(true);
  });
});
