"use server";

export async function getSessionToken() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const sessionConfig = JSON.stringify({
    session: {
      type: "realtime",
      model: "gpt-realtime-mini-2025-12-15",
      audio: {
        output: {
          voice: "alloy",
        },
      },
    },
  });

  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: sessionConfig,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    if (!data?.value) {
      throw new Error("Invalid response: missing token value");
    }

    return data.value;
  } catch (error) {
    console.error("Error creating ephemeral token:", error);
    throw new Error(`Failed to create ephemeral token: ${error instanceof Error ? error.message : String(error)}`);
  }
}

