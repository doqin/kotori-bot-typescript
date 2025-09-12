import { OpenRouterMessage } from "../common/types";

export async function callOpenRouter(
    authorization: string | undefined,
    model: string,
    systemMessage: string | undefined,
    messages: OpenRouterMessage[]
): Promise<string> {
    const url = "https://openrouter.ai/api/v1/chat/completions";
    const headers = {
        "Authorization": `Bearer ${authorization}`,
        "Content-Type": "application/json"
    };
    let payload = {
        "model": model,
        "messages": [
            ...(systemMessage ? [{
                role: "system",
                content: systemMessage
            }] : []),
            ...messages
        ]
    };
    const response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    console.log(data);
    
    // Check if response has valid choices
    if (!data.choices || data.choices.length === 0) {
        console.error("No choices received from OpenRouter API");
        throw new Error("No response received from OpenRouter API");
    }
    
    if (!data.choices[0]?.message?.content) {
        console.error("Invalid message structure received from OpenRouter API");
        throw new Error("Invalid response structure from OpenRouter API");
    }
    
    console.log(data.choices[0].message);
    return data.choices[0].message.content;
}