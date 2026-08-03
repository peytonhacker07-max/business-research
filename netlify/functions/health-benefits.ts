import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { habitName } = req.body;

  if (!habitName || typeof habitName !== 'string') {
    return res.status(400).json({ error: 'habitName is required' });
  }

  const apiKey = process.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-5',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `Provide 2-3 evidence-based health benefits of "${habitName}". Be concise, factual, and practical. Focus on physical or mental health benefits. Format as a short paragraph (2-3 sentences max).`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res
        .status(response.status)
        .json({ error: `API error: ${errorText}` });
    }

    const data = await response.json();
    const benefits = data.content[0]?.text || '';

    return res.status(200).json({ benefits });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: `Failed: ${message}` });
  }
}
