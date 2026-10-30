import "server-only";

// Owned by one authenticated request only. Never cache this capability map
// across requests: each new request must revalidate its grant and source.
export type SampleAudioDeliveries = Map<string, (segment: string | null, request: Request) => Promise<Response>>;
