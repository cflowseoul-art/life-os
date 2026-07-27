const API_BASE_URL =
  "http://127.0.0.1:3000";

const WORKSPACE_ID =
  "33333333-3333-4333-8333-333333333333";

const HOUSEHOLD_ID =
  "22222222-2222-4222-8222-222222222222";

const ACTOR_ID =
  "11111111-1111-4111-8111-111111111111";

export async function sendAssistantText(
  text: string,
) {
  const response =
    await fetch(
      `${API_BASE_URL}/api/workspaces/${WORKSPACE_ID}/assistant/text`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          householdId: HOUSEHOLD_ID,
          actorId: ACTOR_ID,
        }),
      },
    );

  if (!response.ok) {
    throw new Error(
      `API Error: ${response.status}`,
    );
  }

  return response.json();
}


