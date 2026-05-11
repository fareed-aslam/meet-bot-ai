export class MissingEnvError extends Error {
    missing: string[]

    constructor(missing: string[]) {
        super(`Missing required environment variables: ${missing.join(', ')}`)
        this.name = 'MissingEnvError'
        this.missing = missing
    }
}

export function requireEnv<TNames extends readonly string[]>(
    names: TNames
): Record<TNames[number], string> {
    const missing = names.filter((name) => !process.env[name])

    if (missing.length > 0) {
        throw new MissingEnvError(missing)
    }

    const values = {} as Record<TNames[number], string>
    for (const name of names) {
        values[name as TNames[number]] = process.env[name]!
    }

    return values
}
