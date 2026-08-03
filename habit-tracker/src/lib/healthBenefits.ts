export async function generateHealthBenefits(habitName: string): Promise<string> {
  try {
    const response = await fetch("/.netlify/functions/health-benefits", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ habitName }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      const msg = errorData.error || `API error ${response.status}`;
      console.error(msg);
      return msg;
    }

    const data = await response.json();
    return data.benefits || "No benefits generated.";
  } catch (error) {
    const msg = `Failed: ${error instanceof Error ? error.message : String(error)}`;
    console.error(msg);
    return msg;
  }
}
