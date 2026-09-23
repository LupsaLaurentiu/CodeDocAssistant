import { expect, it, vi } from "vitest";
import { chunk } from "./fixtures";
const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("@/lib/llm/client", () => ({
  getOpenAiClient: () => ({ responses: { parse } }),
}));
vi.mock("@/config/ai", () => ({ getAiConfig: () => ({ chatModel: "test" }) }));
import { generateAnswer } from "@/lib/llm/generate-answer";
it("requests structured output without storing provider-side conversation state", async () => {
  parse.mockResolvedValue({
    status: "completed",
    output_parsed: { status: "insufficient_context", sections: [] },
    usage: { input_tokens: 20, output_tokens: 5 },
  });
  await generateAnswer("What?", [chunk]);
  expect(parse).toHaveBeenCalledWith(
    expect.objectContaining({
      store: false,
      text: {
        format: expect.objectContaining({ type: "json_schema", strict: true }),
      },
    }),
  );
  const request = parse.mock.calls[0][0];
  expect(
    request.text.format.schema.properties.sections.items.properties.citations
      .items.properties.startLine,
  ).toMatchObject({ minimum: 10, maximum: 12 });
});
it("handles refusal and incomplete responses explicitly", async () => {
  parse.mockResolvedValue({ status: "completed", output_parsed: null });
  await expect(generateAnswer("What?", [chunk])).rejects.toThrow(
    "supported answer",
  );
  parse.mockResolvedValue({ status: "incomplete", output_parsed: null });
  await expect(generateAnswer("What?", [chunk])).rejects.toThrow("interrupted");
});
