import * as t from "@babel/types";
import { MachineMeta, StateMeta } from "./types";

export class ParseContext {
  private id = 0;
  private currentMachineId?: string;
  private currentStatePath: string[] = [];
  private machineMap: Record<string, MachineMeta> = {};

  private incrementInternalId = () => this.id++;

  enterNewMachine = (callee: MachineMeta["callee"]) => {
    this.incrementInternalId();
    this.currentMachineId = `${this.id}`;
    this.machineMap[this.id] = {
      callee,
      states: {},
    };
  };

  updateCurrentMachine = (update: (machine: MachineMeta) => void) => {
    if (!this.currentMachineId)
      throw new Error("No machine currently selected!");
    const currentMachine = this.machineMap[this.currentMachineId];
    update(currentMachine);
  };

  updateCurrentState = (update: (state: StateMeta) => void) => {
    const currentState = this.getCurrentState();

    update(currentState);
  };

  private getCurrentState = (): StateMeta => {
    if (!this.currentMachineId) {
      throw new Error("No machine currently selected!");
    }
    let state = this.machineMap[this.currentMachineId];

    this.currentStatePath.forEach((path) => {
      state = state.states[path];
    });

    if (!state) {
      throw new Error("Could not get state");
    }

    return state;
  };

  enterNewState = (
    key: string,
    keyNodeLoc: t.SourceLocation | null,
    valueNodeLoc: t.SourceLocation | null,
  ) => {
    this.updateCurrentState((state) => {
      state.states[key] = {
        key,
        keyNode: {
          loc: keyNodeLoc,
        },
        valueNode: {
          loc: valueNodeLoc,
        },
        states: {},
      };
    });
    this.currentStatePath.push(key);
  };

  exitState = () => {
    this.currentStatePath.pop();
  };

  getResult = () => this.machineMap;
}
