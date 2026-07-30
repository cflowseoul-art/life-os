type Props = {
  items: any[];
  expanded: boolean;
  onToggle: () => void;
};

export function ReceiptCard({
  items,
  expanded,
  onToggle,
}: Props) {
  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 16,
        background: "#ffffff",
        border: "1px solid #ddd",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        🧾 장보기 완료
      </div>

      <div>
        총 {items.length}개의 상품이 추가되었습니다.
      </div>

      <button
        onClick={onToggle}
        style={{
          marginTop: 10,
          padding: "8px 12px",
          borderRadius: 10,
          border: "none",
          cursor: "pointer",
        }}
      >
        {expanded
          ? "추가한 상품 숨기기 ▲"
          : "추가한 상품 보기 ▼"}
      </button>

      {expanded && (
        <div
          style={{
            marginTop: 10,
          }}
        >
          {items.map(
            (item, i) => (
              <div key={i}>
                ✓ {item.canonicalName ?? item.rawName} {item.quantity}{item.unit}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
