import type {
  VisionClient,
} from "../vision-client.js";

export class ReceiptAnalyzer {
  constructor(
    private readonly visionClient: VisionClient,
  ) {}

  async analyze(input: {
    imageBase64: string;
    mimeType: string;
  }) {
    const result =
      await this.visionClient.analyzeImage(
        input.imageBase64,
        input.mimeType,
        `
영수증 이미지를 분석해서 재고 관리용 상품 목록 JSON으로 반환하세요.

중요 규칙:
- JSON만 반환
- markdown 금지
- 가격 제외
- 비식품 제외
- 식품만 포함
- 상품명은 재고 관리 가능한 형태로 정규화
- "6입", "10입", "12개입" 같은 포장 표시는 상품명과 분리
- 묶음 상품은 실제 개수 기준으로 quantity 계산

예시:

입력:
컵누들 매콤한맛 6입 1개

출력:
{
  "items": [
    {
      "rawName": "컵누들 매콤한맛",
      "quantity": 6,
      "unit": "개"
    }
  ]
}

입력:
서울우유 1L 2개

출력:
{
  "items": [
    {
      "rawName": "서울우유 1L",
      "quantity": 2,
      "unit": "개"
    }
  ]
}

입력:
물티슈 100매

제외:
{
  "items": []
}

형식:

{
  "items": [
    {
      "rawName": string,
      "quantity": number,
      "unit": string
    }
  ]
}
`,
      );

    return JSON.parse(result);
  }
}
