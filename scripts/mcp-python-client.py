# Second, independent MCP client (official Python SDK) used to verify Engram.
# Usage: TOKEN=eng_... THREAD=<threadId> MCP_URL=https://.../mcp python3 scripts/mcp-python-client.py
import asyncio, json, os
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
            if res.isError:
                print("save_memory refused (expected with a read-only key):", res.content[0].text[:120])
            else:
                print("save_memory ok")
            ctx = await s.call_tool("get_thread_context", {"threadId": os.environ["THREAD"]})
            print("thread context ok:", not ctx.isError, "| decision visible:", "Python MCP SDK" in ctx.content[0].text)
            rr = await s.read_resource("engram://workspace"); print("resource ok", os.environ.get("LIB_NAME", "Project Atlas") in rr.contents[0].text)
            p = await s.get_prompt("load_project_context", {"threadId": os.environ["THREAD"]}); print("prompt ok", os.environ["THREAD"] in p.messages[0].content.text)
            if os.environ.get("AGENT"):
                ac = json.loads((await s.call_tool("get_agent_context", {"agentId": os.environ["AGENT"], "query": "offline status updates", "threadId": os.environ["THREAD"], "maxChars": 6000})).content[0].text)
                print("agent context:", ac["agent"]["name"], "| skills", [k["name"] for k in ac["skills"]], "| passages", len(ac["citations"]), "| chars", ac["budget"]["usedChars"], "/", ac["budget"]["maxChars"])
                sk = json.loads((await s.call_tool("list_skills", {"status": "published"})).content[0].text)
                print("published skills:", [k["name"] for k in sk["skills"]])
asyncio.run(main())
