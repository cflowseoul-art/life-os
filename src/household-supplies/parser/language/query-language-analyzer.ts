export type QueryLanguageAnalysis = {
  isQuery: boolean;
  normalizedText: string;
  cleanedText: string;
};


export class QueryLanguageAnalyzer {
  analyze(
    text: string,
  ): QueryLanguageAnalysis {
    const normalizedText =
      text
        .replace(/[.,!?]/g, "")
        .trim();

    const isQuery =
      /(있어|있냐|있나|있니|있지|없어|없냐|없나|없지|남았어|남았냐|남아|남냐|몇\s*개|얼마나|뭐 있어|무엇|알려줘)/.test(
        normalizedText,
      );

    const cleanedText =
      normalizedText
        .replace(
          /(집에|냉장고에|냉장고|몇\s*개|얼마나|있어|있냐|있나|있니|있지|없어|없냐|없나|없지|남았어|남았냐|남아|남냐|뭐 있어|무엇|알려줘|\?)/g,
          "",
        )
        .trim();

    return {
      isQuery,
      normalizedText,
      cleanedText,
    };
  }
}
