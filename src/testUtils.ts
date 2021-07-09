import fs from "fs";
import path from "path";
import { createMachine, MachineConfig, StateMachine } from "xstate";
import { parseMachinesFromFile } from "./transform";

const parseFileFromExamplesDir = async (
  filename: string,
): Promise<StateMachine<any, any, any>[]> => {
  const asString = fs
    .readFileSync(path.resolve(__dirname, "../examples", filename))
    .toString();

  const result = await parseMachinesFromFile(asString);

  return result.map((config) => createMachine(config));
};

const withoutContext = (config: MachineConfig<any, any, any>) => {
  const newConfig = {
    ...config,
  };

  delete newConfig.context;

  return newConfig;
};

const serialise = (machine: any) => {
  return JSON.stringify(machine, null, 2);
};

export const testUtils = {
  parseFileFromExamplesDir,
  withoutContext,
  serialise,
};
