export type JsonValue
  = | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export interface JsonSerializable<_T, TJson extends JsonObject> {
  json(): TJson;
}

export interface JsonSerializableConstructor<T, TJson extends JsonObject> {
  new(...args: any[]): JsonSerializable<T, TJson>;
  fromJson(data: TJson): T;
}
