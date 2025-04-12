export function chunkArray<T>(
    array: T[],
    chunkSize: number
): T[][] {
    const b: T[][] = []
    array.forEach(element =>
        b && b[b.length - 1] && b[b.length - 1].length < chunkSize
            ? b[b.length - 1].push(element)
            : b.push([element])
    )
    return b
}
