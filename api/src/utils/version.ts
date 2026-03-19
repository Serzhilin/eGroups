export function compareVersions(v1: string, v2: string): number {
    const a = v1.split(".").map(Number);
    const b = v2.split(".").map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const diff = (a[i] || 0) - (b[i] || 0);
        if (diff !== 0) return diff > 0 ? 1 : -1;
    }
    return 0;
}

export function isVersionValid(appVersion: string, minVersion: string): boolean {
    return compareVersions(appVersion, minVersion) >= 0;
}
