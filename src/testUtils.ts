import fs from "fs";
import path from "path";
import { createMachine } from "xstate";
import * as XStateParser from "./index";

const parseFileFromExamplesDir = async (
  filename: string,
): Promise<XStateParser.StateMachine<any, any, any>[]> => {
  const asString = fs
    .readFileSync(path.resolve(__dirname, "../examples", filename))
    .toString();

  const result = await XStateParser.parseMachinesFromFile(asString);

  return result.map(({ config }) => createMachine(config));
};

const withoutContext = <T extends { context?: any }>(
  config: T,
): Omit<T, "context"> => {
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
