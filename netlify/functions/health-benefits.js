const API_KEY = process.env.VITE_ANTHROPIC_API_KEY;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { habitName } = body;

  if (!habitName || typeof habitName !== "string") {
    return { statusCode: 400, body: "habitName is required" };
  }

  if (!API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "API key not configured" }),
    };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
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
      const errorText = await response.text();
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `API error: ${errorText}` }),
      };
    }

    const data = await response.json();
    const benefits = data.content[0]?.text || "";

    return {
      statusCode: 200,
      body: JSON.stringify({ benefits }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Failed: ${error.message}` }),
    };
  }
};
