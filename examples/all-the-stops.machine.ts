import { createMachine } from "xstate";

export const anotherMachine = createMachine({});

export const allTheStops = createMachine({
  initial: "idle",
  states: {
    idle: {
      invoke: [
        {
          src: async () => {},
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
