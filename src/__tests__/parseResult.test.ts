import { parseMachinesFromFile } from "../parseMachinesFromFile";

describe("MachineParseResult", () => {
  it("Should let you get a state node by path", () => {
    const result = parseMachinesFromFile(`
      createMachine({
        states: {
          a: {},
          b: {
            states: {
              b1: {}
            }
          }
        },
      })
    `);

    const machine = result.machines[0];

    expect(machine.getAllStateNodes()).toHaveLength(4);

    const aNode = machine.getStateNodeByPath(["a"]);

    expect(aNode?.path).toEqual(["a"]);

    const b1Node = machine.getStateNodeByPath(["b", "b1"]);

    expect(b1Node?.path).toEqual(["b", "b1"]);
  });

  it("Should let you list all of the transition target nodes", () => {
    const result = parseMachinesFromFile(`
      createMachine({
        onDone: ['state.onDone'],
        invoke: {
          onDone: ['invoke.onDone'],
          onError: ['invoke.onError']
        },
        always: ['always'],
        states: {
          a: {
            on: {
              WOW: [{
                target: 'WOW.object'
              }, 'WOW.string']
            }
          },
        },
      })
    `);

    const targets = result.machines[0].getTransitionTargets();

    // Doing a map here to improve the error messaging
    expect(targets.map((target) => target.target.value)).toHaveLength(6);
  });
});
