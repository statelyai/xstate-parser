import { parseMachinesFromFile } from "../parseMachinesFromFile";

describe("Choose", () => {
  it("Should pick up all names of actions used", () => {
    const result = parseMachinesFromFile(`
      createMachine({
        entry: [
          choose({
            cond: () => true,
            actions: ['wow', 'cool']
          })
        ]
      })
    `);

    expect(result.machines[0].getAllNamedActions().wow).toBeTruthy();
    expect(result.machines[0].getAllNamedActions().cool).toBeTruthy();
  });
});
