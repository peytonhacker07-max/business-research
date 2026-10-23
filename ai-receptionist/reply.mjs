// Drafts the text reply the business sends after a missed call.
//
// Usage:
//   node reply.mjs "hey my ac is broken can someone come today"

import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";

const business = JSON.parse(fs.readFileSync("./business.json", "utf8"));

function buildSystemPrompt(b) {
  return `You are the receptionist for ${b.name}, a ${b.trade} company.

BUSINESS INFO
Hours: ${b.hours}
Services: ${b.services.join(", ")}
${b.facts.map((f) => `- ${f}`).join("\n")}

TASK
A customer called and the call was missed. Read their text message and write the reply the business sends back.

OUTPUT RULES
- Under 40 words.
- Friendly. Sounds like a real person texting, not a corporate bot.
- No emojis.
- End with a clear next step.

GUARDRAIL
If the answer isn't in the business info above (refunds, complaints, specific pricing you weren't given, anything outside ${b.trade}), say a team member will call them back shortly. Never guess.`;
}

export async function draftReply(customerMessage) {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 2000,
    output_config: { effort: "low" },
    system: buildSystemPrompt(business),
    messages: [{ role: "user", content: customerMessage }],
  });

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

const customerMessage = process.argv[2];

if (!customerMessage) {
  console.error('Usage: node reply.mjs "the customer\'s text message"');
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "No ANTHROPIC_API_KEY found. Get a key at console.anthropic.com, then run:\n" +
      "  export ANTHROPIC_API_KEY=sk-ant-...",
  );
  process.exit(1);
}

console.log(`\nCustomer: ${customerMessage}`);
console.log(`${business.name}: ${await draftReply(customerMessage)}\n`);
