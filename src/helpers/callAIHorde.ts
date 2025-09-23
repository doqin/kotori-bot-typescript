import configurations from "../common/configurations";

export async function callAIHorde(
    authorization: string | undefined,
    model: string,
    systemMessage: string | undefined,
    messages: any[]
): Promise<string> {
    const url = "https://oai.aihorde.net/v1/chat/completions";
    const headers = {
        "Authorization": `Bearer ${authorization}`,
        "Content-Type": "application/json",
        "accept": "application/json"
    };
    let payload = {
        "model": model,
        "messages": [
            ...(systemMessage ? [{
                role: "system",
                content: systemMessage
            }] : []),
            ...messages
        ],
        "frequency_penalty": configurations.frequency_penalty,
        "presence_penalty": configurations.presence_penalty,
        "max_tokens": configurations.max_tokens,
        "n": configurations.n,
        "stop": configurations.stop,
        "temperature": configurations.temperature,
        "top_p": configurations.top_p,
        "timeout": configurations.timeout,
        "stream": configurations.stream
    };
    const response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    console.debug(data);

    // Check if response has valid choices
    if (!data.choices || data.choices.length === 0) {
        console.error("No choices received from AIHorde API");
        throw new Error("No response received from AIHorde API");
    }

    if (!data.choices[0]?.message?.content) {
        console.error("Invalid message structure received from AIHorde API");
        throw new Error("Invalid response structure from AIHorde API");
    }

    console.log(data.choices[0].message);
    return data.choices[0].message.content;
}