const original = Symbol
Symbol = Symbol || ((((a: string) => a) as any) as SymbolConstructor)

export const CONTEXT_KEY = Symbol('___sortableContext___')

Symbol = original
