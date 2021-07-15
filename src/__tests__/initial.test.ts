import { testUtils } from "../testUtils";

describe(`initial`, () => {
  const result = testUtils.parseFileFromExamplesDir("initial.ts");

  it("Should calculate the correct location for the initial node", () => {
    // expect(result[0].statesMeta)
    const rootStateMeta = result[0].statesMeta[0];
    expect(rootStateMeta.initial?.target).toEqual("idle");

    // This should only change when initial.ts changes
    expect(rootStateMeta.initial?.location).toMatchInlineSnapshot(`
      Object {
        "end": Object {
          "absoluteChar": 90,
          "column": 17,
          "line": 4,
        },
        "start": Object {
          "absoluteChar": 84,
          "column": 11,
          "line": 4,
        },
      }
    `);
  });
});
