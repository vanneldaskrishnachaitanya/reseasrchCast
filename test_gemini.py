import asyncio
from google import genai
from config import get_settings

async def main():
    s = get_settings()
    c = genai.Client(api_key=s.google_api_key)
    try:
        r = await c.aio.models.generate_content(model='gemini-2.0-flash', contents='hello')
        print('success', r.text)
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(main())
