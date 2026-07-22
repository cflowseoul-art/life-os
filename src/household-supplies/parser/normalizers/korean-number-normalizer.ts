export class KoreanNumberNormalizer {
  normalize(
    text: string,
  ): string {
    return text
      .replace(
        /한\s*(?=개|판)/g,
        "1",
      )
      .replace(
        /두\s*(?=개|판)/g,
        "2",
      )
      .replace(
        /세\s*(?=개|판)/g,
        "3",
      )
      .replace(
        /네\s*(?=개|판)/g,
        "4",
      )
      .replace(
        /다섯\s*(?=개|판)/g,
        "5",
      )
      .replace(
        /여섯\s*(?=개|판)/g,
        "6",
      )
      .replace(
        /일곱\s*(?=개|판)/g,
        "7",
      )
      .replace(
        /여덟\s*(?=개|판)/g,
        "8",
      )
      .replace(
        /아홉\s*(?=개|판)/g,
        "9",
      )
      .replace(
        /열\s*(?=개|판)/g,
        "10",
      );
  }
}
