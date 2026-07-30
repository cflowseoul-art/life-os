type Props = {
  text: string;
};

export function InventoryCard({
  text,
}: Props) {
  return (
    <div
      style={{
        marginTop: 8,
        padding: 12,
        borderRadius: 16,
        background: "#ffffff",
        border: "1px solid #ddd",
        whiteSpace: "pre-wrap",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        🧊 냉장고
      </div>

      {text}
    </div>
  );
}
