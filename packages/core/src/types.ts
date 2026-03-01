/** Branded type for type-safe nominal typing */
export type BrandedType<T, N> = T & { __tag__: N }
export type BrandedString<N> = BrandedType<string, N>

/** Flavored type (optional brand) */
export type FlavoredType<T, N> = T & { __tag__?: N }

export type HexString = BrandedString<'HexString'>
