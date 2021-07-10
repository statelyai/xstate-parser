import { createMachine, forwardTo, send, sendParent, actions } from "xstate";

export const anotherMachine = createMachine({});

export const allTheStops = createMachine({
  initial: "idle",
  states: {
    idle: {
      entry: [
        sendParent("HELLO"),
        sendParent({
          type: "HELLO",
        }),
        sendParent(
          {
            type: "HELLO",
          },
          {
            delay: 20,
            id: "id",
            to: "hey",
          },
        ),
        sendParent(() => ({
          type: "HELLO",
        })),
        send(
          () => {
            return {
              type: "HELLO",
            };
          },
          {
            delay: 20,
            id: "id",
            to: "hey",
          },
        ),
      ],
      on: {
        AWESOME: {
          actions: [
            forwardTo("wow"),
            () => {},
            actions.raise({ type: "YOU_RAISE_ME_UP" }),
            actions.respond({
              type: "YOU RESPOND TO ME",
            }),
            actions.sendUpdate(),
            actions.escalate({
              type: "ESCALATION",
            }),
          ],
        },
      },
      invoke: [
        {
          src: async () => {},
          autoForward: true,
          // Similar to context: not possible and
          // probably not desirable
          // data: {},
          onError: {
            target: "next",
          },
          id: "yeah",
        },
        // This is currently very hard, need to
        // grab the reference to the machine and
        // copy it. Shimming it for now
        // {
        //   id: "anotherMachine",
        //   src: anotherMachine,
        // },
        {
          src: "",
        },
      ],
    },
  },
});
