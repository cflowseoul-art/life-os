import { useState } from "react";
import {
  sendAssistantText,
  analyzeReceipt,
} from "./api/life-os-api";

import SuggestionCards from "./components/SuggestionCards";
import { ReceiptCard } from "./components/ReceiptCard";
import { InventoryCard } from "./components/InventoryCard";

type Message = {
  role: "user" | "assistant";
  text?: string;
  data?: any;
  imageUrl?: string;
  expanded?: boolean;
};

function App() {
  const [input, setInput] =
    useState("");

  const [showUpload, setShowUpload] =
    useState(false);

  const [messages, setMessages] =
    useState<Message[]>([]);

  const [expandedReceipts, setExpandedReceipts] =
    useState<number[]>([]);

  const [pendingImage, setPendingImage] =
    useState<{
      file: File;
      previewUrl: string;
    } | null>(null);

  const [isSending, setIsSending] =
    useState(false);

  const suggestions = [
    {
      text: "냉장고에 뭐 있어?",
    },
    {
      text: "냉장고 재료로 레시피 추천해줘",
    },
    {
      text: "영수증 추가하기",
    },
  ];


  async function sendReceipt() {
    if (!pendingImage) {
      return;
    }

    const file =
      pendingImage.file;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: "영수증 추가",
        imageUrl:
          pendingImage.previewUrl,
      },
    ]);

    const base64 =
      await new Promise<string>(
        (resolve) => {
          const reader =
            new FileReader();

          reader.onload = () => {
            resolve(
              String(reader.result)
                .split(",")[1],
            );
          };

          reader.readAsDataURL(file);
        },
      );

    const result =
      await analyzeReceipt(
        base64,
        file.type,
      );

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        text:
          result.data.items
            .map(
              (item: any) =>
                `${item.rawName} ${item.quantity}${item.unit}`,
            )
            .join("\n"),

        data:
          result,
      },
    ]);

    if (pendingImage) {
      URL.revokeObjectURL(
        pendingImage.previewUrl,
      );
    }

    if (pendingImage) {
      URL.revokeObjectURL(
        pendingImage.previewUrl,
      );
    }

    setPendingImage(null);
    setShowUpload(false);
  }

  async function send(message?: string) {
    const text =
      message ?? input;

    if (!text.trim() || isSending) {
      return;
    }

    setIsSending(true);

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

      console.log(
        "ASSISTANT RESPONSE JSON",
        JSON.stringify(result, null, 2),
      );

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            result?.data?.message ??
            "요청을 처리할 수 없어요.",
          data: result?.data,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        maxWidth: 600,
        margin: "0 auto",
        padding: 20,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <h1>
        Life OS
      </h1>

      <main
        style={{
          flex: 1,
        }}
      >
        {messages.length === 0 && (
          <>
            <h2>
              오늘 무엇을 도와드릴까요?
            </h2>

            <SuggestionCards
              suggestions={suggestions}
              onSelect={(text) => {
                send(text);
              }}
            />
          </>
        )}

        {messages.map(
          (message, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                justifyContent:
                  message.role === "user"
                    ? "flex-end"
                    : "flex-start",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  maxWidth: 360,
                  padding: 12,
                  borderRadius: 12,
                  textAlign: "left",
                  background:
                    message.role === "user"
                      ? "#e8f0ff"
                      : "#f2f2f2",
                }}
              >
                <b>
                  {message.role === "user"
                    ? "나"
                    : "Life OS"}
                </b>

                {message.imageUrl && (
                  <img
                    src={message.imageUrl}
                    style={{
                      width: 220,
                      display: "block",
                      marginTop: 8,
                      borderRadius: 8,
                    }}
                  />
                )}

                  {message.text &&
                  message.data?.module !== "receipt" &&
                    message.data?.module !== "inventory" && (
                  <div
                    style={{
                      marginTop:
                        message.imageUrl
                          ? 8
                          : 0,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {message.text}
                  </div>
                )}

                  {message.data?.module === "inventory" &&
                    message.text && (
                      <InventoryCard
                        text={message.text}
                      />
                    )}

                  {message.data?.module === "receipt" &&
                  message.data?.data?.items && (
                    <ReceiptCard
                      items={message.data.data.items}
                      expanded={expandedReceipts.includes(index)}
                      onToggle={() =>
                        setExpandedReceipts((prev) =>
                          prev.includes(index)
                            ? prev.filter((x) => x !== index)
                            : [...prev, index],
                        )
                      }
                    />
                  )}
              </div>
            </div>
          ),
        )}
      </main>

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <button
          onClick={() =>
            setShowUpload((prev) => !prev)
          }
        >
          +
        </button>


        {pendingImage && (
          <div>
            <img
              src={pendingImage.previewUrl}
              style={{
                width: 200,
                borderRadius: 12,
              }}
            />

            <button
              onClick={sendReceipt}
            >
              전송
            </button>
          </div>
        )}

        {showUpload && (
          <input
  type="file"
  accept="image/*"
  onChange={(e) => {
    const file =
      e.target.files?.[0];

    if (!file) {
      return;
    }

    const previewUrl =
      URL.createObjectURL(file);

    setPendingImage({
      file,
      previewUrl,
    });
  }}
/>
        )}

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
            flex: 1,
            padding: 12,
          }}
        />
      </div>
    </div>
  );
}

export default App;
