# Second, independent MCP client (official Python SDK) used to verify Engram.
# Usage: TOKEN=eng_... THREAD=<threadId> MCP_URL=https://.../mcp python3 scripts/mcp-python-client.py
import asyncio, os
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
URL = os.environ.get("MCP_URL", "https://engram-ai.appwrite.network/mcp")
async def main():
    async with streamablehttp_client(URL, headers={"Authorization": f"Bearer {os.environ['TOKEN']}"}) as (r, w, _):
        async with ClientSession(r, w) as s:
            init = await s.initialize()
            print("python sdk: server", init.serverInfo.name, init.serverInfo.version, "protocol", init.protocolVersion)
            tools = await s.list_tools(); print("tools", len(tools.tools))
            res = await s.call_tool("save_memory", {"threadId": os.environ["THREAD"], "type": "DECISION", "content": "Saved from the Python MCP SDK client"})
            print("save_memory isError", res.isError)
            ctx = await s.call_tool("get_thread_context", {"threadId": os.environ["THREAD"]})
            print("decision visible:", "Python MCP SDK" in ctx.content[0].text)
            rr = await s.read_resource("engram://workspace"); print("resource ok", "Compat lib" in rr.contents[0].text)
            p = await s.get_prompt("load_project_context", {"threadId": os.environ["THREAD"]}); print("prompt ok", os.environ["THREAD"] in p.messages[0].content.text)
asyncio.run(main())
