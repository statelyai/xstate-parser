import { parseMachinesFromFile } from "..";

describe("Imports and exports", () => {
  it("Should pick up an identifier exported from a separate file", () => {
    const file1 = `
      import { options } from './options';

      createMachine({}, options);
    `;

    const optionsFile = `
      export const options = {
        actions: {
          nice: () => {},
        }
      }
    `;

    const result = parseMachinesFromFile(file1, {
      resolveRequire: () => optionsFile,
    });

    expect(result.machines[0].ast?.options).toBeTruthy();
  });
});
