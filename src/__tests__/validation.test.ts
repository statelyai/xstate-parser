import { parseMachinesFromFile } from "../transform";

describe("Validation and failsafes", () => {
  describe("When the code does not contain createMachine or Machine", () => {
    it("Should return an empty array", () => {
      expect(
        parseMachinesFromFile(`
        const hello = 2;
      `),
      ).toEqual([]);
    });
  });
});
