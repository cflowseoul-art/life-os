import { useState } from "react";
import { sendAssistantText } from "./api/life-os-api";

type Message = {
  role: "user" | "assistant";
  text: string;
};

function App() {
  const [input, setInput] =
    useState("");

  const [messages, setMessages] =
    useState<Message[]>([]);

  const [isSending, setIsSending] =
    useState(false);

  async function send() {
    if (!input.trim() || isSending) {
      return;
    }

    setIsSending(true);

    const text = input;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text,
      },
    ]);

    setInput("");

    try {
      const result =
        await sendAssistantText(text);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            result.data?.message ??
            result.data?.status ??
            "응답을 이해하지 못했습니다.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 600,
        margin: "40px auto",
      }}
    >
      <h1>
        Life OS
      </h1>

      <div>
        {messages.map(
          (message, index) => (
            <p key={index}>
              <b>
                {message.role === "user"
                  ? "나"
                  : "Life OS"}
              :
              </b>{" "}
              {message.text}
            </p>
          ),
        )}
      </div>

      <input
        value={input}
        onChange={(e) =>
          setInput(e.target.value)
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            send();
          }
        }}
        placeholder="Life OS에게 말하기"
        style={{
          width: "100%",
          padding: 12,
        }}
      />
    </div>
  );
}

export default App;
