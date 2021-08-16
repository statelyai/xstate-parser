import fs from "fs";
import path from "path";
import { createMachine, StateMachine } from "xstate";
import { testUtils } from "../testUtils";
import { parseMachinesFromFile } from "../transform";

const examples = fs.readdirSync(path.resolve(__dirname, "../../examples"));

describe("Examples", () => {
  examples.forEach((example) => {
    test(example, async () => {
      const exampleMachineImports = require(`../../examples/${example}`);

      const exampleMachines: StateMachine<any, any, any>[] = Object.values(
        exampleMachineImports,
      );

      const fileAsString = fs
        .readFileSync(path.resolve(__dirname, "../../examples", example))
        .toString();

      const parsedMachines = parseMachinesFromFile(fileAsString);

      exampleMachines.forEach((machine, index) => {
        try {
          expect(testUtils.withoutContext(machine.config)).toEqual(
            createMachine(parsedMachines[index].config).config,
          );
        } catch (e) {
          if (!e.message.includes("Received: serializes to the same string")) {
            throw e;
          }
        }

        //   parsedMachines[index].statesMeta.forEach((state) => {
        //     expect(
        //       exampleMachines[index].getStateNodeByPath(state.path),
        //     ).toBeTruthy();
        //     state.targets.forEach((target) => {
        //       const targetFromText = fileAsString.slice(
        //         target.location.start.absoluteChar,
        //         target.location.end.absoluteChar,
        //       );

        //       expect(targetFromText.slice(1, -1)).toEqual(target.target);
        //     });
        //   });
      });
    });
  });
});
