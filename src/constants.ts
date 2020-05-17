const original = Symbol
Symbol = Symbol || ((((a: string) => a) as any) as SymbolConstructor)

export const CONTEXT_KEY = Symbol('___sortableContext___')
export const SORTABLE_KEY = Symbol('___sortable___')

Symbol = original
