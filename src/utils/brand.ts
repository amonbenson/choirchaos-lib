const BrandTypeId: unique symbol = Symbol.for("scoresync/utils/brand");

export type Branded<T, K extends keyof any> = T & { readonly [BrandTypeId]: { readonly [P in K]: void } };
