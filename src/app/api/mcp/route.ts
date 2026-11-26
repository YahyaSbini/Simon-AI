import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { NextResponse } from "next/server";
import { findApiKeyOwner, keyFromRequest } from "@/lib/api-keys";
import { createSimonServer } from "@/lib/mcp/server";
import { runWithKey } from "@/lib/key-scope";

export const dynamic = "force-dynamic";

/** Stateless MCP over Streamable HTTP, authenticated with a Simon API key. */
async function handle(request: Request) {
  const owner = await findApiKeyOwner(keyFromRequest(request));

  if (!owner) {
    return NextResponse.json(
      { error: "Missing or invalid API key." },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }

  const server = createSimonServer(owner);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);

  return runWithKey(owner, () => transport.handleRequest(request));
}

export { handle as DELETE, handle as GET, handle as POST };
