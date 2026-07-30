export type CreatedProduct = {
  canonicalProductId: string;
  canonicalName: string;
};

export interface ProductCreator {
  create(input: {
    name: string;
    baseUnit: string;
  }): Promise<CreatedProduct>;
}
