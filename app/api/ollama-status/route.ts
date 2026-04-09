export async function GET(req: Request) {
  const url = new URL(req.url)
  const baseUrlParam = url.searchParams.get("baseUrl") || "http://127.0.0.1:11434"
  const model = url.searchParams.get("model") || "llama3.2"

  const normalizedBaseUrl = baseUrlParam.replace(/\/$/, "")
  const tagsUrl = normalizedBaseUrl.endsWith("/api")
    ? `${normalizedBaseUrl}/tags`
    : `${normalizedBaseUrl}/api/tags`

  try {
    const response = await fetch(tagsUrl, {
      method: "GET",
      cache: "no-store",
    })

    if (!response.ok) {
      return Response.json(
        {
          reachable: false,
          modelAvailable: false,
          modelCount: 0,
          error: `Ollama responded with status ${response.status}`,
        },
        { status: 200 }
      )
    }

    const data = await response.json()
    const models = Array.isArray(data?.models) ? data.models : []
    const modelNames: string[] = models
      .map((entry: { model?: string; name?: string }) => entry.model || entry.name || "")
      .filter(Boolean)

    const modelAvailable = modelNames.some((name) =>
      name.toLowerCase().includes(model.toLowerCase())
    )

    return Response.json({
      reachable: true,
      modelAvailable,
      modelCount: modelNames.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reach Ollama"
    return Response.json(
      {
        reachable: false,
        modelAvailable: false,
        modelCount: 0,
        error: message,
      },
      { status: 200 }
    )
  }
}
