type Suggestion = {
  text: string;
};

type Props = {
  suggestions: Suggestion[];
  onSelect: (text: string) => void;
};

export default function SuggestionCards({
  suggestions,
  onSelect,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        marginTop: 24,
      }}
    >
      <p>
        오늘의 제안
      </p>

      {suggestions.map((item) => (
        <button
          key={item.text}
          onClick={() =>
            onSelect(item.text)
          }
          style={{
            padding: 16,
            borderRadius: 16,
            textAlign: "left",
          }}
        >
          {item.text}
        </button>
      ))}
    </div>
  );
}
