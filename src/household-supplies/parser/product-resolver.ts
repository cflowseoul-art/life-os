export type ResolvedProduct = {
  canonicalProductId: string;
  canonicalName: string;
};

export interface ProductResolver {
  resolve(
    rawName: string,
  ): Promise<ResolvedProduct | null>;
}