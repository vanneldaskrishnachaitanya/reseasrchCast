import asyncio
from google import genai
from config import get_settings

async def main():
    s = get_settings()
    c = genai.Client(api_key=s.google_api_key)
    try:
        models = await c.aio.models.list_models()
        for m in models:
            print(m.name)
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(main())