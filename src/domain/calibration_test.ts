import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { computeCalibrationDelta } from "./calibration.ts";

describe("computeCalibrationDelta", () => {
  it("returns 0 when predicted matches actual", () => {
    assertEquals(computeCalibrationDelta("correct", "correct"), 0);
    assertEquals(computeCalibrationDelta("partial", "partial"), 0);
    assertEquals(computeCalibrationDelta("incorrect", "incorrect"), 0);
  });

  it("returns -1 when predicted > actual (overestimate)", () => {
    assertEquals(computeCalibrationDelta("correct", "partial"), -1);
    assertEquals(computeCalibrationDelta("correct", "incorrect"), -1);
    assertEquals(computeCalibrationDelta("partial", "incorrect"), -1);
  });

  it("returns 1 when predicted < actual (underestimate)", () => {
    assertEquals(computeCalibrationDelta("incorrect", "partial"), 1);
    assertEquals(computeCalibrationDelta("incorrect", "correct"), 1);
    assertEquals(computeCalibrationDelta("partial", "correct"), 1);
  });
});
