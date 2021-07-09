import fs from "fs";
import path from "path";
import { StateMachine } from "xstate";
import { testUtils } from "../src/testUtils";

const examples = fs.readdirSync(path.resolve(__dirname, "../examples"));

describe("Examples", () => {
  examples.forEach((example) => {
    test(example, async () => {
      const exampleMachineImports = require(`../examples/${example}`);

      const exampleMachines: StateMachine<any, any, any>[] = Object.values(
        exampleMachineImports,
      );

      const parsedMachines = await testUtils.parseFileFromExamplesDir(example);

      exampleMachines.forEach((machine, index) => {
        try {
          expect(testUtils.withoutContext(machine.config)).toEqual(
            parsedMachines[index].config,
          );
        } catch (e) {
          // Allow a pass if it serializes to the same string
          expect(e.message).toContain(
            "Received: serializes to the same string",
          );
        }
      });
    });
  });
});
