import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { autoGradeMultipleChoice } from "./evaluate_mc.ts";
import type { Question } from "../db/types.ts";

function mcQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: "q-1",
    dayContentId: "d-1",
    domainId: "dom",
    sequence: 1,
    type: "multiple_choice",
    body: "Pick one",
    maxLevel: 3,
    deadline: "2026-04-17T00:00:00.000Z",
    options: [
      { key: "A", text: "first", isOptimal: false },
      { key: "B", text: "second", isOptimal: true },
      { key: "C", text: "third", isOptimal: false },
    ],
    ...overrides,
  };
}

describe("autoGradeMultipleChoice", () => {
  it("matches on option key", () => {
    const result = autoGradeMultipleChoice(mcQuestion(), "B");
    assertEquals(result.correct, true);
    assertEquals(result.score, 1);
  });

  it("matches on option text", () => {
    const result = autoGradeMultipleChoice(mcQuestion(), "second");
    assertEquals(result.correct, true);
  });

  it("marks incorrect when neither key nor text matches", () => {
    const result = autoGradeMultipleChoice(mcQuestion(), "A");
    assertEquals(result.correct, false);
    assertEquals(result.score, 0);
    assertEquals(result.explanation, "Het juiste antwoord was: second");
  });

  it("coerces non-string responses", () => {
    const result = autoGradeMultipleChoice(mcQuestion(), 42);
    assertEquals(result.correct, false);
  });

  it("fails gracefully when no options configured", () => {
    const q = mcQuestion({ options: undefined });
    const result = autoGradeMultipleChoice(q, "B");
    assertEquals(result.correct, false);
    assertEquals(result.score, 0);
  });

  it("fails gracefully when no optimal option marked", () => {
    const q = mcQuestion({
      options: [
        { key: "A", text: "first", isOptimal: false },
        { key: "B", text: "second", isOptimal: false },
      ],
    });
    const result = autoGradeMultipleChoice(q, "A");
    assertEquals(result.correct, false);
  });

  it("refuses non-multiple-choice questions", () => {
    const q = mcQuestion({ type: "open", options: undefined });
    const result = autoGradeMultipleChoice(q, "anything");
    assertEquals(result.correct, false);
  });
});
