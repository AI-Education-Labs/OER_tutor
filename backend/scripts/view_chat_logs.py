"""
Script to view detailed chat logs from MongoDB.
Run this to see complete chat interactions with all context.

Usage:
    python -m backend.scripts.view_chat_logs [session_id]
"""

import asyncio
import sys
from backend.features.logging.service import get_chat_logs


async def main():
    session_id = sys.argv[1] if len(sys.argv) > 1 else None
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 5

    print(f"\n🔍 Fetching detailed chat logs...")
    if session_id:
        print(f"   Session: {session_id}")
    print(f"   Limit: {limit}")
    print()

    logs = await get_chat_logs(
        session_id=session_id,
        limit=limit
    )

    if not logs:
        print("❌ No logs found")
        return

    print(f"✅ Found {len(logs)} log(s)\n")
    print("=" * 100)

    for i, log in enumerate(logs, 1):
        print(f"\n\n{'=' * 100}")
        print(f"LOG {i} of {len(logs)}")
        print('=' * 100)
        print(log)

    print(f"\n\n✅ Displayed {len(logs)} detailed chat logs")
    print(f"\n💡 To copy a specific log, scroll up and select the text")
    print(f"💡 To get logs for a specific session: python -m backend.scripts.view_chat_logs <session_id>")


if __name__ == "__main__":
    asyncio.run(main())
