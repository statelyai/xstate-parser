import { MachineConfig, StateNodeConfig } from "xstate";
import { parseControlFlowFromFunction, StateNodeElement } from "../random";

const CODE = `
const createUser = async (age: number) => {
  const newAge = age / 1000;

  try {
    /** Create user */
    const user = await db.createUser();
  } catch (e) {
    /** Create user failed */
    throw e;
  }
  
  /** If has beta subscription */
  if (user.hasBetaSubscription) {
    /** Has beta subscription */
    return {
      hasBeta: true
    }
  }

  /** Has no beta subscription */
  return {
    hasBeta: false
  }
}
`;

const stateNodeElementToType = (stateNodeElement?: StateNodeElement) => {
  if (!stateNodeElement) {
    return undefined;
  }
  return {
    type: stateNodeElement.type,
    ...(stateNodeElement.states &&
      stateNodeElement.states.length > 0 && {
        states: stateNodeElement.states?.map(stateNodeElementToType),
      }),
    ...(stateNodeElement.comments &&
      stateNodeElement.comments.length > 0 && {
        comments: stateNodeElement.comments,
      }),
    ...(stateNodeElement.onDone && {
      onDone: stateNodeElementToType(stateNodeElement.onDone),
    }),
    ...(stateNodeElement.onError && {
      onError: stateNodeElementToType(stateNodeElement.onError),
    }),
    ...(stateNodeElement.onTrue && {
      onTrue: stateNodeElementToType(stateNodeElement.onTrue),
    }),
  };
};

const toMachineConfig = (
  stateNode: StateNodeElement,
): MachineConfig<any, any, any> => {
  let stateNameCount = 0;

  const getStateName = (comments: string[]) => {
    if (comments[0]) {
      return comments[0];
    }

    stateNameCount++;
    return `state${stateNameCount}`;
  };

  const toConfig = (
    stateNode: StateNodeElement,
  ): StateNodeConfig<any, any, any> => {
    return {
      ...((stateNode.type === "final-state" ||
        stateNode.type === "throw-final-state") && {
        type: "final",
      }),
      ...(stateNode.states && {
        states: Object.fromEntries(
          stateNode.states.map((stateNode) => [getStateName()]),
        ),
      }),
    };
  };

  return toConfig(stateNode);
};

describe("parseControlFlowFromFunction", () => {
  it("REPL", () => {
    const result = parseControlFlowFromFunction(CODE);
    expect(stateNodeElementToType(result[0]?.body)).toMatchInlineSnapshot(`
Object {
  "states": Array [
    Object {
      "onDone": Object {
        "type": "task-state",
      },
      "onError": Object {
        "states": Array [
          Object {
            "comments": Array [
              "Create user failed",
            ],
            "type": "throw-final-state",
          },
        ],
        "type": "task-state",
      },
      "type": "task-state",
    },
    Object {
      "comments": Array [
        "If has beta subscription",
      ],
      "onTrue": Object {
        "comments": Array [
          "If has beta subscription",
        ],
        "states": Array [
          Object {
            "comments": Array [
              "Has beta subscription",
            ],
            "type": "final-state",
          },
        ],
        "type": "task-state",
      },
      "type": "choice-node",
    },
    Object {
      "comments": Array [
        "Has no beta subscription",
      ],
      "type": "final-state",
    },
  ],
  "type": "task-state",
}
`);
  });
});
