const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
const API_URL = "https://api.anthropic.com/v1/messages";

export async function generateHealthBenefits(habitName: string): Promise<string> {
  if (!API_KEY) {
    console.warn("API key not found. Health benefits will not be generated.");
    return "";
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-5",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: `Provide 2-3 evidence-based health benefits of "${habitName}". Be concise, factual, and practical. Focus on physical or mental health benefits. Format as a short paragraph (2-3 sentences max).`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("API error:", response.status);
      return "";
    }

    const data = await response.json();
    return data.content[0]?.text || "";
  } catch (error) {
    console.error("Failed to generate health benefits:", error);
    return "";
  }
}
