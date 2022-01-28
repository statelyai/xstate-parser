import { INLINE_IMPLEMENTATION_TYPE } from "../constants";
import { parseMachinesFromFile } from "../parseMachinesFromFile";

describe("Invoke", () => {
  it("Should allow for JSON stringifying anonymous invocations", () => {
    const result = parseMachinesFromFile(`
      createMachine({
        invoke: {
          src: () => {},
        }
      })
    `);

    const config = JSON.stringify(result.machines[0].toConfig());

    /**
     * The function should be parsed as
     * anonymous
     */
    expect(config).toContain(INLINE_IMPLEMENTATION_TYPE);
  });
});
