const BrandTypeId: unique symbol = Symbol.for("choirchaos-lib/utils/brand");

export type Branded<T, K extends keyof any> = T & { readonly [BrandTypeId]: { readonly [P in K]: void } };
